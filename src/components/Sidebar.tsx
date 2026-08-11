import React from 'react';
import { UserRole, InsuranceType, UserProfile } from '../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../data/insuranceConfig';
import {
  Shield,
  Database,
  PlusCircle,
  User,
  Award,
  Activity,
  CheckCircle2,
  HeartPulse,
  Car,
  Home,
  Plane,
  ShieldAlert,
  Briefcase,
  Layers,
  X,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  selectedInsuranceTypeFilter: InsuranceType | 'all';
  onFilterChange: (type: InsuranceType | 'all') => void;
  onOpenNewClaim: () => void;
  onOpenAuthModal: () => void;
  currentUser: UserProfile | null;
  claimsCountByLine: Record<string, number>;
  totalClaimsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const LINE_ICONS: Record<InsuranceType, React.ElementType> = {
  life: HeartPulse,
  health: Activity,
  motor: Car,
  home: Home,
  travel: Plane,
  personal_accident: ShieldAlert,
  liability: Briefcase
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  onRoleChange,
  selectedInsuranceTypeFilter,
  onFilterChange,
  onOpenNewClaim,
  onOpenAuthModal,
  currentUser,
  claimsCountByLine,
  totalClaimsCount,
  isMobileOpen = false,
  onCloseMobile
}) => {

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E2B59A]/40 text-[#2C221E] shadow-sm select-none">
      
      {/* Brand Header */}
      <div className="p-5 border-b border-[#E2B59A]/30 bg-[#FAF7F2]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-11 h-11 rounded-2xl bg-[#B77466] flex items-center justify-center shadow-sm text-white">
              <Shield className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-black tracking-tight text-[#2C221E]">
                  ClaimX
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFE1AF] text-[#8F6218] border border-[#E2B59A]">
                  AI Engine
                </span>
              </div>
              <p className="text-xs text-[#957C62] font-medium mt-0.5">Multi-Line Insurance Claims</p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-xl text-[#957C62] hover:text-[#2C221E] hover:bg-[#FAF7F2]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Portal CTA */}
        {currentRole === 'claimant' && (
          <button
            onClick={() => {
              onOpenNewClaim();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center space-x-2 active:scale-98"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Submit New Claim</span>
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        
        {/* User Role Switcher */}
        <div>
          <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-[#957C62] mb-2.5 flex items-center justify-between">
            <span>PORTAL VIEW</span>
            <span className="text-[10px] text-[#B77466] font-extrabold bg-[#FFE1AF]/50 px-2 py-0.5 rounded-full">
              {currentRole.toUpperCase()}
            </span>
          </h3>

          <div className="space-y-1.5">
            <button
              onClick={() => {
                onRoleChange('claimant');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentRole === 'claimant'
                  ? 'bg-[#B77466] text-white shadow-xs'
                  : 'text-[#2C221E] hover:bg-[#FAF7F2] hover:text-[#B77466]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <User className="w-4 h-4" />
                <span>Claimant Portal</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                currentRole === 'claimant' ? 'bg-white/20 text-white' : 'bg-[#FAF7F2] text-[#957C62]'
              }`}>
                User
              </span>
            </button>

            <button
              onClick={() => {
                onRoleChange('agent');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentRole === 'agent'
                  ? 'bg-[#B77466] text-white shadow-xs'
                  : 'text-[#2C221E] hover:bg-[#FAF7F2] hover:text-[#B77466]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Award className="w-4 h-4" />
                <span>Agent Workbench</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                currentRole === 'agent' ? 'bg-white/20 text-white' : 'bg-[#FAF7F2] text-[#957C62]'
              }`}>
                Audit
              </span>
            </button>

            <button
              onClick={() => {
                onRoleChange('admin');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentRole === 'admin'
                  ? 'bg-[#B77466] text-white shadow-xs'
                  : 'text-[#2C221E] hover:bg-[#FAF7F2] hover:text-[#B77466]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4" />
                <span>Admin Governance</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                currentRole === 'admin' ? 'bg-white/20 text-white' : 'bg-[#FAF7F2] text-[#957C62]'
              }`}>
                Control
              </span>
            </button>
          </div>
        </div>

        {/* Insurance Products Navigation Bar (Primary requested feature) */}
        <div>
          <div className="px-2 mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#957C62] flex items-center space-x-1.5">
              <span>INSURANCE LINES</span>
            </h3>
            <span className="text-xs font-extrabold text-[#B77466] bg-[#FFE1AF] px-2 py-0.5 rounded-full border border-[#E2B59A]">
              7 Products
            </span>
          </div>

          <div className="space-y-1">
            {/* All Lines Option */}
            <button
              onClick={() => {
                onFilterChange('all');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedInsuranceTypeFilter === 'all'
                  ? 'bg-[#FFE1AF] text-[#8F6218] border border-[#E2B59A] shadow-xs'
                  : 'text-[#2C221E] hover:bg-[#FAF7F2] hover:text-[#B77466]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-lg ${
                  selectedInsuranceTypeFilter === 'all' ? 'bg-[#8F6218] text-white' : 'bg-[#FAF7F2] text-[#957C62]'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <span>All Insurance Lines</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-[#8F6218] border border-[#E2B59A]">
                {totalClaimsCount}
              </span>
            </button>

            {/* 7 Insurance Lines List */}
            {(Object.keys(INSURANCE_TYPES_CONFIG) as InsuranceType[]).map((type) => {
              const cfg = INSURANCE_TYPES_CONFIG[type];
              const IconComp = LINE_ICONS[type] || Sparkles;
              const isSelected = selectedInsuranceTypeFilter === type;
              const count = claimsCountByLine[type] || 0;

              return (
                <button
                  key={type}
                  onClick={() => {
                    onFilterChange(type);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    isSelected
                      ? 'bg-[#FFE1AF] text-[#8F6218] font-bold border border-[#E2B59A] shadow-xs'
                      : 'text-[#2C221E] font-medium hover:bg-[#FAF7F2] hover:text-[#B77466]'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                      isSelected ? 'bg-[#B77466] text-white' : 'bg-[#FAF7F2] text-[#B77466]'
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="truncate text-sm">{cfg.title}</span>
                  </div>

                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-2 flex-shrink-0 ${
                    isSelected ? 'bg-[#B77466] text-white' : 'bg-[#FAF7F2] text-[#957C62]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Sidebar Footer Widgets */}
      <div className="p-4 border-t border-[#E2B59A]/30 bg-[#FAF7F2] space-y-3">
        


        {/* User Profile Card */}
        <button
          onClick={onOpenAuthModal}
          className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E2B59A] bg-white hover:bg-[#FFE1AF]/20 transition text-left"
        >
          {currentUser ? (
            <div className="flex items-center space-x-2.5 min-w-0">
              <img
                src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.fullName)}`}
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-full object-cover border border-[#B77466] flex-shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-xs text-[#2C221E] truncate">{currentUser.fullName}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#B77466] flex-shrink-0" />
                </div>
                <p className="text-[11px] text-[#957C62] truncate">{currentUser.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-[#B77466] font-bold text-xs">
              <User className="w-4 h-4 text-[#B77466]" />
              <span>Sign In / Register</span>
            </div>
          )}
        </button>

      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed left navigation bar) */}
      <aside className="hidden lg:block w-72 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-full z-10 flex-1">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
