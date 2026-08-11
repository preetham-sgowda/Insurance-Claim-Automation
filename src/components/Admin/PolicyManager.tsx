import React, { useState } from 'react';
import { PolicyRecord, InsuranceType, formatINR } from '../../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../../data/insuranceConfig';
import { getStoredPolicies } from '../../lib/supabase';

export const PolicyManager: React.FC = () => {
  const [policies] = useState<PolicyRecord[]>(getStoredPolicies());
  const [selectedType, setSelectedType] = useState<InsuranceType | 'all'>('all');

  const filtered = policies.filter(p => selectedType === 'all' || p.insuranceType === selectedType);

  return (
    <div className="space-y-4 text-sm">
      
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#E2B59A]/40 shadow-xs">
        <div className="flex items-center space-x-3">
          <span className="text-[#957C62] font-bold">Filter Product:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
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

        <span className="text-[#957C62] font-medium">
          Showing <strong className="text-[#2C221E] font-black">{filtered.length}</strong> active policy schedules
        </span>
      </div>

      {/* Policies Table */}
      <div className="bg-white border border-[#E2B59A]/40 rounded-3xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-[#2C221E]">
          <thead className="bg-[#FAF7F2] text-[#957C62] uppercase text-xs font-bold border-b border-[#E2B59A]/40">
            <tr>
              <th className="px-6 py-4">Policy Number</th>
              <th className="px-6 py-4">Product Line</th>
              <th className="px-6 py-4">Holder Name</th>
              <th className="px-6 py-4">Sum Insured / IDV</th>
              <th className="px-6 py-4">Coverage Dates</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2B59A]/20 font-medium text-sm">
            {filtered.map((p) => {
              const cfg = INSURANCE_TYPES_CONFIG[p.insuranceType];
              return (
                <tr key={p.id} className="hover:bg-[#FAF7F2]/80 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-[#2C221E] text-base">
                    {p.policyNumber}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${cfg.badgeColor}`}>
                      {cfg.title}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#2C221E]">
                    <div>
                      <span className="font-bold block text-sm">{p.holderName}</span>
                      <span className="text-xs text-[#957C62] font-medium">{p.holderEmail}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-700 text-base">
                    {formatINR(p.sumInsuredOrIDV)}
                  </td>
                  <td className="px-6 py-4 text-[#957C62] text-xs font-medium">
                    {p.startDate} → {p.endDate}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
