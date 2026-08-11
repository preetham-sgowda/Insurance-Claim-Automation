import { InsuranceType } from '../types/claim.js';

/**
 * Result of content-based document type validation.
 */
export interface ValidationResult {
  /** Whether the document content is consistent with the expected type */
  isValid: boolean;
  /** What we think the document actually is, based on content */
  matchedDocType: string;
  /** What the upload slot expected */
  expectedDocType: string;
  /** Confidence of the match (0-1) */
  confidence: number;
  /** Human-readable explanation */
  reason: string;
  /** Keywords that were found in the document */
  matchedKeywords: string[];
}

/**
 * Keyword sets for each document type.
 * We check for presence of these keywords/phrases in the extracted text.
 * A document passes validation if it contains at least MIN_KEYWORD_MATCHES keywords.
 */
const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
  // Life Insurance Documents
  death_cert: ['death', 'certificate', 'deceased', 'cause of death', 'municipal', 'registrar', 'date of death'],
  policy_doc: ['policy', 'premium', 'sum insured', 'sum assured', 'nominee', 'insured', 'policy number', 'cover'],
  aadhaar_nominee: ['aadhaar', 'unique identification', 'uidai', 'enrolment', 'identity'],
  aadhaar: ['aadhaar', 'unique identification', 'uidai', 'enrolment', 'identity'],
  pan_nominee: ['income tax', 'permanent account', 'pan', 'department'],
  pan: ['income tax', 'permanent account', 'pan', 'department'],
  bank_proof: ['bank', 'account', 'ifsc', 'branch', 'cheque', 'passbook', 'savings'],
  fir_record: ['fir', 'first information report', 'police', 'station', 'complainant', 'accused', 'offence'],
  hospital_death_summary: ['hospital', 'discharge', 'summary', 'diagnosis', 'admitted', 'patient', 'doctor', 'physician'],

  // Health Insurance Documents
  discharge_summary: ['discharge', 'hospital', 'diagnosis', 'admitted', 'patient', 'treatment', 'doctor'],
  hospital_bills: ['bill', 'invoice', 'hospital', 'charges', 'total', 'amount', 'receipt', 'payment'],
  prescription: ['prescription', 'medicine', 'dosage', 'tablet', 'doctor', 'rx', 'medication'],
  diagnostic_reports: ['report', 'test', 'lab', 'pathology', 'radiology', 'blood', 'scan', 'x-ray', 'mri'],

  // Motor Insurance Documents
  driving_license: ['driving', 'license', 'licence', 'motor vehicle', 'transport', 'valid', 'class'],
  rc_book: ['registration', 'certificate', 'vehicle', 'chassis', 'engine', 'owner', 'rto'],
  garage_estimate: ['estimate', 'repair', 'vehicle', 'labour', 'parts', 'garage', 'workshop', 'damage'],
  accident_photos: [], // Images — skip keyword validation for photo evidence

  // Home Insurance Documents
  property_ownership: ['property', 'deed', 'ownership', 'title', 'registration', 'land', 'building'],
  damage_assessment: ['damage', 'assessment', 'survey', 'loss', 'repair', 'estimate', 'peril'],
  contractor_estimate: ['contractor', 'estimate', 'repair', 'construction', 'cost', 'material', 'labour'],

  // Travel Insurance Documents
  travel_tickets: ['ticket', 'booking', 'flight', 'airline', 'passenger', 'departure', 'arrival', 'itinerary'],
  medical_receipts: ['receipt', 'medical', 'hospital', 'clinic', 'treatment', 'payment', 'bill'],
  police_report_travel: ['police', 'report', 'theft', 'loss', 'complaint', 'stolen'],

  // Personal Accident Documents
  accident_report: ['accident', 'report', 'injury', 'incident', 'witness', 'hospital'],
  disability_cert: ['disability', 'certificate', 'permanent', 'impairment', 'medical board', 'assessment'],

  // Liability Documents
  legal_notice: ['legal', 'notice', 'demand', 'claim', 'liability', 'court', 'advocate', 'indemnity'],
  professional_cert: ['professional', 'certificate', 'registration', 'license', 'practice', 'qualification'],
};

const MIN_KEYWORD_MATCHES = 2;

/**
 * Validate that the extracted text content matches the expected document type.
 *
 * @param extractedText - Text extracted from the document via PDF parse or OCR
 * @param expectedDocType - The document type ID from the upload slot (e.g. 'death_cert')
 * @param insuranceType - The insurance product line (for context)
 * @returns Validation result with match details
 */
export function validateDocumentContent(
  extractedText: string,
  expectedDocType: string,
  insuranceType: InsuranceType
): ValidationResult {
  const textLower = extractedText.toLowerCase();

  // If no text was extracted, we can't validate content
  if (!textLower || textLower.length < 10) {
    return {
      isValid: false,
      matchedDocType: 'unknown',
      expectedDocType,
      confidence: 0,
      reason: 'No meaningful text could be extracted from this document for validation.',
      matchedKeywords: [],
    };
  }

  // Get expected keywords for this doc type
  const expectedKeywords = DOC_TYPE_KEYWORDS[expectedDocType] || [];

  // If no keywords defined for this doc type (e.g. photos), skip validation
  if (expectedKeywords.length === 0) {
    return {
      isValid: true,
      matchedDocType: expectedDocType,
      expectedDocType,
      confidence: 0.7,
      reason: `No keyword validation rules defined for document type "${expectedDocType}". Accepted as-is.`,
      matchedKeywords: [],
    };
  }

  // Count keyword matches for the expected type
  const matchedKeywords = expectedKeywords.filter(kw => textLower.includes(kw.toLowerCase()));
  const matchRatio = matchedKeywords.length / expectedKeywords.length;

  // Also check all other doc types to see if this document better matches something else
  let bestAlternativeType = '';
  let bestAlternativeScore = 0;

  for (const [docType, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
    if (docType === expectedDocType || keywords.length === 0) continue;

    const altMatches = keywords.filter(kw => textLower.includes(kw.toLowerCase()));
    const altScore = altMatches.length / keywords.length;

    if (altScore > bestAlternativeScore) {
      bestAlternativeScore = altScore;
      bestAlternativeType = docType;
    }
  }

  const isValid = matchedKeywords.length >= MIN_KEYWORD_MATCHES;
  const confidence = Math.min(matchRatio * 1.2, 1.0); // Slight boost, capped at 1.0

  if (isValid) {
    return {
      isValid: true,
      matchedDocType: expectedDocType,
      expectedDocType,
      confidence,
      reason: `Document content matches expected type "${expectedDocType}" (${matchedKeywords.length}/${expectedKeywords.length} keywords found).`,
      matchedKeywords,
    };
  }

  // Document doesn't match expected type — check if it matches something else
  const reason = bestAlternativeScore > matchRatio && bestAlternativeScore >= 0.3
    ? `Document content does not match expected type "${expectedDocType}" (${matchedKeywords.length}/${expectedKeywords.length} keywords). Content appears to be more consistent with "${bestAlternativeType}" instead.`
    : `Document content does not match expected type "${expectedDocType}" (only ${matchedKeywords.length}/${expectedKeywords.length} keywords found). Please verify you uploaded the correct document.`;

  return {
    isValid: false,
    matchedDocType: bestAlternativeScore > matchRatio ? bestAlternativeType : 'unknown',
    expectedDocType,
    confidence,
    reason,
    matchedKeywords,
  };
}
