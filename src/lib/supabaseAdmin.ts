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

  if (!isSupabaseConfigured()) {
    if (!_initWarned) {
      console.warn(
        '⚠️  Supabase is not configured (or is using placeholder values in .env). ' +
        'Server-side Supabase operations will fail and fallback locally. ' +
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
      );
      _initWarned = true;
    }
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    );
  }

  _supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return false;
  if (url.includes('your-project') || url.includes('your-project-id') || url === 'MY_SUPABASE_URL') return false;
  if (key.includes('your-service-role') || key.includes('your-key-here')) return false;

  return true;
}
