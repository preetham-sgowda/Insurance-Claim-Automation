import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClaimRecord, PolicyRecord, UserRole } from '../types/claim';
import { SEED_POLICIES } from '../data/seedPolicies';

// Helper to retrieve env vars or custom user config stored in localStorage
export function getSupabaseCredentials(): { url: string; key: string } {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('CLAIMX_SUPABASE_URL') || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('CLAIMX_SUPABASE_KEY') || '' : '';

  return {
    url: storedUrl || envUrl,
    key: storedKey || envKey
  };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();
  if (
    !url ||
    !key ||
    url === 'MY_SUPABASE_URL' ||
    url.includes('your-project') ||
    url.includes('your-project-id') ||
    key.includes('your-anon-key') ||
    key.includes('your-key-here')
  ) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key);
    } catch (err) {
      console.error('Failed to initialize Supabase Client:', err);
      return null;
    }
  }
  return supabaseInstance;
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('CLAIMX_SUPABASE_URL', url.trim());
    localStorage.setItem('CLAIMX_SUPABASE_KEY', key.trim());
    supabaseInstance = null; // reset instance
  }
}

// Local Storage Fallback Data Store for standalone seamless preview
const STORAGE_CLAIMS_KEY = 'CLAIMX_CLAIMS_DB_V1';
const STORAGE_POLICIES_KEY = 'CLAIMX_POLICIES_DB_V1';
const STORAGE_USERS_KEY = 'CLAIMX_USERS_DB_V1';

export interface StoredUserAccount {
  id: string;
  email: string;
  passwordHash?: string;
  fullName: string;
  role: 'claimant' | 'agent' | 'admin';
  avatarUrl?: string;
  createdAt: string;
}

const SEED_USERS: StoredUserAccount[] = [
  {
    id: 'usr-001',
    email: 'sgowdapreetham14@gmail.com',
    fullName: 'Preetham S Gowda',
    role: 'claimant',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Preetham',
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr-002',
    email: 'agent.claims@claimx.in',
    fullName: 'Rajesh Kumar',
    role: 'agent',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh',
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr-003',
    email: 'admin.supervisor@claimx.in',
    fullName: 'Dr. Sunita Sharma',
    role: 'admin',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sunita',
    createdAt: new Date().toISOString()
  }
];

export function getStoredUsers(): StoredUserAccount[] {
  if (typeof window === 'undefined') return SEED_USERS;
  const stored = localStorage.getItem(STORAGE_USERS_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(SEED_USERS));
    return SEED_USERS;
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_USERS;
  } catch {
    return SEED_USERS;
  }
}

export function saveStoredUser(user: StoredUserAccount): StoredUserAccount {
  const current = getStoredUsers();
  const existingIdx = current.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  let updated: StoredUserAccount[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...user };
  } else {
    updated = [user, ...current];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updated));
  }
  return user;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3f | 0x80);
    return v.toString(16);
  });
}

/**
 * Register user in Supabase public.users (and Auth if connected) as well as Local Storage
 */
export async function registerUserInSupabaseAndLocal(data: {
  email: string;
  password: string;
  fullName: string;
  role: 'claimant' | 'agent' | 'admin';
}): Promise<{ user: StoredUserAccount; supabaseSaved: boolean; error?: string }> {
  const { email, password, fullName, role } = data;
  const normalizedEmail = email.trim().toLowerCase();

  const generatedId = generateUUID();
  const newUser: StoredUserAccount = {
    id: generatedId,
    email: normalizedEmail,
    passwordHash: password, // stored for offline local validation
    fullName: fullName.trim(),
    role: role,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName.trim())}`,
    createdAt: new Date().toISOString()
  };

  saveStoredUser(newUser);

  let supabaseSaved = false;
  let supabaseError: string | undefined = undefined;
  const client = getSupabaseClient();

  if (client) {
    try {
      // 1. Try Supabase Auth Sign Up
      const { data: authData, error: authErr } = await client.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      });

      if (!authErr && authData?.user) {
        newUser.id = authData.user.id;
        saveStoredUser(newUser); // update with real auth UUID
      }

      // 2. Insert into public.users table
      const { error: dbErr } = await client.from('users').upsert(
        {
          id: newUser.id,
          email: normalizedEmail,
          full_name: fullName,
          role: role,
          created_at: newUser.createdAt
        },
        { onConflict: 'email' }
      );

      if (!dbErr) {
        supabaseSaved = true;
      } else {
        console.warn('Supabase DB insertion warning:', dbErr.message);
        supabaseError = dbErr.message;

        // Retry insertion without ID in case public.users uses auto-generated UUID primary key
        const { error: retryErr } = await client.from('users').upsert(
          {
            email: normalizedEmail,
            full_name: fullName,
            role: role,
            created_at: newUser.createdAt
          },
          { onConflict: 'email' }
        );

        if (!retryErr) {
          supabaseSaved = true;
          supabaseError = undefined;
        }
      }
    } catch (err: any) {
      console.warn('Supabase auth/sync notice:', err?.message || err);
      supabaseError = err?.message || String(err);
    }
  }

  return { user: newUser, supabaseSaved, error: supabaseError };
}

/**
 * Sign in user with Email and Password using Supabase Auth or local DB fallback
 */
export async function signInUserWithEmailPassword(data: {
  email: string;
  password: string;
}): Promise<{ user: StoredUserAccount | null; supabaseSaved: boolean; error?: string }> {
  const { email, password } = data;
  const normalizedEmail = email.trim().toLowerCase();

  const client = getSupabaseClient();
  let supabaseSaved = false;

  if (client) {
    try {
      // Try Supabase Auth
      const { data: authData, error: authErr } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      });

      if (!authErr && authData?.user) {
        supabaseSaved = true;

        // Fetch or ensure profile in public.users table
        const { data: dbUser } = await client
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (!dbUser) {
          // Record in public.users if not present
          await client.from('users').upsert({
            id: authData.user.id,
            email: normalizedEmail,
            full_name: authData.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
            role: authData.user.user_metadata?.role || 'claimant',
            created_at: new Date().toISOString()
          });
        }

        const user: StoredUserAccount = {
          id: authData.user.id,
          email: normalizedEmail,
          fullName: dbUser?.full_name || authData.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
          role: dbUser?.role || authData.user.user_metadata?.role || 'claimant',
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(dbUser?.full_name || normalizedEmail)}`,
          createdAt: authData.user.created_at || new Date().toISOString()
        };

        saveStoredUser(user);
        return { user, supabaseSaved: true };
      }
    } catch (err) {
      console.warn('Supabase signIn notice:', err);
    }
  }

  // Fallback to local storage validation/creation if Supabase is not configured
  if (!client) {
    const storedUsers = getStoredUsers();
    const matchedUser = storedUsers.find(u => u.email.toLowerCase() === normalizedEmail);

    if (matchedUser) {
      if (matchedUser.passwordHash && password && matchedUser.passwordHash !== password) {
        return { user: null, supabaseSaved: false, error: 'Incorrect password provided.' };
      }
      return { user: matchedUser, supabaseSaved: false };
    }

    // Auto-create a mock account for the demo presets if they don't exist yet
    const isAgent = normalizedEmail.includes('agent');
    const isAdmin = normalizedEmail.includes('admin');
    const role: UserRole = isAgent ? 'agent' : isAdmin ? 'admin' : 'claimant';
    
    const createdUser: StoredUserAccount = {
      id: 'usr-' + Math.random().toString(36).substring(2, 10),
      email: normalizedEmail,
      passwordHash: password,
      fullName: normalizedEmail.split('@')[0],
      role,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(normalizedEmail)}`,
      createdAt: new Date().toISOString()
    };

    saveStoredUser(createdUser);
    return { user: createdUser, supabaseSaved: false };
  }

  // If Supabase is configured but login failed
  return {
    user: null,
    supabaseSaved: false,
    error: 'Authentication failed. Please check your email and password, or sign up for a new account.'
  };
}

/**
 * Fetch all registered users from Supabase public.users table or local fallback
 */
export async function fetchSupabaseUsers(): Promise<{ users: StoredUserAccount[]; source: 'supabase' | 'local' }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        const mappedUsers: StoredUserAccount[] = data.map(u => ({
          id: u.id || generateUUID(),
          email: u.email,
          fullName: u.full_name || u.fullName || u.email,
          role: u.role || 'claimant',
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.full_name || u.email)}`,
          createdAt: u.created_at || new Date().toISOString()
        }));
        return { users: mappedUsers, source: 'supabase' };
      }
    } catch (err) {
      console.warn('Failed to fetch users from Supabase:', err);
    }
  }
  return { users: getStoredUsers(), source: 'local' };
}

export function getStoredPolicies(): PolicyRecord[] {
  if (typeof window === 'undefined') return SEED_POLICIES;
  const stored = localStorage.getItem(STORAGE_POLICIES_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_POLICIES_KEY, JSON.stringify(SEED_POLICIES));
    return SEED_POLICIES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_POLICIES;
  }
}

export function getStoredClaims(): ClaimRecord[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_CLAIMS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveStoredClaim(claim: ClaimRecord): ClaimRecord {
  const current = getStoredClaims();
  const index = current.findIndex(c => c.id === claim.id);
  let updated: ClaimRecord[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = claim;
  } else {
    updated = [claim, ...current];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CLAIMS_KEY, JSON.stringify(updated));
  }
  return claim;
}

export function updateStoredClaimStatus(id: string, updates: Partial<ClaimRecord>): ClaimRecord | null {
  const current = getStoredClaims();
  const index = current.findIndex(c => c.id === id);
  if (index < 0) return null;
  
  const updatedClaim = {
    ...current[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  current[index] = updatedClaim;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CLAIMS_KEY, JSON.stringify(current));
  }
  return updatedClaim;
}

// SQL Schema DDL String for user to easily set up PostgreSQL tables in Supabase
export const SUPABASE_SQL_DDL = `-- ==========================================
-- ClaimX Multi-Line Insurance Claims Schema
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'claimant',
  phone TEXT,
  aadhaar_masked TEXT,
  pan_masked TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Policy Holder Data Table
CREATE TABLE IF NOT EXISTS public.policy_holder_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number TEXT UNIQUE NOT NULL,
  insurance_type TEXT NOT NULL,
  sub_type TEXT,
  holder_name TEXT NOT NULL,
  holder_email TEXT NOT NULL,
  aadhaar_masked TEXT,
  pan_masked TEXT,
  sum_insured_or_idv NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active',
  nominee_name TEXT,
  nominee_relation TEXT,
  vehicle_number TEXT,
  property_address TEXT,
  travel_destination TEXT,
  business_name TEXT,
  co_pay_percentage NUMERIC DEFAULT 0,
  deductible_excess NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Claims Table
CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT UNIQUE NOT NULL,
  user_id TEXT,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  insurance_type TEXT NOT NULL,
  claim_sub_type TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  claimed_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  
  extracted_data JSONB,
  field_list JSONB,
  fraud_signals JSONB,
  overall_fraud_score NUMERIC DEFAULT 0,
  is_fraud_flagged BOOLEAN DEFAULT FALSE,
  
  policy_verified BOOLEAN DEFAULT FALSE,
  policy_match_details TEXT,
  
  estimation JSONB,
  agent_review JSONB,
  admin_decision JSONB,
  documents JSONB,
  
  pdf_report_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Fraud Logs Audit Table
CREATE TABLE IF NOT EXISTS public.fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
  insurance_type TEXT NOT NULL,
  signal_category TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_holder_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TIGHTENED RLS POLICIES (Role-Based Access)
-- ==========================================

-- USERS TABLE
DROP POLICY IF EXISTS "Allow public read/write users" ON public.users;
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow insert on signup" ON public.users;

CREATE POLICY "Users read own profile"
  ON public.users FOR SELECT
  USING (
    auth.uid()::text = id
    OR (SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin'
  );

CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid()::text = id);

CREATE POLICY "Allow insert on signup"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid()::text = id);

-- CLAIMS TABLE
DROP POLICY IF EXISTS "Allow public read/write for demo" ON public.claims;
DROP POLICY IF EXISTS "Claimants read own claims" ON public.claims;
DROP POLICY IF EXISTS "Claimants insert own claims" ON public.claims;
DROP POLICY IF EXISTS "Agents and admins update claims" ON public.claims;

CREATE POLICY "Claimants read own claims"
  ON public.claims FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR (SELECT role FROM public.users WHERE id = auth.uid()::text) IN ('agent', 'admin')
  );

CREATE POLICY "Claimants insert own claims"
  ON public.claims FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Agents and admins update claims"
  ON public.claims FOR UPDATE
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()::text) IN ('agent', 'admin')
  );

-- POLICY_HOLDER_DATA TABLE
DROP POLICY IF EXISTS "Allow public read/write policies" ON public.policy_holder_data;
DROP POLICY IF EXISTS "Authenticated users read policies" ON public.policy_holder_data;
DROP POLICY IF EXISTS "Admins manage policies" ON public.policy_holder_data;

CREATE POLICY "Authenticated users read policies"
  ON public.policy_holder_data FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins manage policies"
  ON public.policy_holder_data FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin'
  );

-- FRAUD_LOGS TABLE
DROP POLICY IF EXISTS "Allow public read/write fraud_logs" ON public.fraud_logs;
DROP POLICY IF EXISTS "Agents and admins read fraud logs" ON public.fraud_logs;

CREATE POLICY "Agents and admins read fraud logs"
  ON public.fraud_logs FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()::text) IN ('agent', 'admin')
  );
`;
