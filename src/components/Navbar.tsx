import React from 'react';
import { UserRole, InsuranceType, UserProfile } from '../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../data/insuranceConfig';
import { Shield, Database, PlusCircle, User, Award, Activity, Menu, CheckCircle2, Sparkles, Layers } from 'lucide-react';

interface HeaderTopBarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenNewClaim: () => void;
  onOpenAuthModal: () => void;
  currentUser: UserProfile | null;
  selectedInsuranceTypeFilter: InsuranceType | 'all';
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<HeaderTopBarProps> = ({
  currentRole,
  onRoleChange,
  onOpenNewClaim,
  onOpenAuthModal,
  currentUser,
  selectedInsuranceTypeFilter,
  onOpenMobileMenu
}) => {
  const activeLineTitle = selectedInsuranceTypeFilter === 'all'
    ? 'All 7 Insurance Products'
    : INSURANCE_TYPES_CONFIG[selectedInsuranceTypeFilter]?.title || 'Insurance Line';

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E2B59A]/40 text-[#2C221E] shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Mobile Menu Toggle & Title Breadcrumb */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] hover:bg-[#FFE1AF]/40 transition"
              aria-label="Open Sidebar Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-[#957C62] uppercase tracking-wider hidden sm:inline">
                  {currentRole === 'claimant' ? 'Claimant Portal' : currentRole === 'agent' ? 'Agent Workbench' : 'Admin Governance'}
                </span>
                <span className="text-xs font-bold text-[#957C62] hidden sm:inline">•</span>
                <span className="text-sm sm:text-base font-extrabold text-[#2C221E] flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-[#B77466]" />
                  <span>{activeLineTitle}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions & Role Pill */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            


            {/* Quick Role Switcher */}
            <div className="flex items-center bg-[#FAF7F2] p-1 rounded-xl border border-[#E2B59A]/60">
              <button
                onClick={() => onRoleChange('claimant')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  currentRole === 'claimant'
                    ? 'bg-[#B77466] text-white shadow-xs'
                    : 'text-[#957C62] hover:text-[#2C221E]'
                }`}
              >
                Claimant
              </button>

              <button
                onClick={() => onRoleChange('agent')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  currentRole === 'agent'
                    ? 'bg-[#B77466] text-white shadow-xs'
                    : 'text-[#957C62] hover:text-[#2C221E]'
                }`}
              >
                Agent
              </button>

              <button
                onClick={() => onRoleChange('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                  currentRole === 'admin'
                    ? 'bg-[#B77466] text-white shadow-xs'
                    : 'text-[#957C62] hover:text-[#2C221E]'
                }`}
              >
                Admin
              </button>
            </div>

            {/* User Login Trigger */}
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-[#E2B59A] bg-[#FAF7F2] hover:bg-[#FFE1AF]/40 text-[#2C221E] text-xs sm:text-sm font-semibold transition"
            >
              {currentUser ? (
                <div className="flex items-center space-x-2">
                  <img
                    src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.fullName)}`}
                    alt={currentUser.fullName}
                    className="w-6 h-6 rounded-full object-cover border border-[#B77466]"
                  />
                  <span className="hidden md:inline font-bold">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#B77466]" />
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-[#B77466] font-bold">
                  <User className="w-4 h-4 text-[#B77466]" />
                  <span className="hidden sm:inline">Sign In / Register</span>
                </div>
              )}
            </button>

            {/* New Claim CTA button */}
            {currentRole === 'claimant' && (
              <button
                onClick={onOpenNewClaim}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs sm:text-sm transition-all shadow-xs active:scale-95"
              >
                <PlusCircle className="w-4.5 h-4.5" />
                <span className="hidden md:inline">File Claim</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
