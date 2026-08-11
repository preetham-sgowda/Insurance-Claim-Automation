export type InsuranceType =
  | 'life'
  | 'health'
  | 'motor'
  | 'home'
  | 'travel'
  | 'personal_accident'
  | 'liability';

export type ClaimSubType =
  // Life
  | 'natural_death'
  | 'accidental_death'
  | 'ulip_maturity'
  // Health
  | 'cashless'
  | 'reimbursement'
  | 'critical_illness'
  // Motor
  | 'own_damage'
  | 'total_loss'
  | 'third_party'
  // Home
  | 'structure_damage'
  | 'content_loss_theft'
  // Travel
  | 'medical_emergency'
  | 'trip_cancellation_delay'
  | 'baggage_loss'
  // Personal Accident
  | 'pa_accidental_death'
  | 'ptd' // Permanent Total Disability
  | 'ppd' // Permanent Partial Disability
  | 'ttd' // Temporary Total Disability
  // Liability
  | 'professional_indemnity'
  | 'public_liability'
  | 'errors_omissions';

export type UserRole = 'claimant' | 'agent' | 'admin';

export type ClaimStatus =
  | 'submitted'
  | 'processing'
  | 'failed_ocr'
  | 'flagged_fraud'
  | 'agent_review'
  | 'approved'
  | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  aadhaarMasked?: string;
  panMasked?: string;
  avatarUrl?: string;
  createdAt: string;
}

export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export interface DocumentChecklistItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  fileTypes: string[];
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string | number;
  confidence: number; // 0 - 1
  isMasked?: boolean;
  sourceDoc?: string;
}

export interface FraudSignal {
  id: string;
  category: 'base' | 'type_specific';
  signalName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  passed: boolean;
  scoreImpact: number; // e.g. +25 points
}

export interface EstimationStep {
  label: string;
  amount: number;
  type: 'addition' | 'deduction' | 'cap' | 'formula';
  note: string;
}

export interface ClaimEstimation {
  claimedAmount: number;
  estimatedPayout: number;
  isAutoSettledEligible: boolean;
  deductibleOrCoPay: number;
  depreciationAmount?: number;
  maxPolicyLimit: number;
  calculationBreakdown: EstimationStep[];
  estimationBasis: string;
}

export interface PolicyRecord {
  id: string;
  policyNumber: string;
  insuranceType: InsuranceType;
  subType?: ClaimSubType;
  holderName: string;
  holderEmail: string;
  aadhaarMasked: string;
  panMasked: string;
  sumInsuredOrIDV: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'lapsed';
  nomineeName?: string;
  nomineeRelation?: string;
  vehicleNumber?: string; // Motor
  propertyAddress?: string; // Home
  travelDestination?: string; // Travel
  businessName?: string; // Liability
  coPayPercentage?: number; // Health
  deductibleExcess?: number;
}

export interface ClaimDocument {
  id: string;
  docType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  ocrText?: string;
  uploadedAt: string;
}

export interface AgentReview {
  agentId: string;
  agentName: string;
  recommendedPayout: number;
  recommendation: 'approve' | 'reject' | 'further_investigation';
  overrideRationale?: string;
  reviewTimestamp: string;
}

export interface ClaimRecord {
  id: string;
  claimNumber: string;
  userId: string;
  claimantName: string;
  claimantEmail: string;
  insuranceType: InsuranceType;
  claimSubType: ClaimSubType;
  policyNumber: string;
  claimedAmount: number;
  status: ClaimStatus;
  
  // Pipeline outputs
  extractedData: Record<string, string | number>;
  fieldList: ExtractedField[];
  fraudSignals: FraudSignal[];
  overallFraudScore: number; // 0 - 100
  isFraudFlagged: boolean;
  
  policyVerified: boolean;
  policyMatchDetails?: string;
  
  estimation: ClaimEstimation;
  agentReview?: AgentReview;
  
  adminDecision?: {
    action: 'approve' | 'reject';
    finalAmount: number;
    remarks: string;
    decidedBy: string;
    decidedAt: string;
  };

  documents: ClaimDocument[];
  pdfReportUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAnalytics {
  totalClaims: number;
  totalPayoutApproved: number;
  fraudFlagRate: number; // percentage
  averageProcessingTimeSec: number;
  claimsByType: Record<InsuranceType, number>;
  claimsByStatus: Record<ClaimStatus, number>;
  fraudByCategory: { base: number; typeSpecific: number };
}
