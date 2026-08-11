import React, { useState } from 'react';
import { ClaimRecord, InsuranceType, formatINR } from '../../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../../data/insuranceConfig';
import {
  Award,
  ShieldAlert,
  FileText,
  Send,
  Filter,
  CheckCircle,
  AlertOctagon
} from 'lucide-react';

interface AgentDashboardProps {
  claims: ClaimRecord[];
  onReviewSubmitted: (claimId: string, review: { recommendedPayout: number; recommendation: 'approve' | 'reject' | 'further_investigation'; overrideRationale: string }) => void;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ claims, onReviewSubmitted }) => {
  const [selectedInsuranceFilter, setSelectedInsuranceFilter] = useState<InsuranceType | 'all'>('all');
  const [fraudOnlyFilter, setFraudOnlyFilter] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  // Form State for Review
  const [recommendedAmount, setRecommendedAmount] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<'approve' | 'reject' | 'further_investigation'>('approve');
  const [rationale, setRationale] = useState<string>('');

  // Filter Queue
  const queue = claims.filter((claim) => {
    const isPendingQueue = claim.status === 'agent_review' || claim.status === 'flagged_fraud' || claim.status === 'submitted' || claim.status === 'approved';
    const matchesLine = selectedInsuranceFilter === 'all' || claim.insuranceType === selectedInsuranceFilter;
    const matchesFraud = !fraudOnlyFilter || claim.isFraudFlagged;
    return isPendingQueue && matchesLine && matchesFraud;
  });

  const activeClaim = claims.find(c => c.id === selectedClaimId) || queue[0] || claims[0];

  const handleSelectClaim = (claim: ClaimRecord) => {
    setSelectedClaimId(claim.id);
    setRecommendedAmount(claim.estimation.estimatedPayout);
    setRecommendation('approve');
    setRationale('');
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClaim) return;

    onReviewSubmitted(activeClaim.id, {
      recommendedPayout: Number(recommendedAmount),
      recommendation,
      overrideRationale: rationale || 'Verified by Senior Claims Agent.'
    });

    setRationale('');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#B77466] to-[#957C62] border border-[#E2B59A]/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white">
        <div>
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8F6218] bg-[#FFE1AF] px-3 py-1 rounded-full border border-[#E2B59A]">
              Agent Workbench
            </span>
            <span className="text-xs font-medium text-[#FFE1AF]">Human-in-the-Loop Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Agent Claim Verification & Audit</h1>
          <p className="text-sm sm:text-base text-white/95 max-w-2xl mt-2 leading-relaxed">
            Validate AI-extracted fields, investigate type-specific fraud signals, adjust estimation payouts with rationale, and submit binding recommendations.
          </p>
        </div>

        <div className="flex items-center space-x-4 bg-white/10 p-4 rounded-2xl backdrop-blur-xs border border-white/20">
          <div className="text-center px-3 border-r border-white/20">
            <span className="text-xs text-[#FFE1AF] uppercase font-extrabold block">Pending Review</span>
            <span className="text-2xl font-black text-white">{queue.length}</span>
          </div>
          <div className="text-center px-3">
            <span className="text-xs text-[#FFE1AF] uppercase font-extrabold block">Fraud Flagged</span>
            <span className="text-2xl font-black text-rose-200">{queue.filter(c => c.isFraudFlagged).length}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2B59A]/40 flex flex-wrap items-center justify-between gap-4 text-sm shadow-xs">
        <div className="flex items-center space-x-3 overflow-x-auto">
          <Filter className="w-4 h-4 text-[#B77466]" />
          <span className="text-[#2C221E] font-bold whitespace-nowrap">Filter Line:</span>
          <select
            value={selectedInsuranceFilter}
            onChange={(e) => setSelectedInsuranceFilter(e.target.value as any)}
            className="px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] font-semibold text-sm focus:outline-none focus:border-[#B77466]"
          >
            <option value="all">All 7 Insurance Products</option>
            {Object.keys(INSURANCE_TYPES_CONFIG).map((t) => (
              <option key={t} value={t}>
                {INSURANCE_TYPES_CONFIG[t as InsuranceType].title}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center space-x-2.5 text-[#2C221E] cursor-pointer font-bold text-sm">
          <input
            type="checkbox"
            checked={fraudOnlyFilter}
            onChange={(e) => setFraudOnlyFilter(e.target.checked)}
            className="w-4 h-4 rounded bg-[#FAF7F2] border-[#E2B59A] text-[#B77466] focus:ring-0"
          />
          <span>Show Flagged Fraud Cases Only</span>
        </label>
      </div>

      {/* Side-by-Side Review Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Claims Queue */}
        <div className="lg:col-span-4 bg-white border border-[#E2B59A]/40 rounded-3xl p-5 space-y-4 max-h-[800px] overflow-y-auto shadow-xs">
          <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider px-1">
            Review Queue ({queue.length})
          </h3>

          {queue.length === 0 ? (
            <div className="p-12 text-center text-[#957C62] text-sm font-medium">
              No claims in queue for selected line.
            </div>
          ) : (
            queue.map((c) => {
              const cfg = INSURANCE_TYPES_CONFIG[c.insuranceType];
              const isSelected = activeClaim?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectClaim(c)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2.5 ${
                    isSelected
                      ? 'bg-[#FFE1AF]/50 border-[#B77466] shadow-sm text-[#2C221E]'
                      : 'bg-[#FAF7F2] border-[#E2B59A]/40 text-[#2C221E] hover:border-[#E2B59A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-[#2C221E]">{c.claimNumber}</span>
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${cfg.badgeColor}`}>
                      {cfg.title}
                    </span>
                  </div>

                  <div className="text-xs text-[#957C62] flex items-center justify-between">
                    <span className="font-bold text-[#2C221E]">{c.claimantName}</span>
                    <span className="font-mono font-bold text-[#2C221E]">{formatINR(c.claimedAmount)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E2B59A]/30">
                    <span className={`font-extrabold ${c.isFraudFlagged ? 'text-rose-700' : 'text-emerald-700'}`}>
                      Risk Score: {c.overallFraudScore}/100
                    </span>
                    <span className="uppercase text-[#8F6218] font-bold">{c.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: In-Depth Claim Inspection & Override Controls */}
        {activeClaim ? (
          <div className="lg:col-span-8 space-y-6">
            
            {/* Header Banner */}
            <div className="p-6 rounded-3xl bg-white border border-[#E2B59A]/40 shadow-xs flex flex-wrap items-center justify-between gap-4 text-[#2C221E]">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-black">{activeClaim.claimNumber}</h2>
                  <span className={`px-3 py-1 rounded-lg text-xs font-extrabold border ${INSURANCE_TYPES_CONFIG[activeClaim.insuranceType].badgeColor}`}>
                    {INSURANCE_TYPES_CONFIG[activeClaim.insuranceType].title}
                  </span>
                </div>
                <p className="text-sm text-[#957C62] mt-1">
                  Policy: <span className="text-[#2C221E] font-mono font-bold">{activeClaim.policyNumber}</span> • Claimant: <strong className="text-[#2C221E]">{activeClaim.claimantName}</strong>
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#957C62] uppercase font-bold block">AI Calculated Payout</span>
                <span className="text-2xl font-black text-emerald-700">{formatINR(activeClaim.estimation.estimatedPayout)}</span>
              </div>
            </div>

            {/* AI Extracted Fields & Policy Match */}
            <div className="p-6 rounded-3xl bg-white border border-[#E2B59A]/40 space-y-4 text-sm shadow-xs">
              <h3 className="font-bold text-[#957C62] uppercase tracking-wider flex items-center space-x-2 text-xs">
                <FileText className="w-4 h-4 text-[#B77466]" />
                <span>Extracted Data & Verification</span>
              </h3>

              <p className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E2B59A]/40 text-[#2C221E] text-sm leading-relaxed font-medium">
                {activeClaim.policyMatchDetails}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeClaim.fieldList.map((f, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-[#957C62] font-semibold block">{f.label}</span>
                      <span className="font-bold text-sm text-[#2C221E]">
                        {typeof f.value === 'number' ? formatINR(f.value) : f.value}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#8F6218] bg-[#FFE1AF]/60 px-2 py-0.5 rounded-md border border-[#E2B59A]/40">
                      {Math.round(f.confidence * 100)}% Match
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fraud Signals Inspection */}
            <div className="p-6 rounded-3xl bg-white border border-[#E2B59A]/40 space-y-4 text-sm shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#957C62] uppercase tracking-wider text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-[#B77466]" />
                  <span>Fraud Audit Signals ({INSURANCE_TYPES_CONFIG[activeClaim.insuranceType].title})</span>
                </h3>
                <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                  activeClaim.isFraudFlagged ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Risk Score: {activeClaim.overallFraudScore} / 100
                </span>
              </div>

              <div className="space-y-2.5">
                {activeClaim.fraudSignals.map((sig, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2B59A]/40 flex justify-between items-start gap-4">
                    <div>
                      <span className="font-bold text-sm text-[#2C221E] block">{sig.signalName}</span>
                      <span className="text-xs text-[#957C62] font-medium leading-relaxed mt-0.5 block">{sig.description}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase whitespace-nowrap ${
                      sig.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {sig.passed ? 'Passed' : `Flagged (+${sig.scoreImpact})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Action & Override Submission Panel */}
            <form onSubmit={handleSubmitReview} className="p-6 rounded-3xl bg-white border border-[#E2B59A]/40 space-y-4 text-sm shadow-xs">
              <h3 className="font-bold text-[#957C62] uppercase tracking-wider text-xs flex items-center space-x-2">
                <Award className="w-4 h-4 text-[#B77466]" />
                <span>Submit Agent Recommendation & Override</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#957C62] mb-1.5">
                    Recommended Payout Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={recommendedAmount}
                    onChange={(e) => setRecommendedAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] font-black text-base focus:outline-none focus:border-[#B77466]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#957C62] mb-1.5">
                    Recommendation Action
                  </label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] font-bold text-sm focus:outline-none focus:border-[#B77466]"
                  >
                    <option value="approve">Recommend Approval</option>
                    <option value="reject">Recommend Rejection</option>
                    <option value="further_investigation">Request Further Investigation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#957C62] mb-1.5">
                  Override / Review Rationale
                </label>
                <textarea
                  rows={3}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Provide detailed justification for payout adjustment or fraud clearance..."
                  className="w-full p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-sm focus:outline-none focus:border-[#B77466]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-extrabold text-sm shadow-xs transition-all flex items-center space-x-2 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Agent Recommendation</span>
                </button>
              </div>
            </form>

          </div>
        ) : (
          <div className="lg:col-span-8 p-16 bg-white border border-[#E2B59A]/40 rounded-3xl text-center text-[#957C62] text-sm font-medium">
            Select a claim from the queue to start verification.
          </div>
        )}

      </div>

    </div>
  );
};
