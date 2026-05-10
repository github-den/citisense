import { createClient } from '@supabase/supabase-js';

let authClient = null;

function getSupabaseAuthClient() {
  if (authClient) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  authClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return authClient;
}

export async function requireRequestUser(request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    return { user: null, error: 'Not authenticated.', status: 401 };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { user: null, error: 'Supabase is not configured.', status: 500 };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: 'Authentication expired. Please sign in again.', status: 401 };
  }

  return { user: data.user, error: null, status: 200 };
}
