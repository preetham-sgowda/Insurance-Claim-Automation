import React, { useState } from 'react';
import { ClaimRecord, formatINR } from '../../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../../data/insuranceConfig';
import { generateClaimPDFReport } from '../../lib/pdfGenerator';
import { Download, ShieldAlert, FileText, Lock, Building, IndianRupee, Award } from 'lucide-react';

interface ClaimDetailModalProps {
  claim: ClaimRecord | null;
  onClose: () => void;
}

export const ClaimDetailModal: React.FC<ClaimDetailModalProps> = ({ claim, onClose }) => {
  const [downloading, setDownloading] = useState(false);

  if (!claim) return null;

  const config = INSURANCE_TYPES_CONFIG[claim.insuranceType];

  const handleDownloadPDF = () => {
    setDownloading(true);
    try {
      const dataUri = generateClaimPDFReport(claim);
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = `${claim.claimNumber}_Settlement_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#E2B59A]/60 rounded-2xl max-w-4xl w-full my-8 shadow-xl overflow-hidden text-[#2C221E] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#FAF7F2] border-b border-[#E2B59A]/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${config.badgeColor}`}>
              {config.title}
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#2C221E] flex items-center space-x-2">
                <span>Claim Ref: {claim.claimNumber}</span>
              </h2>
              <p className="text-xs text-[#957C62]">
                Submitted by {claim.claimantName} • {new Date(claim.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs shadow-xs transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generating PDF...' : 'Download PDF Report'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-[#957C62] hover:text-[#2C221E] text-lg font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Status & Financial Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
              <span className="text-[11px] font-medium text-[#957C62] block mb-1">Status</span>
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                claim.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : claim.status === 'rejected'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-[#FFE1AF] text-[#8F6218] border border-[#E2B59A]'
              }`}>
                {claim.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
              <span className="text-[11px] font-medium text-[#957C62] block mb-1">Claimed Amount</span>
              <span className="text-lg font-bold text-[#2C221E]">{formatINR(claim.claimedAmount)}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
              <span className="text-[11px] font-medium text-[#957C62] block mb-1">Calculated Payout</span>
              <span className="text-lg font-extrabold text-emerald-700">{formatINR(claim.estimation.estimatedPayout)}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
              <span className="text-[11px] font-medium text-[#957C62] block mb-1">Fraud Risk Score</span>
              <div className="flex items-center space-x-2">
                <span className={`text-lg font-bold ${claim.isFraudFlagged ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {claim.overallFraudScore} / 100
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  claim.isFraudFlagged ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {claim.isFraudFlagged ? 'Flagged' : 'Low Risk'}
                </span>
              </div>
            </div>
          </div>

          {/* Policy & Claimant Info */}
          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40 space-y-2">
            <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider flex items-center space-x-1.5">
              <Building className="w-3.5 h-3.5 text-[#B77466]" />
              <span>Policy & Verification Match</span>
            </h3>
            <p className="text-xs text-[#2C221E] leading-relaxed">
              {claim.policyMatchDetails}
            </p>
          </div>

          {/* Estimation Strategy Breakdown */}
          <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40 space-y-3">
            <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider flex items-center space-x-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-[#B77466]" />
              <span>Type-Specific Estimation Breakdown ({config.title})</span>
            </h3>

            <div className="space-y-2">
              {claim.estimation.calculationBreakdown.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-[#E2B59A]/30">
                  <div className="flex items-center space-x-2">
                    <span className="text-[#957C62]">•</span>
                    <span className="font-medium text-[#2C221E]">{step.label}</span>
                    <span className="text-[10px] text-[#957C62]">({step.note})</span>
                  </div>
                  <span className={`font-mono font-semibold ${
                    step.type === 'deduction' ? 'text-rose-700' : step.type === 'cap' ? 'text-[#8F6218]' : 'text-[#2C221E]'
                  }`}>
                    {step.type === 'deduction' ? '-' : ''}{formatINR(step.amount)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#957C62] italic pt-1">
              Basis: {claim.estimation.estimationBasis}
            </p>
          </div>

          {/* Extracted Fields */}
          <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40 space-y-3">
            <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-[#B77466]" />
              <span>AI Extracted Fields (Gemini Flash Engine)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {claim.fieldList.map((f, i) => (
                <div key={i} className="p-3 rounded-lg bg-white border border-[#E2B59A]/40 flex items-center justify-between">
                  <div>
                    <span className="text-[#957C62] text-[11px] block">{f.label}</span>
                    <span className="font-semibold text-[#2C221E] flex items-center space-x-1 mt-0.5">
                      <span>{typeof f.value === 'number' ? formatINR(f.value) : f.value}</span>
                      {f.isMasked && <Lock className="w-3 h-3 text-[#B77466] ml-1" title="PII Masked at rest" />}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono bg-[#FFE1AF]/40 text-[#8F6218] px-2 py-0.5 rounded border border-[#E2B59A]/40">
                    {Math.round(f.confidence * 100)}% conf
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fraud Signals Audit Trail */}
          <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40 space-y-3">
            <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#B77466]" />
              <span>Fraud Risk Audit Signals (Base + {config.title} Signals)</span>
            </h3>

            <div className="space-y-2">
              {claim.fraudSignals.map((sig, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-white border border-[#E2B59A]/40 flex items-start justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#2C221E]">{sig.signalName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#957C62] border border-[#E2B59A]/30">
                        {sig.category === 'type_specific' ? 'Type-Specific' : 'Base'}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-[#B77466]">
                        {sig.severity} severity
                      </span>
                    </div>
                    <p className="text-[#957C62] text-[11px]">{sig.description}</p>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
                    sig.passed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {sig.passed ? 'PASSED' : `FLAGGED (+${sig.scoreImpact})`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent & Admin Overrides */}
          {(claim.agentReview || claim.adminDecision) && (
            <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40 space-y-3">
              <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider flex items-center space-x-1.5">
                <Award className="w-3.5 h-3.5 text-[#B77466]" />
                <span>Human Review & Decision History</span>
              </h3>

              {claim.agentReview && (
                <div className="p-3 rounded-lg bg-white border border-[#E2B59A]/40 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-[#2C221E]">
                    <span>Agent Review ({claim.agentReview.agentName})</span>
                    <span className="text-emerald-700">Recommended: {formatINR(claim.agentReview.recommendedPayout)}</span>
                  </div>
                  <p className="text-[#957C62]">Recommendation: <strong className="text-[#2C221E] uppercase">{claim.agentReview.recommendation}</strong></p>
                  {claim.agentReview.overrideRationale && (
                    <p className="text-[#2C221E] italic">"Rationale: {claim.agentReview.overrideRationale}"</p>
                  )}
                </div>
              )}

              {claim.adminDecision && (
                <div className="p-3 rounded-lg bg-white border border-[#E2B59A]/40 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-[#2C221E]">
                    <span>Admin Action ({claim.adminDecision.decidedBy})</span>
                    <span className="text-[#B77466] font-extrabold">{claim.adminDecision.action.toUpperCase()} - {formatINR(claim.adminDecision.finalAmount)}</span>
                  </div>
                  <p className="text-[#2C221E]">"Remarks: {claim.adminDecision.remarks}"</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#E2B59A]/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-semibold text-xs transition-all"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};
