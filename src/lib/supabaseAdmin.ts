import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * This bypasses RLS — all authorization is enforced by Express middleware.
 * 
 * NEVER expose this client or its key to the frontend.
 * 
 * The client is created lazily on first access to avoid crashing
 * when environment variables are not yet configured.
 */

let _supabaseAdmin: SupabaseClient | null = null;
let _initWarned = false;

function getAdminClient(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    if (!_initWarned) {
      console.warn(
        '⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. ' +
        'Server-side Supabase operations will fail. ' +
        'Set these in your .env file.'
      );
      _initWarned = true;
    }
    // Return a dummy client that will fail on actual operations
    // but won't crash at module-load time
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    );
  }

  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseAdmin;
}

/**
 * Proxy object that lazily initializes the Supabase admin client.
 * This allows the server to start even if Supabase credentials
 * are not configured — errors occur only when actual DB operations
 * are attempted.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getAdminClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
