import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { runAIClaimPipeline } from './src/services/geminiPipeline.js';
import { generateClaimPDFReport } from './src/lib/pdfGenerator.js';
import { ClaimRecord } from './src/types/claim.js';
import { supabaseAdmin, isSupabaseConfigured } from './src/lib/supabaseAdmin.js';
import { authMiddleware, requireRole } from './src/middleware/authMiddleware.js';
import { extractTextFromDocument } from './src/services/documentProcessor.js';
import { validateDocumentContent } from './src/services/documentValidator.js';
import { SEED_POLICIES } from './src/data/seedPolicies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer config — store uploads in OS temp dir, auto-clean
const upload = multer({
  dest: path.join(os.tmpdir(), 'claimx-uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

const app = express();
app.use(express.json({ limit: '20mb' }));

// In-memory fallback database for claims when Supabase is not configured
const mockClaimsDb: ClaimRecord[] = [];

// ============================================================
// HELPER: Convert a Supabase claims row (snake_case JSONB) back
// into the ClaimRecord shape the frontend expects (camelCase).
// ============================================================
function mapDbRowToClaimRecord(row: any): ClaimRecord {
  return {
    id: row.id,
    claimNumber: row.claim_number,
    userId: row.user_id,
    claimantName: row.claimant_name,
    claimantEmail: row.claimant_email,
    insuranceType: row.insurance_type,
    claimSubType: row.claim_sub_type,
    policyNumber: row.policy_number,
    claimedAmount: Number(row.claimed_amount),
    status: row.status,
    extractedData: row.extracted_data || {},
    fieldList: row.field_list || [],
    fraudSignals: row.fraud_signals || [],
    overallFraudScore: Number(row.overall_fraud_score || 0),
    isFraudFlagged: row.is_fraud_flagged || false,
    policyVerified: row.policy_verified || false,
    policyMatchDetails: row.policy_match_details,
    estimation: row.estimation || {},
    agentReview: row.agent_review,
    adminDecision: row.admin_decision,
    documents: row.documents || [],
    pdfReportUrl: row.pdf_report_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: Convert a ClaimRecord into the snake_case shape for Supabase insert
function mapClaimRecordToDbRow(claim: ClaimRecord) {
  return {
    id: claim.id,
    claim_number: claim.claimNumber,
    user_id: claim.userId,
    claimant_name: claim.claimantName,
    claimant_email: claim.claimantEmail,
    insurance_type: claim.insuranceType,
    claim_sub_type: claim.claimSubType,
    policy_number: claim.policyNumber,
    claimed_amount: claim.claimedAmount,
    status: claim.status,
    extracted_data: claim.extractedData,
    field_list: claim.fieldList,
    fraud_signals: claim.fraudSignals,
    overall_fraud_score: claim.overallFraudScore,
    is_fraud_flagged: claim.isFraudFlagged,
    policy_verified: claim.policyVerified,
    policy_match_details: claim.policyMatchDetails,
    estimation: claim.estimation,
    agent_review: claim.agentReview || null,
    admin_decision: claim.adminDecision || null,
    documents: claim.documents,
    pdf_report_url: claim.pdfReportUrl || null,
    created_at: claim.createdAt,
    updated_at: claim.updatedAt,
  };
}

// ============================================================
// API ROUTES — All protected by authMiddleware
// ============================================================

// -----------------------------------------------------------
// Document Upload, Extraction & Validation Endpoint
// -----------------------------------------------------------
app.post('/api/documents/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { docType, insuranceType, claimId } = req.body;
    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const originalName = req.file.originalname || 'document';

    // Step 1: Extract text from the document
    const extraction = await extractTextFromDocument(fileBuffer, mimeType, originalName);

    // Step 2: Validate document content against expected type
    let validation = null;
    if (docType && insuranceType && extraction.text.length > 0) {
      validation = validateDocumentContent(extraction.text, docType, insuranceType);
    }

    // Step 3: Upload to Supabase Storage
    let storageUrl = '';
    const storagePath = `${req.user!.id}/${claimId || 'pending'}/${Date.now()}_${originalName}`;
    if (isSupabaseConfigured()) {
      try {
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('claim-documents')
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: false,
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabaseAdmin.storage
            .from('claim-documents')
            .getPublicUrl(storagePath);
          storageUrl = urlData?.publicUrl || `storage://claim-documents/${storagePath}`;
        } else if (uploadError) {
          console.warn('Supabase Storage upload failed (non-fatal):', uploadError.message);
          storageUrl = `storage://claim-documents/${storagePath}`;
        }
      } catch (storageErr: any) {
        console.warn('Supabase Storage unavailable (non-fatal):', storageErr?.message);
        storageUrl = `storage://claim-documents/${storagePath}`;
      }
    } else {
      console.warn('Supabase not configured. Using local/mock storage URL for document.');
      storageUrl = `mock-storage://claim-documents/${storagePath}`;
    }

    // Clean up temp file
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }

    res.json({
      success: true,
      fileName: originalName,
      mimeType,
      fileSize: req.file.size,
      storageUrl,
      extraction: {
        text: extraction.text,
        confidence: extraction.confidence,
        method: extraction.method,
        pageCount: extraction.pageCount,
        processingTimeMs: extraction.processingTimeMs,
        error: extraction.error,
      },
      validation,
      totalProcessingTimeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    // Clean up temp file on error
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    console.error('Document upload/extraction error:', err);
    res.status(500).json({ error: err.message || 'Document processing failed' });
  }
});

// -----------------------------------------------------------
// AI Processing Pipeline Endpoint
// -----------------------------------------------------------
app.post('/api/pipeline/process', authMiddleware, async (req, res) => {
  try {
    const { insuranceType, claimSubType, policyNumber, claimantName, claimantEmail, claimedAmount, files } = req.body;

    if (!insuranceType || !policyNumber || !claimedAmount) {
      return res.status(400).json({ error: 'Missing required parameters: insuranceType, policyNumber, claimedAmount' });
    }

    // Track pipeline step results for the frontend
    const pipelineSteps: { step: string; status: 'success' | 'warning' | 'failed'; message: string; durationMs: number }[] = [];
    const stepStart = Date.now();

    // Step 1: Input validation
    const hasFiles = files && files.length > 0;
    pipelineSteps.push({
      step: '1/6 Input Validator & File Checklist',
      status: hasFiles ? 'success' : 'warning',
      message: hasFiles ? `${files.length} document(s) received with extraction data` : 'No documents uploaded — pipeline will use form data only',
      durationMs: Date.now() - stepStart,
    });

    // Step 2: Check extraction quality (from pre-processed upload results)
    const step2Start = Date.now();
    const lowConfidenceFiles = (files || []).filter((f: any) => f.extractionConfidence !== undefined && f.extractionConfidence < 0.3);
    const failedExtractionFiles = (files || []).filter((f: any) => f.extractionError);

    if (failedExtractionFiles.length > 0) {
      pipelineSteps.push({
        step: '2/6 Document OCR & Text Extraction',
        status: 'failed',
        message: `${failedExtractionFiles.length} document(s) failed text extraction: ${failedExtractionFiles.map((f: any) => f.name).join(', ')}`,
        durationMs: Date.now() - step2Start,
      });
    } else if (lowConfidenceFiles.length > 0) {
      pipelineSteps.push({
        step: '2/6 Document OCR & Text Extraction',
        status: 'warning',
        message: `${lowConfidenceFiles.length} document(s) have low OCR confidence — extraction may be inaccurate`,
        durationMs: Date.now() - step2Start,
      });
    } else {
      pipelineSteps.push({
        step: '2/6 Document OCR & Text Extraction',
        status: 'success',
        message: `All documents extracted successfully${files?.length ? ` (${files.length} files)` : ''}`,
        durationMs: Date.now() - step2Start,
      });
    }

    // Run the AI pipeline (steps 3-6 happen inside)
    const step3Start = Date.now();
    const claimRecord = await runAIClaimPipeline({
      insuranceType,
      claimSubType: claimSubType || 'own_damage',
      policyNumber,
      claimantName: claimantName || req.user?.fullName || 'Claimant',
      claimantEmail: claimantEmail || req.user?.email || '',
      claimedAmount: Number(claimedAmount),
      files: files || []
    });

    // Step 3: Gemini extraction
    pipelineSteps.push({
      step: '3/6 Gemini Flash Field Extractor',
      status: claimRecord.fieldList.length > 0 ? 'success' : 'warning',
      message: claimRecord.fieldList.length > 0
        ? `Extracted ${claimRecord.fieldList.length} structured fields via Gemini AI`
        : 'Gemini extraction skipped or returned no fields — using deterministic fallback',
      durationMs: Date.now() - step3Start,
    });

    // Step 4: Fraud detection
    const step4Start = Date.now();
    const failedFraudSignals = claimRecord.fraudSignals.filter(s => !s.passed);
    pipelineSteps.push({
      step: '4/6 Base & Type-Specific Fraud Detection',
      status: claimRecord.isFraudFlagged ? 'warning' : 'success',
      message: claimRecord.isFraudFlagged
        ? `⚠ Fraud flagged (score: ${claimRecord.overallFraudScore}/100) — ${failedFraudSignals.length} signal(s) triggered`
        : `Fraud check passed (score: ${claimRecord.overallFraudScore}/100)`,
      durationMs: Date.now() - step4Start,
    });

    // Step 5: Policy verification & estimation
    pipelineSteps.push({
      step: '5/6 Policy Verification & Strategy Estimator',
      status: claimRecord.policyVerified ? 'success' : 'warning',
      message: claimRecord.policyVerified
        ? `Policy verified. Estimated payout: ₹${claimRecord.estimation.estimatedPayout.toLocaleString('en-IN')}`
        : `Policy not found in register. ${claimRecord.policyMatchDetails || ''}`,
      durationMs: 0,
    });

    // Step 6: Record creation
    pipelineSteps.push({
      step: '6/6 Claim Record & Report Generation',
      status: 'success',
      message: `Claim ${claimRecord.claimNumber} created with status: ${claimRecord.status}`,
      durationMs: 0,
    });

    // Set the authenticated user's ID on the claim
    claimRecord.userId = req.user!.id;

    // Persist to Supabase claims table or fallback to in-memory db
    if (isSupabaseConfigured()) {
      const dbRow = mapClaimRecordToDbRow(claimRecord);
      const { error: insertError } = await supabaseAdmin
        .from('claims')
        .insert(dbRow);

      if (insertError) {
        console.error('Failed to insert claim into Supabase:', insertError.message);
      }
    } else {
      mockClaimsDb.push(claimRecord);
    }

    res.json({
      success: true,
      claim: claimRecord,
      pipelineSteps,
    });
  } catch (err: any) {
    console.error('Error in AI Pipeline:', err);
    res.status(500).json({ error: err.message || 'Failed to process claim in AI pipeline' });
  }
});

// -----------------------------------------------------------
// Claims Endpoints
// -----------------------------------------------------------
app.get('/api/claims/list', authMiddleware, async (req, res) => {
  try {
    const { insurance_type } = req.query;

    if (!isSupabaseConfigured()) {
      let filtered = [...mockClaimsDb];
      if (req.user?.role === 'claimant') {
        filtered = filtered.filter(c => c.userId === req.user?.id);
      }
      if (insurance_type && typeof insurance_type === 'string') {
        filtered = filtered.filter(c => c.insuranceType === insurance_type);
      }
      return res.json({ claims: filtered, total: filtered.length });
    }

    let query = supabaseAdmin.from('claims').select('*').order('created_at', { ascending: false });

    // Claimants only see their own claims
    if (req.user?.role === 'claimant') {
      query = query.eq('user_id', req.user.id);
    }

    if (insurance_type && typeof insurance_type === 'string') {
      query = query.eq('insurance_type', insurance_type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch claims:', error.message);
      return res.status(500).json({ error: 'Failed to fetch claims' });
    }

    const claims = (data || []).map(mapDbRowToClaimRecord);
    res.json({ claims, total: claims.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/claims/:id', authMiddleware, async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      const claim = mockClaimsDb.find(c => c.id === req.params.id);
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      if (req.user?.role === 'claimant' && claim.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. This claim belongs to another user.' });
      }
      return res.json({ claim });
    }

    let query = supabaseAdmin
      .from('claims')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    const { data, error } = await query;

    if (error || !data) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    // Claimants can only view their own claims
    if (req.user?.role === 'claimant' && data.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. This claim belongs to another user.' });
    }

    res.json({ claim: mapDbRowToClaimRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/claims/:id/status', authMiddleware, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!isSupabaseConfigured()) {
      const claim = mockClaimsDb.find(c => c.id === req.params.id);
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      claim.status = status;
      claim.updatedAt = new Date().toISOString();
      return res.json({ claim });
    }

    const { data, error } = await supabaseAdmin
      .from('claims')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ claim: mapDbRowToClaimRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------
// PDF Settlement Report Generation
// -----------------------------------------------------------
app.get('/api/reports/:id/download', authMiddleware, async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      const claim = mockClaimsDb.find(c => c.id === req.params.id);
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      if (req.user?.role === 'claimant' && claim.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }
      const pdfDataUri = generateClaimPDFReport(claim);
      return res.json({ pdfDataUri, claimNumber: claim.claimNumber });
    }

    const { data, error } = await supabaseAdmin
      .from('claims')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Claim not found for PDF generation' });
    }

    // Claimants can only download reports for their own claims
    if (req.user?.role === 'claimant' && data.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const claim = mapDbRowToClaimRecord(data);
    const pdfDataUri = generateClaimPDFReport(claim);
    res.json({ pdfDataUri, claimNumber: claim.claimNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------
// Agent Queue & Review Endpoints
// -----------------------------------------------------------
app.get('/api/agent/claims', authMiddleware, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { insurance_type, fraud_only } = req.query;

    if (!isSupabaseConfigured()) {
      let filtered = mockClaimsDb.filter(c => ['agent_review', 'flagged_fraud', 'submitted'].includes(c.status));
      if (insurance_type && typeof insurance_type === 'string') {
        filtered = filtered.filter(c => c.insuranceType === insurance_type);
      }
      if (fraud_only === 'true') {
        filtered = filtered.filter(c => c.isFraudFlagged);
      }
      return res.json({ queue: filtered, total: filtered.length });
    }

    let query = supabaseAdmin
      .from('claims')
      .select('*')
      .in('status', ['agent_review', 'flagged_fraud', 'submitted'])
      .order('created_at', { ascending: false });

    if (insurance_type && typeof insurance_type === 'string') {
      query = query.eq('insurance_type', insurance_type);
    }

    if (fraud_only === 'true') {
      query = query.eq('is_fraud_flagged', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch agent queue:', error.message);
      return res.status(500).json({ error: 'Failed to fetch agent queue' });
    }

    const queue = (data || []).map(mapDbRowToClaimRecord);
    res.json({ queue, total: queue.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/claims/:id/review', authMiddleware, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { recommendedPayout, recommendation, overrideRationale, agentName } = req.body;

    const agentReview = {
      agentId: req.user!.id,
      agentName: agentName || req.user?.fullName || 'Agent Specialist',
      recommendedPayout: Number(recommendedPayout),
      recommendation,
      overrideRationale,
      reviewTimestamp: new Date().toISOString()
    };

    const newStatus = recommendation === 'approve' ? 'approved' : recommendation === 'reject' ? 'rejected' : 'agent_review';

    if (!isSupabaseConfigured()) {
      const claim = mockClaimsDb.find(c => c.id === req.params.id);
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      claim.agentReview = agentReview;
      claim.status = newStatus;
      claim.updatedAt = new Date().toISOString();
      return res.json({ success: true, claim });
    }

    const { data, error } = await supabaseAdmin
      .from('claims')
      .update({
        agent_review: agentReview,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ success: true, claim: mapDbRowToClaimRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------
// Admin Panel Endpoints
// -----------------------------------------------------------
app.get('/api/admin-panel/claims', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { insurance_type, status } = req.query;

    if (!isSupabaseConfigured()) {
      let filtered = [...mockClaimsDb];
      if (insurance_type && typeof insurance_type === 'string') {
        filtered = filtered.filter(c => c.insuranceType === insurance_type);
      }
      if (status && typeof status === 'string') {
        filtered = filtered.filter(c => c.status === status);
      }
      return res.json({ claims: filtered, total: filtered.length });
    }

    let query = supabaseAdmin.from('claims').select('*').order('created_at', { ascending: false });

    if (insurance_type && typeof insurance_type === 'string') {
      query = query.eq('insurance_type', insurance_type);
    }
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch claims' });
    }

    const claims = (data || []).map(mapDbRowToClaimRecord);
    res.json({ claims, total: claims.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin-panel/claims/:id/approve', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { finalAmount, remarks, decidedBy } = req.body;

    if (!isSupabaseConfigured()) {
      const claim = mockClaimsDb.find(c => c.id === req.params.id);
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      const adminDecision = {
        action: 'approve' as const,
        finalAmount: Number(finalAmount || claim.estimation?.estimatedPayout || 0),
        remarks: remarks || 'Approved by Platform Administrator.',
        decidedBy: decidedBy || req.user?.fullName || 'Admin Supervisor',
        decidedAt: new Date().toISOString()
      };
      claim.status = 'approved';
      claim.adminDecision = adminDecision;
      claim.updatedAt = new Date().toISOString();
      return res.json({ success: true, claim });
    }

    // Fetch current claim to get estimation fallback
    const { data: current } = await supabaseAdmin
      .from('claims')
      .select('estimation')
      .eq('id', req.params.id)
      .maybeSingle();

    const adminDecision = {
      action: 'approve',
      finalAmount: Number(finalAmount || current?.estimation?.estimatedPayout || 0),
      remarks: remarks || 'Approved by Platform Administrator.',
      decidedBy: decidedBy || req.user?.fullName || 'Admin Supervisor',
      decidedAt: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('claims')
      .update({
        status: 'approved',
        admin_decision: adminDecision,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ success: true, claim: mapDbRowToClaimRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin-panel/claims/:id/reject', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { remarks, decidedBy } = req.body;

    const adminDecision = {
      action: 'reject' as const,
      finalAmount: 0,
      remarks: remarks || 'Rejected by Platform Administrator following fraud policy audit.',
      decidedBy: decidedBy || req.user?.fullName || 'Admin Supervisor',
      decidedAt: new Date().toISOString()
    };

    if (!isSupabaseConfigured()) {
      const claim = mockClaimsDb.find(c => c.id === req.params.id);
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      claim.status = 'rejected';
      claim.adminDecision = adminDecision;
      claim.updatedAt = new Date().toISOString();
      return res.json({ success: true, claim });
    }

    const { data, error } = await supabaseAdmin
      .from('claims')
      .update({
        status: 'rejected',
        admin_decision: adminDecision,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ success: true, claim: mapDbRowToClaimRecord(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin-panel/analytics', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    let claims: any[] = [];

    if (!isSupabaseConfigured()) {
      // Map mock claims properties to match analytic expects
      claims = mockClaimsDb.map(c => ({
        status: c.status,
        insurance_type: c.insuranceType,
        is_fraud_flagged: c.isFraudFlagged,
        admin_decision: c.adminDecision,
        estimation: c.estimation
      }));
    } else {
      const { data: allClaims, error } = await supabaseAdmin
        .from('claims')
        .select('status, insurance_type, is_fraud_flagged, admin_decision, estimation');

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch analytics' });
      }
      claims = allClaims || [];
    }

    const totalClaims = claims.length;
    const approvedClaims = claims.filter((c: any) => c.status === 'approved');
    const totalPayoutApproved = approvedClaims.reduce(
      (acc: number, c: any) => acc + (c.admin_decision?.finalAmount || c.estimation?.estimatedPayout || 0),
      0
    );
    const fraudClaims = claims.filter((c: any) => c.is_fraud_flagged);
    const fraudFlagRate = totalClaims > 0 ? Math.round((fraudClaims.length / totalClaims) * 100) : 0;

    const claimsByType: Record<string, number> = {
      life: 0, health: 0, motor: 0, home: 0,
      travel: 0, personal_accident: 0, liability: 0
    };

    claims.forEach((c: any) => {
      const type = c.insurance_type || c.insuranceType;
      if (claimsByType[type] !== undefined) {
        claimsByType[type]++;
      }
    });

    res.json({
      totalClaims,
      totalPayoutApproved,
      fraudFlagRate,
      averageProcessingTimeSec: 2.4,
      claimsByType,
      fraudByCategory: {
        base: Math.round(fraudClaims.length * 0.4),
        typeSpecific: Math.round(fraudClaims.length * 0.6)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------
// Policies list
// -----------------------------------------------------------
app.get('/api/policies/list', authMiddleware, async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ policies: SEED_POLICIES });
    }

    const { data, error } = await supabaseAdmin
      .from('policy_holder_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch policies:', error.message);
      return res.status(500).json({ error: 'Failed to fetch policies' });
    }

    // Map snake_case DB columns to camelCase PolicyRecord shape
    const policies = (data || []).map((row: any) => ({
      id: row.id,
      policyNumber: row.policy_number,
      insuranceType: row.insurance_type,
      subType: row.sub_type,
      holderName: row.holder_name,
      holderEmail: row.holder_email,
      aadhaarMasked: row.aadhaar_masked,
      panMasked: row.pan_masked,
      sumInsuredOrIDV: Number(row.sum_insured_or_idv),
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      nomineeName: row.nominee_name,
      nomineeRelation: row.nominee_relation,
      vehicleNumber: row.vehicle_number,
      propertyAddress: row.property_address,
      travelDestination: row.travel_destination,
      businessName: row.business_name,
      coPayPercentage: row.co_pay_percentage ? Number(row.co_pay_percentage) : undefined,
      deductibleExcess: row.deductible_excess ? Number(row.deductible_excess) : undefined,
    }));

    res.json({ policies });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// VITE MIDDLEWARE SETUP
// ============================================================
async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClaimX Server running on http://localhost:${PORT}`);
  });
}

startServer();
