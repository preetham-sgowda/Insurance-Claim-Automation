import React, { useState } from 'react';
import { ClaimRecord, InsuranceType, formatINR } from '../../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../../data/insuranceConfig';
import { PolicyManager } from './PolicyManager';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AdminDashboardProps {
  claims: ClaimRecord[];
  onAdminApprove: (claimId: string, finalAmount: number, remarks: string) => void;
  onAdminReject: (claimId: string, remarks: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  claims,
  onAdminApprove,
  onAdminReject
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'claims' | 'policies'>('overview');
  const [selectedInsuranceFilter, setSelectedInsuranceFilter] = useState<InsuranceType | 'all'>('all');

  // Modal Action State for Approval/Rejection
  const [actionClaim, setActionClaim] = useState<ClaimRecord | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [finalAmount, setFinalAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');

  // Calculate Metrics
  const totalClaims = claims.length;
  const approvedClaims = claims.filter(c => c.status === 'approved');
  const totalApprovedPayout = approvedClaims.reduce((acc, c) => acc + (c.adminDecision?.finalAmount || c.estimation.estimatedPayout), 0);
  const fraudFlaggedCount = claims.filter(c => c.isFraudFlagged || c.status === 'flagged_fraud').length;
  const fraudRate = totalClaims > 0 ? Math.round((fraudFlaggedCount / totalClaims) * 100) : 0;

  // Recharts Chart Data
  const chartDataByLine = (Object.keys(INSURANCE_TYPES_CONFIG) as InsuranceType[]).map(t => {
    const lineClaims = claims.filter(c => c.insuranceType === t);
    const approved = lineClaims.filter(c => c.status === 'approved').length;
    return {
      name: INSURANCE_TYPES_CONFIG[t].title.split(' ')[0],
      total: lineClaims.length,
      approved
    };
  });

  const pieDataStatus = [
    { name: 'Approved', value: claims.filter(c => c.status === 'approved').length, color: '#047857' },
    { name: 'Agent Review', value: claims.filter(c => c.status === 'agent_review').length, color: '#B77466' },
    { name: 'Flagged Fraud', value: claims.filter(c => c.isFraudFlagged).length, color: '#be123c' },
    { name: 'Rejected', value: claims.filter(c => c.status === 'rejected').length, color: '#957C62' }
  ].filter(d => d.value > 0);

  const handleOpenActionModal = (claim: ClaimRecord, type: 'approve' | 'reject') => {
    setActionClaim(claim);
    setActionType(type);
    setFinalAmount(claim.agentReview?.recommendedPayout || claim.estimation.estimatedPayout);
    setRemarks(type === 'approve' ? 'Approved by Admin Supervisor.' : 'Rejected following fraud audit policy.');
  };

  const handleConfirmAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionClaim) return;

    if (actionType === 'approve') {
      onAdminApprove(actionClaim.id, finalAmount, remarks);
    } else {
      onAdminReject(actionClaim.id, remarks);
    }

    setActionClaim(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#B77466] to-[#957C62] border border-[#E2B59A]/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white">
        <div>
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8F6218] bg-[#FFE1AF] px-3 py-1 rounded-full border border-[#E2B59A]">
              Admin Control Center
            </span>
            <span className="text-xs font-medium text-[#FFE1AF]">Platform Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Executive Claims & Policy Analytics</h1>
          <p className="text-sm sm:text-base text-white/95 max-w-2xl mt-2 leading-relaxed">
            Monitor real-time claim volume, payout disbursements in Indian Rupees (₹), fraud signals across 7 insurance lines, and execute final binding approvals.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white/10 p-1.5 rounded-2xl border border-white/20 text-sm font-bold backdrop-blur-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'overview' ? 'bg-[#FFE1AF] text-[#8F6218] font-black shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'claims' ? 'bg-[#FFE1AF] text-[#8F6218] font-black shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            Claims Workflow ({claims.length})
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'policies' ? 'bg-[#FFE1AF] text-[#8F6218] font-black shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            Seed Policy Register
          </button>
        </div>
      </div>

      {/* OVERVIEW ANALYTICS TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs">
              <span className="text-xs font-bold text-[#957C62] block mb-1">Total Platform Claims</span>
              <span className="text-3xl font-black text-[#2C221E]">{totalClaims}</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs">
              <span className="text-xs font-bold text-[#957C62] block mb-1">Total Approved Payouts</span>
              <span className="text-3xl font-black text-emerald-700">{formatINR(totalApprovedPayout)}</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs">
              <span className="text-xs font-bold text-[#957C62] block mb-1">Fraud Signal Flag Rate</span>
              <span className="text-3xl font-black text-rose-700">{fraudRate}%</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs">
              <span className="text-xs font-bold text-[#957C62] block mb-1">Avg AI Processing Speed</span>
              <span className="text-3xl font-black text-[#B77466]">2.4 sec</span>
            </div>
          </div>

          {/* Recharts Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Claims Volume Bar Chart */}
            <div className="lg:col-span-8 p-6 bg-white border border-[#E2B59A]/40 rounded-3xl shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider">
                Claim Volume & Approved Payouts by Product Line
              </h3>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataByLine}>
                    <XAxis dataKey="name" stroke="#957C62" fontSize={12} />
                    <YAxis stroke="#957C62" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FAF7F2', borderColor: '#E2B59A', borderRadius: '16px', fontSize: '12px', color: '#2C221E', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="total" fill="#B77466" name="Total Claims" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="approved" fill="#047857" name="Approved" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Pie Chart */}
            <div className="lg:col-span-4 p-6 bg-white border border-[#E2B59A]/40 rounded-3xl shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[#957C62] uppercase tracking-wider">
                Status Distribution
              </h3>

              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieDataStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {pieDataStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FAF7F2', borderColor: '#E2B59A', borderRadius: '16px', fontSize: '12px', color: '#2C221E', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs pt-2">
                {pieDataStatus.map((d) => (
                  <div key={d.name} className="flex justify-between items-center text-[#2C221E] font-bold">
                    <span className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span>{d.name}</span>
                    </span>
                    <span className="font-extrabold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* CLAIMS WORKFLOW TAB */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-[#E2B59A]/40 flex items-center justify-between text-sm shadow-xs">
            <div className="flex items-center space-x-3">
              <span className="text-[#957C62] font-bold">Filter Product Line:</span>
              <select
                value={selectedInsuranceFilter}
                onChange={(e) => setSelectedInsuranceFilter(e.target.value as any)}
                className="px-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] font-bold text-sm focus:outline-none focus:border-[#B77466]"
              >
                <option value="all">All 7 Insurance Products</option>
                {Object.keys(INSURANCE_TYPES_CONFIG).map((t) => (
                  <option key={t} value={t}>
                    {INSURANCE_TYPES_CONFIG[t as InsuranceType].title}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[#957C62] font-semibold">
              Total Managed: <strong className="text-[#2C221E] font-black">{claims.length}</strong>
            </span>
          </div>

          <div className="bg-white border border-[#E2B59A]/40 rounded-3xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm text-[#2C221E]">
              <thead className="bg-[#FAF7F2] text-[#957C62] uppercase text-xs font-bold border-b border-[#E2B59A]/40">
                <tr>
                  <th className="px-6 py-4">Ref / Line</th>
                  <th className="px-6 py-4">Claimant / Policy</th>
                  <th className="px-6 py-4">Claimed</th>
                  <th className="px-6 py-4">Agent Rec.</th>
                  <th className="px-6 py-4">Fraud Risk</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2B59A]/20 font-medium text-sm">
                {claims
                  .filter(c => selectedInsuranceFilter === 'all' || c.insuranceType === selectedInsuranceFilter)
                  .map((claim) => {
                    const cfg = INSURANCE_TYPES_CONFIG[claim.insuranceType];
                    return (
                      <tr key={claim.id} className="hover:bg-[#FAF7F2]/80 transition-colors">
                        <td className="px-6 py-5">
                          <span className="font-extrabold text-[#2C221E] block text-base">{claim.claimNumber}</span>
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${cfg.badgeColor}`}>
                            {cfg.title}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <span className="text-[#2C221E] font-bold block">{claim.claimantName}</span>
                          <span className="text-xs text-[#957C62] font-mono font-bold">{claim.policyNumber}</span>
                        </td>

                        <td className="px-6 py-5 font-bold text-base">{formatINR(claim.claimedAmount)}</td>

                        <td className="px-6 py-5 text-[#8F6218] font-black text-base">
                          {claim.agentReview ? formatINR(claim.agentReview.recommendedPayout) : '—'}
                        </td>

                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            claim.isFraudFlagged ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            Score: {claim.overallFraudScore}/100
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide ${
                            claim.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#FFE1AF] text-[#8F6218]'
                          }`}>
                            {claim.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenActionModal(claim, 'approve')}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-2xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(claim, 'reject')}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs shadow-2xs"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SEED POLICIES TAB */}
      {activeTab === 'policies' && <PolicyManager />}

      {/* Admin Decision Action Modal */}
      {actionClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E2B59A]/60 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl text-[#2C221E]">
            <h3 className="text-lg font-black text-[#2C221E] flex items-center justify-between">
              <span>Admin Decision: {actionType.toUpperCase()}</span>
              <button onClick={() => setActionClaim(null)} className="text-[#957C62] hover:text-[#2C221E] text-xl font-bold">✕</button>
            </h3>

            <p className="text-sm text-[#957C62] font-medium leading-relaxed">
              Executing final binding action for <strong className="text-[#2C221E]">{actionClaim.claimNumber}</strong> ({INSURANCE_TYPES_CONFIG[actionClaim.insuranceType].title}).
            </p>

            {actionType === 'approve' && (
              <div>
                <label className="block text-xs font-bold text-[#957C62] mb-1.5">
                  Final Approved Payout Amount (₹)
                </label>
                <input
                  type="number"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-emerald-800 font-black text-base focus:outline-none focus:border-[#B77466]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#957C62] mb-1.5">
                Admin Audit Remarks
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-sm focus:outline-none focus:border-[#B77466]"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setActionClaim(null)}
                className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#957C62] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-xs ${
                  actionType === 'approve'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-rose-700 hover:bg-rose-800 text-white'
                }`}
              >
                Confirm {actionType.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
