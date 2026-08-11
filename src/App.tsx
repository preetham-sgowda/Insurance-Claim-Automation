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
import { getStoredClaims, saveStoredClaim, updateStoredClaimStatus, getSupabaseCredentials, getSupabaseClient } from './lib/supabase';
import { apiFetch } from './lib/apiClient';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('claimant');
  const [insuranceFilter, setInsuranceFilter] = useState<InsuranceType | 'all'>('all');
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Logged-in User State — initialized from Supabase session, not hardcoded
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Initialize: restore session from Supabase Auth + listen for auth changes
  useEffect(() => {
    const creds = getSupabaseCredentials();
    setIsSupabaseConnected(!!creds.url && !!creds.key && creds.url !== 'MY_SUPABASE_URL');

    const client = getSupabaseClient();
    if (!client) {
      // No Supabase configured — load from local storage fallback
      const existing = getStoredClaims();
      setClaims(existing);

      if (typeof window !== 'undefined') {
        const savedUserJson = localStorage.getItem('claimx_mock_user');
        if (savedUserJson) {
          try {
            const savedUser = JSON.parse(savedUserJson);
            setCurrentUser(savedUser);
            setCurrentRole(savedUser.role);

            // Re-assert token
            const mockToken = `mock-token-for-${savedUser.role}-${savedUser.id}-${encodeURIComponent(savedUser.fullName)}`;
            localStorage.setItem('claimx_mock_token', mockToken);
          } catch (e) {
            console.error('Failed to parse saved mock user:', e);
          }
        }
      }
      return;
    }

    // Restore existing session
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        restoreUserProfile(session.user);
      }
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          restoreUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setClaims([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // When user changes, reload claims from server
  useEffect(() => {
    if (currentUser) {
      loadClaimsFromServer();
    }
  }, [currentUser?.id]);

  /**
   * Restore a UserProfile from Supabase Auth user + public.users table
   */
  async function restoreUserProfile(authUser: any) {
    const client = getSupabaseClient();
    let role: UserRole = 'claimant';
    let fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';

    if (client) {
      const { data: dbUser } = await client
        .from('users')
        .select('full_name, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (dbUser) {
        role = dbUser.role || 'claimant';
        fullName = dbUser.full_name || fullName;
      }
    }

    const profile: UserProfile = {
      id: authUser.id,
      email: authUser.email || '',
      fullName,
      role,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
      createdAt: authUser.created_at || new Date().toISOString(),
    };

    setCurrentUser(profile);
    setCurrentRole(role);
  }

  /**
   * Load claims from the server API (which now reads from Supabase)
   */
  async function loadClaimsFromServer() {
    try {
      const res = await apiFetch('/api/claims/list');
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      } else if (res.status === 401) {
        // Not authenticated — clear user
        console.warn('Claims API returned 401 — user may need to re-authenticate');
      }
    } catch (err) {
      console.warn('Failed to load claims from server, falling back to local:', err);
      setClaims(getStoredClaims());
    }
  }

  const claimsCountByLine = claims.reduce((acc, c) => {
    acc[c.insuranceType] = (acc[c.insuranceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleClaimSubmitted = (newClaim: ClaimRecord) => {
    // Claim is already persisted to Supabase by the server pipeline endpoint
    saveStoredClaim(newClaim); // Also save locally for immediate UI update
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
        agentId: currentUser?.id || 'agt-specialist-01',
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

    if (typeof window !== 'undefined') {
      localStorage.setItem('claimx_mock_user', JSON.stringify(user));
      const mockToken = `mock-token-for-${user.role}-${user.id}-${encodeURIComponent(user.fullName)}`;
      localStorage.setItem('claimx_mock_token', mockToken);
    }
  };

  const handleLogout = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('claimx_mock_user');
      localStorage.removeItem('claimx_mock_token');
    }
    setCurrentUser(null);
    setClaims([]);
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
