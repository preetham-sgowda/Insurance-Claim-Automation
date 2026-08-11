import jsPDF from 'jspdf';
import { ClaimRecord } from '../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../data/insuranceConfig';

export function generateClaimPDFReport(claim: ClaimRecord): string {
  const doc = new jsPDF();
  const config = INSURANCE_TYPES_CONFIG[claim.insuranceType];

  // Header Colors & Styling
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 35, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ClaimX Settlement Report', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Multi-Line AI Automation Report • Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  // Status Badge
  doc.setFillColor(claim.status === 'approved' ? 16 : 220, claim.status === 'approved' ? 185 : 38, claim.status === 'approved' ? 129 : 38);
  doc.roundedRect(150, 10, 46, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(claim.status.toUpperCase(), 155, 19);

  let y = 48;

  // Claim Summary Box
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 38, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 38, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Claim Ref: ${claim.claimNumber}`, 20, y + 10);
  doc.text(`Insurance Line: ${config.title}`, 110, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Claimant: ${claim.claimantName} (${claim.claimantEmail})`, 20, y + 19);
  doc.text(`Policy No: ${claim.policyNumber}`, 110, y + 19);
  doc.text(`Claim Sub-type: ${claim.claimSubType.replace(/_/g, ' ').toUpperCase()}`, 20, y + 28);
  doc.text(`Submission Date: ${new Date(claim.createdAt).toLocaleString()}`, 110, y + 28);

  y += 48;

  // Financial Estimation Breakdown Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Payout & Estimation Strategy Breakdown', 14, y);
  y += 8;

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 45, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, y, 182, 45, 'S');

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Claimed Amount:`, 20, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${claim.claimedAmount.toLocaleString('en-IN')}`, 75, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(`Deductible / Co-pay:`, 20, y + 21);
  doc.text(`-Rs. ${claim.estimation.deductibleOrCoPay.toLocaleString('en-IN')}`, 75, y + 21);

  if (claim.estimation.depreciationAmount) {
    doc.text(`Depreciation Deduction:`, 20, y + 30);
    doc.text(`-Rs. ${claim.estimation.depreciationAmount.toLocaleString('en-IN')}`, 75, y + 30);
  } else {
    doc.text(`Policy Max Limit:`, 20, y + 30);
    doc.text(`Rs. ${claim.estimation.maxPolicyLimit.toLocaleString('en-IN')}`, 75, y + 30);
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(20, y + 34, 188, y + 34);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Final Calculated Payout:`, 20, y + 41);
  doc.setTextColor(16, 185, 129);
  doc.text(`Rs. ${claim.estimation.estimatedPayout.toLocaleString('en-IN')}`, 130, y + 41);

  y += 55;

  // AI Verification & Fraud Risk Audit
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('AI Verification & Fraud Risk Audit', 14, y);
  y += 8;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Policy Database Status: ${claim.policyVerified ? 'Verified Active Policy Match' : 'Unverified Policy'}`, 14, y);
  doc.text(`Overall Fraud Score: ${claim.overallFraudScore} / 100 (${claim.isFraudFlagged ? 'FLAGGED FOR AGENT REVIEW' : 'LOW RISK PASSED'})`, 100, y);
  y += 10;

  // Fraud signals table header
  doc.setFillColor(226, 232, 240);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Signal Name', 18, y + 5.5);
  doc.text('Category', 85, y + 5.5);
  doc.text('Severity', 125, y + 5.5);
  doc.text('Status', 165, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');

  claim.fraudSignals.slice(0, 5).forEach((sig) => {
    doc.text(sig.signalName.slice(0, 32), 18, y + 5);
    doc.text(sig.category === 'type_specific' ? 'Type-Specific' : 'Base', 85, y + 5);
    doc.text(sig.severity.toUpperCase(), 125, y + 5);
    doc.setTextColor(sig.passed ? 16 : 220, sig.passed ? 185 : 38, sig.passed ? 129 : 38);
    doc.text(sig.passed ? 'PASSED' : 'FLAGGED', 165, y + 5);
    doc.setTextColor(15, 23, 42);
    y += 7;
  });

  y += 12;

  // Agent / Admin Audit Notes
  if (claim.agentReview || claim.adminDecision) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Human Overrides & Review Rationale', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (claim.agentReview) {
      doc.text(`Agent Review (${claim.agentReview.agentName}): Recommended Rs. ${claim.agentReview.recommendedPayout.toLocaleString('en-IN')} - ${claim.agentReview.recommendation}`, 14, y);
      if (claim.agentReview.overrideRationale) {
        y += 5;
        doc.text(`Rationale: ${claim.agentReview.overrideRationale}`, 14, y);
      }
      y += 8;
    }
    if (claim.adminDecision) {
      doc.text(`Admin Final Action (${claim.adminDecision.decidedBy}): ${claim.adminDecision.action.toUpperCase()} for Rs. ${claim.adminDecision.finalAmount.toLocaleString('en-IN')}`, 14, y);
      y += 5;
      doc.text(`Remarks: ${claim.adminDecision.remarks}`, 14, y);
      y += 8;
    }
  }

  // Footer / Seal
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 275, 196, 275);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('ClaimX Automated Multi-Line Insurance System • Confidential & Proprietary Document', 14, 282);
  doc.text('Verification Code: CX-VERIFIED-' + Math.random().toString(36).substring(2, 9).toUpperCase(), 130, 282);

  return doc.output('datauristring');
}
