import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, ShieldAlert, CheckCircle2, ArrowRight, Lock, LogOut, Mail, KeyRound, Database, UserPlus, LogIn, Eye, EyeOff, RefreshCw, Users } from 'lucide-react';
import { UserRole, UserProfile } from '../../types/claim';
import { registerUserInSupabaseAndLocal, signInUserWithEmailPassword, getStoredUsers, getSupabaseCredentials, fetchSupabaseUsers, StoredUserAccount } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onLogout: () => void;
}

const PRESET_DEMO_ACCOUNTS: { email: string; name: string; role: UserRole; title: string }[] = [
  {
    email: 'sgowdapreetham14@gmail.com',
    name: 'Preetham S Gowda',
    role: 'claimant',
    title: 'Policyholder (Claimant)'
  },
  {
    email: 'agent.claims@claimx.in',
    name: 'Rajesh Kumar',
    role: 'agent',
    title: 'Verification Specialist (Agent)'
  },
  {
    email: 'admin.supervisor@claimx.in',
    name: 'Dr. Sunita Sharma',
    role: 'admin',
    title: 'Executive Supervisor (Admin)'
  }
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  onLogout
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'users'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('claimant');

  // Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registered users from DB/Supabase
  const [dbUsers, setDbUsers] = useState<StoredUserAccount[]>([]);
  const [dbSource, setDbSource] = useState<'supabase' | 'local'>('local');
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const creds = getSupabaseCredentials();
  const isSupabaseConfigured = !!creds.url && !!creds.key && creds.url !== 'MY_SUPABASE_URL';

  const loadRegisteredUsers = async () => {
    setIsFetchingUsers(true);
    const { users, source } = await fetchSupabaseUsers();
    setDbUsers(users);
    setDbSource(source);
    setIsFetchingUsers(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadRegisteredUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await signInUserWithEmailPassword({ email, password });
      
      if (result.user) {
        const profile: UserProfile = {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          avatarUrl: result.user.avatarUrl,
          createdAt: result.user.createdAt
        };

        onSelectUser(profile);
        setIsLoading(false);
        onClose();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Failed to authenticate. Please check credentials.'
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'An error occurred during sign in.'
      });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await registerUserInSupabaseAndLocal({
        email,
        password,
        fullName,
        role: selectedRole
      });

      const profile: UserProfile = {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        createdAt: result.user.createdAt
      };

      await loadRegisteredUsers();

      if (result.supabaseSaved) {
        setStatusMessage({
          type: 'success',
          text: `User ${result.user.fullName} successfully recorded in Supabase public.users table!`
        });
      } else if (result.error) {
        setStatusMessage({
          type: 'info',
          text: `Account created locally. Supabase note: ${result.error}`
        });
      }

      onSelectUser(profile);
      setIsLoading(false);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'An error occurred during registration.'
      });
      setIsLoading(false);
    }
  };

  const handlePresetSelect = async (preset: typeof PRESET_DEMO_ACCOUNTS[0]) => {
    setEmail(preset.email);
    setPassword('password123');
    setSelectedRole(preset.role);

    setIsLoading(true);
    setStatusMessage(null);

    const result = await signInUserWithEmailPassword({
      email: preset.email,
      password: 'password123'
    });

    if (result.user) {
      const profile: UserProfile = {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: preset.role,
        avatarUrl: result.user.avatarUrl,
        createdAt: result.user.createdAt
      };
      onSelectUser(profile);
      setIsLoading(false);
      onClose();
    } else {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2B59A]/40 overflow-hidden text-[#2C221E] transition-all">
        
        {/* Header banner */}
        <div className="bg-gradient-to-r from-[#B77466] to-[#957C62] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 w-8 h-8 rounded-full flex items-center justify-center text-lg transition"
          >
            ✕
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFE1AF] text-[#B77466] flex items-center justify-center font-bold text-xl shadow-xs">
              <KeyRound className="w-6 h-6 text-[#B77466]" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {currentUser ? 'User Profile Settings' : authMode === 'signin' ? 'Portal Sign In' : 'Create User Account'}
              </h2>
              <p className="text-xs text-[#FFE1AF]/90 font-medium">
                ClaimX Secure Email & Password Authentication
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Status Message */}
          {statusMessage && (
            <div className={`p-3.5 mb-4 rounded-2xl text-xs font-bold border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {statusMessage.text}
            </div>
          )}

          {/* Active User Session View */}
          {currentUser ? (
            <div className="space-y-6">
              <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E2B59A]/50 flex items-center gap-4">
                <img
                  src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.fullName)}`}
                  alt={currentUser.fullName}
                  className="w-14 h-14 rounded-full border-2 border-[#B77466] object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#2C221E] truncate">{currentUser.fullName}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Authenticated
                    </span>
                  </div>
                  <p className="text-xs text-[#957C62] truncate font-medium">{currentUser.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-[#B77466] text-white">
                      Role: {currentUser.role}
                    </span>
                    <span className="text-[10px] text-[#8F6218] bg-[#FFE1AF] px-2 py-0.5 rounded border border-[#E2B59A] font-bold flex items-center gap-1">
                      <Database className="w-3 h-3 text-[#B77466]" />
                      {isSupabaseConfigured ? 'Supabase Sync Active' : 'Local DB'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E2B59A]/30 pt-4 flex gap-3">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition active:scale-95"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white text-xs font-black transition active:scale-95"
                >
                  Continue Workspace
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Sign In / Sign Up / Users DB Mode Switcher */}
              <div className="flex bg-[#FAF7F2] p-1 rounded-2xl border border-[#E2B59A]/50 mb-5 text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setStatusMessage(null); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    authMode === 'signin'
                      ? 'bg-white text-[#B77466] shadow-xs border border-[#E2B59A]/40'
                      : 'text-[#957C62] hover:text-[#2C221E]'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setStatusMessage(null); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    authMode === 'signup'
                      ? 'bg-white text-[#B77466] shadow-xs border border-[#E2B59A]/40'
                      : 'text-[#957C62] hover:text-[#2C221E]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('users'); setStatusMessage(null); loadRegisteredUsers(); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    authMode === 'users'
                      ? 'bg-white text-[#B77466] shadow-xs border border-[#E2B59A]/40'
                      : 'text-[#957C62] hover:text-[#2C221E]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Users ({dbUsers.length})</span>
                </button>
              </div>

              {/* Form implementation */}
              {authMode === 'signin' ? (
                /* SIGN IN FORM */
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#957C62] uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-xs font-semibold text-[#2C221E] focus:outline-none focus:border-[#B77466]"
                      />
                      <Mail className="w-4 h-4 text-[#957C62] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#957C62] uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-xs font-semibold text-[#2C221E] focus:outline-none focus:border-[#B77466]"
                      />
                      <Lock className="w-4 h-4 text-[#957C62] absolute left-3.5 top-3.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-[#957C62] hover:text-[#2C221E]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-black text-xs uppercase tracking-wider shadow-xs transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Authenticating...' : 'Sign In to Portal'}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Preset Demo Accounts Quick Login */}
                  <div className="pt-3 border-t border-[#E2B59A]/30">
                    <span className="text-[11px] font-bold text-[#957C62] block mb-2 uppercase tracking-wider">
                      Quick Demo Accounts (1-Click)
                    </span>
                    <div className="space-y-1.5">
                      {PRESET_DEMO_ACCOUNTS.map((preset) => (
                        <button
                          key={preset.email}
                          type="button"
                          onClick={() => handlePresetSelect(preset)}
                          disabled={isLoading}
                          className="w-full p-2.5 rounded-xl border border-[#E2B59A]/40 bg-[#FAF7F2] hover:bg-[#FFE1AF]/40 text-left flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <span className="font-bold text-[#2C221E] block">{preset.name}</span>
                            <span className="text-[10px] text-[#957C62]">{preset.email}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#B77466] text-white uppercase">
                            {preset.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : authMode === 'signup' ? (
                /* SIGN UP FORM */
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#957C62] uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Preetham Gowda"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-xs font-semibold text-[#2C221E] focus:outline-none focus:border-[#B77466]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#957C62] uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-xs font-semibold text-[#2C221E] focus:outline-none focus:border-[#B77466]"
                      />
                      <Mail className="w-4 h-4 text-[#957C62] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#957C62] uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Create strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-xs font-semibold text-[#2C221E] focus:outline-none focus:border-[#B77466]"
                      />
                      <Lock className="w-4 h-4 text-[#957C62] absolute left-3.5 top-3.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-[#957C62] hover:text-[#2C221E]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-bold text-[#957C62] uppercase tracking-wider mb-2">
                      Assign Portal Role
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('claimant')}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          selectedRole === 'claimant'
                            ? 'border-[#B77466] bg-[#FFE1AF]/40 text-[#2C221E] font-bold'
                            : 'border-[#E2B59A]/40 bg-white text-[#957C62]'
                        }`}
                      >
                        <User className="w-4 h-4 text-[#B77466] mx-auto mb-1" />
                        <span className="text-[11px] block">Claimant</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole('agent')}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          selectedRole === 'agent'
                            ? 'border-[#B77466] bg-[#FFE1AF]/40 text-[#2C221E] font-bold'
                            : 'border-[#E2B59A]/40 bg-white text-[#957C62]'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 text-[#B77466] mx-auto mb-1" />
                        <span className="text-[11px] block">Agent</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole('admin')}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          selectedRole === 'admin'
                            ? 'border-[#B77466] bg-[#FFE1AF]/40 text-[#2C221E] font-bold'
                            : 'border-[#E2B59A]/40 bg-white text-[#957C62]'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4 text-[#B77466] mx-auto mb-1" />
                        <span className="text-[11px] block">Admin</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-black text-xs uppercase tracking-wider shadow-xs transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Creating Account & Recording...' : 'Create Account & Save to Supabase'}
                    <UserPlus className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 text-[11px] text-[#957C62] justify-center pt-1 font-semibold">
                    <Database className="w-3.5 h-3.5 text-[#B77466]" />
                    <span>User record is persisted into Supabase `public.users` table</span>
                  </div>
                </form>
              ) : (
                /* RECORDED USERS DB VIEW */
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2B59A]/40">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#B77466]" />
                      <span className="text-xs font-bold text-[#2C221E]">
                        {dbSource === 'supabase' ? 'Live Supabase `public.users`' : 'Local Recorded Users'}
                      </span>
                    </div>
                    <button
                      onClick={loadRegisteredUsers}
                      disabled={isFetchingUsers}
                      className="p-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#FFE1AF]/40 text-[#B77466] border border-[#E2B59A]/40 transition text-xs flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingUsers ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {dbUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E2B59A]/50 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName)}`}
                            alt={u.fullName}
                            className="w-8 h-8 rounded-full border border-[#B77466]"
                          />
                          <div>
                            <span className="font-bold text-[#2C221E] block">{u.fullName}</span>
                            <span className="text-[10px] text-[#957C62]">{u.email}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-[#B77466] text-white">
                            {u.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#957C62] text-center pt-2">
                    {dbSource === 'supabase'
                      ? '✓ Connected to Supabase PostgreSQL database'
                      : 'Configure Supabase credentials in top nav bar to sync directly to cloud.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
