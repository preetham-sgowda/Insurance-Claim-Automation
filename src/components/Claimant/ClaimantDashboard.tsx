import React, { useState } from 'react';
import { ClaimRecord, InsuranceType, formatINR } from '../../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../../data/insuranceConfig';
import { ClaimDetailModal } from './ClaimDetailModal';
import { NewClaimWizard } from './NewClaimWizard';
import {
  PlusCircle,
  Search,
  FileText,
  Eye,
  Clock,
  AlertTriangle,
  IndianRupee,
  Layers,
  Filter
} from 'lucide-react';

interface ClaimantDashboardProps {
  claims: ClaimRecord[];
  onClaimSubmitted: (claim: ClaimRecord) => void;
  selectedFilter: InsuranceType | 'all';
  onFilterChange: (type: InsuranceType | 'all') => void;
}

export const ClaimantDashboard: React.FC<ClaimantDashboardProps> = ({
  claims,
  onClaimSubmitted,
  selectedFilter,
  onFilterChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Filtered claims
  const filteredClaims = claims.filter((claim) => {
    const matchesLine = selectedFilter === 'all' || claim.insuranceType === selectedFilter;
    const matchesSearch =
      claim.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.policyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimantName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLine && matchesSearch;
  });

  // Calculate Metrics
  const totalClaimsCount = claims.length;
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const totalPayoutCalculated = approvedClaims.reduce((acc, c) => acc + (c.adminDecision?.finalAmount || c.estimation.estimatedPayout), 0);
  const activeProcessingCount = claims.filter(c => c.status === 'submitted' || c.status === 'agent_review' || c.status === 'processing').length;
  const flaggedCount = claims.filter(c => c.isFraudFlagged || c.status === 'flagged_fraud').length;

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#B77466] to-[#957C62] border border-[#E2B59A]/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white">
        <div>
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8F6218] bg-[#FFE1AF] px-3 py-1 rounded-full border border-[#E2B59A]">
              Claimant Portal
            </span>
            <span className="text-xs font-medium text-[#FFE1AF]">7 Supported Products</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Multi-Line Insurance Claims</h1>
          <p className="text-sm sm:text-base text-white/95 max-w-2xl mt-2 leading-relaxed font-normal">
            Submit, track, and manage claims across Life, Health, Motor, Home, Travel, Personal Accident, and Liability policies with AI extraction and transparent payout estimation in Indian Rupees (₹).
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="px-6 py-3.5 rounded-2xl bg-[#FFE1AF] hover:bg-white text-[#B77466] font-extrabold text-sm sm:text-base shadow-md transition-all flex items-center space-x-2.5 whitespace-nowrap active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>File New Insurance Claim</span>
        </button>
      </div>

      {/* Key Metrics Cards with Larger Fonts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFE1AF]/40 border border-[#E2B59A] flex items-center justify-center text-[#B77466]">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#957C62] block">Total Claims Filed</span>
            <span className="text-2xl font-black text-[#2C221E]">{totalClaimsCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#957C62] block">Approved Payout</span>
            <span className="text-2xl font-black text-emerald-700">{formatINR(totalPayoutCalculated)}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#957C62] block">Active In-Review</span>
            <span className="text-2xl font-black text-amber-800">{activeProcessingCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#957C62] block">Flagged / Fraud Review</span>
            <span className="text-2xl font-black text-rose-700">{flaggedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2B59A]/40 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search claim ref, policy number, or claimant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-sm text-[#2C221E] placeholder-[#957C62] focus:outline-none focus:border-[#B77466]"
          />
          <Search className="w-5 h-5 text-[#957C62] absolute left-3.5 top-3.5" />
        </div>

        <div className="flex items-center space-x-2 text-sm text-[#957C62] w-full md:w-auto">
          <Filter className="w-4 h-4 text-[#B77466]" />
          <span className="font-semibold text-[#2C221E] whitespace-nowrap">Active Product Line:</span>
          <select
            value={selectedFilter}
            onChange={(e) => onFilterChange(e.target.value as any)}
            className="px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-sm font-semibold focus:outline-none focus:border-[#B77466] w-full md:w-auto"
          >
            <option value="all">All 7 Products ({totalClaimsCount})</option>
            {Object.keys(INSURANCE_TYPES_CONFIG).map((t) => (
              <option key={t} value={t}>
                {INSURANCE_TYPES_CONFIG[t as InsuranceType].title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Claims Table / Cards */}
      <div className="bg-white border border-[#E2B59A]/40 rounded-3xl shadow-xs overflow-hidden">
        {filteredClaims.length === 0 ? (
          <div className="p-16 text-center space-y-4 text-[#957C62]">
            <FileText className="w-12 h-12 text-[#E2B59A] mx-auto" />
            <p className="text-base font-semibold text-[#2C221E]">No insurance claims found for selected line or search filter.</p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-sm"
            >
              Submit First Claim
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#2C221E]">
              <thead className="bg-[#FAF7F2] text-[#957C62] uppercase text-xs font-bold border-b border-[#E2B59A]/40">
                <tr>
                  <th className="px-6 py-4">Claim Ref / Line</th>
                  <th className="px-6 py-4">Policy / Sub-Type</th>
                  <th className="px-6 py-4">Claimed</th>
                  <th className="px-6 py-4">Calculated Payout</th>
                  <th className="px-6 py-4">Fraud Risk</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2B59A]/20 font-medium text-sm">
                {filteredClaims.map((claim) => {
                  const cfg = INSURANCE_TYPES_CONFIG[claim.insuranceType];
                  return (
                    <tr key={claim.id} className="hover:bg-[#FAF7F2]/80 transition-colors">
                      
                      {/* Ref & Product */}
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <span className="font-extrabold text-[#2C221E] text-base block">{claim.claimNumber}</span>
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${cfg.badgeColor}`}>
                            {cfg.title}
                          </span>
                        </div>
                      </td>

                      {/* Policy & Sub-type */}
                      <td className="px-6 py-5">
                        <div className="space-y-0.5">
                          <span className="text-[#2C221E] block font-mono font-bold text-sm">{claim.policyNumber}</span>
                          <span className="text-xs text-[#957C62] font-semibold capitalize">
                            {claim.claimSubType.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>

                      {/* Claimed */}
                      <td className="px-6 py-5 font-bold text-base text-[#2C221E]">
                        {formatINR(claim.claimedAmount)}
                      </td>

                      {/* Calculated Payout */}
                      <td className="px-6 py-5 font-black text-base text-emerald-700">
                        {formatINR(claim.estimation.estimatedPayout)}
                      </td>

                      {/* Fraud Risk */}
                      <td className="px-6 py-5">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          claim.isFraudFlagged
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          Risk Score: {claim.overallFraudScore}/100
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide ${
                          claim.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : claim.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-[#FFE1AF] text-[#8F6218] border border-[#E2B59A]'
                        }`}>
                          {claim.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => setSelectedClaim(claim)}
                          className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#FFE1AF] text-[#B77466] border border-[#E2B59A]/60 text-xs font-bold inline-flex items-center space-x-1.5 transition-colors shadow-2xs"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Inspect Claim</span>
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claim Detail Modal */}
      <ClaimDetailModal
        claim={selectedClaim}
        onClose={() => setSelectedClaim(null)}
      />

      {/* New Claim Intake Wizard */}
      <NewClaimWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onClaimSubmitted={(newClaim) => {
          onClaimSubmitted(newClaim);
        }}
        initialInsuranceType={selectedFilter === 'all' ? 'life' : selectedFilter}
      />

    </div>
  );
};
