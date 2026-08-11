import React, { useState, useEffect } from 'react';
import { ClaimRecord, UserRole, InsuranceType, UserProfile } from './types/claim';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ClaimantDashboard } from './components/Claimant/ClaimantDashboard';
import { AgentDashboard } from './components/Agent/AgentDashboard';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { SupabaseModal } from './components/SupabaseModal';
import { NewClaimWizard } from './components/Claimant/NewClaimWizard';
import { AuthModal } from './components/Auth/AuthModal';
import { getStoredClaims, saveStoredClaim, updateStoredClaimStatus, getSupabaseCredentials } from './lib/supabase';
import { runAIClaimPipeline } from './services/geminiPipeline';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('claimant');
  const [insuranceFilter, setInsuranceFilter] = useState<InsuranceType | 'all'>('all');
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Logged-in User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>({
    id: 'usr-001',
    fullName: 'Preetham S Gowda',
    email: 'sgowdapreetham14@gmail.com',
    role: 'claimant',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Preetham',
    createdAt: new Date().toISOString()
  });

  // Initialize Sample Claims across all 7 Insurance Products if empty
  useEffect(() => {
    const creds = getSupabaseCredentials();
    setIsSupabaseConnected(!!creds.url && !!creds.key && creds.url !== 'MY_SUPABASE_URL');

    const existing = getStoredClaims();
    if (existing.length === 0) {
      seedInitialSampleClaims();
    } else {
      setClaims(existing);
    }
  }, []);

  const seedInitialSampleClaims = async () => {
    // Generate sample claims across products in INR
    const sample1 = await runAIClaimPipeline({
      insuranceType: 'life',
      claimSubType: 'natural_death',
      policyNumber: 'CX-LIFE-882190',
      claimantName: 'Rahul Sharma',
      claimantEmail: 'rahul.sharma@example.com',
      claimedAmount: 500000,
      files: [{ name: 'death_certificate.pdf', size: 240000, type: 'application/pdf' }]
    });

    const sample2 = await runAIClaimPipeline({
      insuranceType: 'health',
      claimSubType: 'reimbursement',
      policyNumber: 'CX-HLT-410293',
      claimantName: 'Amit Verma',
      claimantEmail: 'amit.verma@example.com',
      claimedAmount: 120000,
      files: [{ name: 'discharge_summary.pdf', size: 180000, type: 'application/pdf' }]
    });

    const sample3 = await runAIClaimPipeline({
      insuranceType: 'motor',
      claimSubType: 'own_damage',
      policyNumber: 'CX-MTR-772391',
      claimantName: 'Siddharth Rao',
      claimantEmail: 'siddharth.rao@example.com',
      claimedAmount: 45000,
      files: [{ name: 'garage_estimate.pdf', size: 120000, type: 'application/pdf' }]
    });

    const sample4 = await runAIClaimPipeline({
      insuranceType: 'liability',
      claimSubType: 'professional_indemnity',
      policyNumber: 'CX-LIA-990123',
      claimantName: 'Preetham S Gowda',
      claimantEmail: 'sgowdapreetham14@gmail.com',
      claimedAmount: 750000,
      files: [{ name: 'legal_notice_demand.pdf', size: 310000, type: 'application/pdf' }]
    });

    const initial = [sample1, sample2, sample3, sample4];
    initial.forEach(saveStoredClaim);
    setClaims(initial);
  };

  const claimsCountByLine = claims.reduce((acc, c) => {
    acc[c.insuranceType] = (acc[c.insuranceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleClaimSubmitted = (newClaim: ClaimRecord) => {
    saveStoredClaim(newClaim);
    setClaims(prev => [newClaim, ...prev]);
  };

  const handleAgentReviewSubmitted = (
    claimId: string,
    review: { recommendedPayout: number; recommendation: 'approve' | 'reject' | 'further_investigation'; overrideRationale: string }
  ) => {
    const nextStatus = review.recommendation === 'approve' ? 'approved' : review.recommendation === 'reject' ? 'rejected' : 'agent_review';
    
    const updated = updateStoredClaimStatus(claimId, {
      status: nextStatus,
      agentReview: {
        agentId: 'agt-specialist-01',
        agentName: currentUser?.fullName || 'Senior Agent Specialist',
        recommendedPayout: review.recommendedPayout,
        recommendation: review.recommendation,
        overrideRationale: review.overrideRationale,
        reviewTimestamp: new Date().toISOString()
      }
    });

    if (updated) {
      setClaims(prev => prev.map(c => c.id === claimId ? updated : c));
    }
  };

  const handleAdminApprove = (claimId: string, finalAmount: number, remarks: string) => {
    const updated = updateStoredClaimStatus(claimId, {
      status: 'approved',
      adminDecision: {
        action: 'approve',
        finalAmount,
        remarks,
        decidedBy: currentUser?.fullName || 'Admin Executive Supervisor',
        decidedAt: new Date().toISOString()
      }
    });

    if (updated) {
      setClaims(prev => prev.map(c => c.id === claimId ? updated : c));
    }
  };

  const handleAdminReject = (claimId: string, remarks: string) => {
    const updated = updateStoredClaimStatus(claimId, {
      status: 'rejected',
      adminDecision: {
        action: 'reject',
        finalAmount: 0,
        remarks,
        decidedBy: currentUser?.fullName || 'Admin Executive Supervisor',
        decidedAt: new Date().toISOString()
      }
    });

    if (updated) {
      setClaims(prev => prev.map(c => c.id === claimId ? updated : c));
    }
  };

  const handleLoginUser = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C221E] font-sans selection:bg-[#FFE1AF] selection:text-[#2C221E]">
      
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        selectedInsuranceTypeFilter={insuranceFilter}
        onFilterChange={setInsuranceFilter}
        onOpenNewClaim={() => setIsNewClaimOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        currentUser={currentUser}
        isSupabaseConnected={isSupabaseConnected}
        claimsCountByLine={claimsCountByLine}
        totalClaimsCount={claims.length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Right Content Column (Padded for Desktop Sidebar) */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        
        {/* Header Top Bar */}
        <Navbar
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          onOpenNewClaim={() => setIsNewClaimOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          currentUser={currentUser}
          selectedInsuranceTypeFilter={insuranceFilter}
          isSupabaseConnected={isSupabaseConnected}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        {/* Main Dashboard Canvas */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentRole === 'claimant' && (
            <ClaimantDashboard
              claims={claims}
              onClaimSubmitted={handleClaimSubmitted}
              selectedFilter={insuranceFilter}
              onFilterChange={setInsuranceFilter}
            />
          )}

          {currentRole === 'agent' && (
            <AgentDashboard
              claims={claims}
              onReviewSubmitted={handleAgentReviewSubmitted}
            />
          )}

          {currentRole === 'admin' && (
            <AdminDashboard
              claims={claims}
              onAdminApprove={handleAdminApprove}
              onAdminReject={handleAdminReject}
            />
          )}
        </main>

      </div>

      {/* Google Authentication Sign In / Sign Up Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSelectUser={handleLoginUser}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Supabase Config Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onCredentialsUpdated={() => {
          const creds = getSupabaseCredentials();
          setIsSupabaseConnected(!!creds.url && !!creds.key && creds.url !== 'MY_SUPABASE_URL');
        }}
      />

      {/* New Claim Intake Wizard */}
      <NewClaimWizard
        isOpen={isNewClaimOpen}
        onClose={() => setIsNewClaimOpen(false)}
        onClaimSubmitted={handleClaimSubmitted}
        initialInsuranceType={insuranceFilter === 'all' ? 'life' : insuranceFilter}
      />

    </div>
  );
}
