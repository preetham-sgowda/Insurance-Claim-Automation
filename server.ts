import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { runAIClaimPipeline } from './src/services/geminiPipeline.js';
import { SEED_POLICIES } from './src/data/seedPolicies.js';
import { generateClaimPDFReport } from './src/lib/pdfGenerator.js';
import { ClaimRecord } from './src/types/claim.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory memory store for claims & users
let serverClaimsDb: ClaimRecord[] = [];
let serverPoliciesDb = [...SEED_POLICIES];

const app = express();
app.use(express.json({ limit: '20mb' }));

// API ROUTES FIRST

// Auth endpoints
app.post('/api/auth/register', (req, res) => {
  const { email, fullName, role } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  res.json({
    message: 'OTP sent successfully to email.',
    email,
    otp, // Returned for dev testing convenience
    verified: false
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  res.json({
    token: `jwt-token-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    user: {
      id: 'usr-demo-' + Math.random().toString(36).substring(2, 6),
      email,
      fullName: email.split('@')[0],
      role: 'claimant',
      createdAt: new Date().toISOString()
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, role } = req.body;
  res.json({
    token: `jwt-token-login-${Date.now()}`,
    user: {
      id: 'usr-' + (role || 'claimant') + '-01',
      email: email || 'user@claimx.ai',
      fullName: (email || 'user').split('@')[0],
      role: role || 'claimant',
      createdAt: new Date().toISOString()
    }
  });
});

// AI Processing Pipeline Endpoint
app.post('/api/pipeline/process', async (req, res) => {
  try {
    const { insuranceType, claimSubType, policyNumber, claimantName, claimantEmail, claimedAmount, files } = req.body;

    if (!insuranceType || !policyNumber || !claimedAmount) {
      return res.status(400).json({ error: 'Missing required parameters: insuranceType, policyNumber, claimedAmount' });
    }

    const claimRecord = await runAIClaimPipeline({
      insuranceType,
      claimSubType: claimSubType || 'own_damage',
      policyNumber,
      claimantName: claimantName || 'Demo Claimant',
      claimantEmail: claimantEmail || 'claimant@example.com',
      claimedAmount: Number(claimedAmount),
      files: files || []
    });

    serverClaimsDb.unshift(claimRecord);

    res.json({
      success: true,
      claim: claimRecord
    });
  } catch (err: any) {
    console.error('Error in AI Pipeline:', err);
    res.status(500).json({ error: err.message || 'Failed to process claim in AI pipeline' });
  }
});

// Claims Endpoints
app.get('/api/claims/list', (req, res) => {
  const { insurance_type, role, email } = req.query;
  let result = [...serverClaimsDb];

  if (insurance_type && typeof insurance_type === 'string') {
    result = result.filter(c => c.insuranceType === insurance_type);
  }

  res.json({ claims: result, total: result.length });
});

app.get('/api/claims/:id', (req, res) => {
  const claim = serverClaimsDb.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }
  res.json({ claim });
});

app.patch('/api/claims/:id/status', (req, res) => {
  const { status } = req.body;
  const claim = serverClaimsDb.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }
  claim.status = status;
  claim.updatedAt = new Date().toISOString();
  res.json({ claim });
});

// PDF Settlement Report Generation
app.get('/api/reports/:id/download', (req, res) => {
  const claim = serverClaimsDb.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found for PDF generation' });
  }
  const pdfDataUri = generateClaimPDFReport(claim);
  res.json({ pdfDataUri, claimNumber: claim.claimNumber });
});

// Agent Queue & Review Endpoints
app.get('/api/agent/claims', (req, res) => {
  const { insurance_type, fraud_only } = req.query;
  let queue = serverClaimsDb.filter(c => c.status === 'agent_review' || c.status === 'flagged_fraud' || c.status === 'submitted');

  if (insurance_type && typeof insurance_type === 'string') {
    queue = queue.filter(c => c.insuranceType === insurance_type);
  }
  if (fraud_only === 'true') {
    queue = queue.filter(c => c.isFraudFlagged);
  }

  res.json({ queue, total: queue.length });
});

app.post('/api/agent/claims/:id/review', (req, res) => {
  const { recommendedPayout, recommendation, overrideRationale, agentName } = req.body;
  const claim = serverClaimsDb.find(c => c.id === req.params.id);
  if (!claim) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  claim.agentReview = {
    agentId: 'agt-agent-01',
    agentName: agentName || 'Senior Agent Specialist',
    recommendedPayout: Number(recommendedPayout),
    recommendation,
    overrideRationale,
    reviewTimestamp: new Date().toISOString()
  };

  claim.status = recommendation === 'approve' ? 'approved' : recommendation === 'reject' ? 'rejected' : 'agent_review';
  claim.updatedAt = new Date().toISOString();

  res.json({ success: true, claim });
});

// Admin Panel Endpoints
app.get('/api/admin-panel/claims', (req, res) => {
  const { insurance_type, status } = req.query;
  let claims = [...serverClaimsDb];

  if (insurance_type && typeof insurance_type === 'string') {
    claims = claims.filter(c => c.insuranceType === insurance_type);
  }
  if (status && typeof status === 'string') {
    claims = claims.filter(c => c.status === status);
  }

  res.json({ claims, total: claims.length });
});

app.patch('/api/admin-panel/claims/:id/approve', (req, res) => {
  const { finalAmount, remarks, decidedBy } = req.body;
  const claim = serverClaimsDb.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  claim.status = 'approved';
  claim.adminDecision = {
    action: 'approve',
    finalAmount: Number(finalAmount || claim.estimation.estimatedPayout),
    remarks: remarks || 'Approved by Platform Administrator.',
    decidedBy: decidedBy || 'Admin Supervisor',
    decidedAt: new Date().toISOString()
  };
  claim.updatedAt = new Date().toISOString();

  res.json({ success: true, claim });
});

app.patch('/api/admin-panel/claims/:id/reject', (req, res) => {
  const { remarks, decidedBy } = req.body;
  const claim = serverClaimsDb.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  claim.status = 'rejected';
  claim.adminDecision = {
    action: 'reject',
    finalAmount: 0,
    remarks: remarks || 'Rejected by Platform Administrator following fraud policy audit.',
    decidedBy: decidedBy || 'Admin Supervisor',
    decidedAt: new Date().toISOString()
  };
  claim.updatedAt = new Date().toISOString();

  res.json({ success: true, claim });
});

app.get('/api/admin-panel/analytics', (req, res) => {
  const totalClaims = serverClaimsDb.length;
  const approvedClaims = serverClaimsDb.filter(c => c.status === 'approved');
  const totalPayoutApproved = approvedClaims.reduce((acc, c) => acc + (c.adminDecision?.finalAmount || c.estimation.estimatedPayout), 0);
  const fraudClaims = serverClaimsDb.filter(c => c.isFraudFlagged);
  const fraudFlagRate = totalClaims > 0 ? Math.round((fraudClaims.length / totalClaims) * 100) : 0;

  const claimsByType: Record<string, number> = {
    life: 0,
    health: 0,
    motor: 0,
    home: 0,
    travel: 0,
    personal_accident: 0,
    liability: 0
  };

  serverClaimsDb.forEach(c => {
    if (claimsByType[c.insuranceType] !== undefined) {
      claimsByType[c.insuranceType]++;
    }
  });

  res.json({
    totalClaims,
    totalPayoutApproved,
    fraudFlagRate,
    averageProcessingTimeSec: 2.4,
    claimsByType,
    fraudByCategory: { base: Math.round(fraudClaims.length * 0.4), typeSpecific: Math.round(fraudClaims.length * 0.6) }
  });
});

// Policies list
app.get('/api/policies/list', (req, res) => {
  res.json({ policies: serverPoliciesDb });
});

// VITE MIDDLEWARE SETUP
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
