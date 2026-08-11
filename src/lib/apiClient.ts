import { getSupabaseClient } from './supabase';

/**
 * Authenticated fetch wrapper for API calls.
 * 
 * Automatically attaches the Supabase session's access_token
 * as an Authorization: Bearer header on every request.
 * 
 * Usage:
 *   const res = await apiFetch('/api/claims/list');
 *   const data = await res.json();
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const client = getSupabaseClient();
  let accessToken: string | null = null;

  if (client) {
    try {
      const { data: { session } } = await client.auth.getSession();
      accessToken = session?.access_token || null;
    } catch (err) {
      console.warn('Failed to retrieve Supabase session for API call:', err);
    }
  }

  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem('claimx_mock_token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 — session expired or invalid
  if (response.status === 401) {
    console.warn('API returned 401 — session may be expired. User should re-authenticate.');
    // Optionally trigger a re-auth flow here in the future
  }

  return response;
}
