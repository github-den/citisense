import { supabase } from '@core/lib/supabase.js';

function noClient() {
  throw new Error('Supabase is not configured.');
}

export async function reportEntity({ entityType, entityId, reason, description, selectedFlags = [] }) {
  if (!supabase) noClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return { error: new Error('You must be signed in to report.') };

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        entityType,
        entityId,
        reason,
        description,
        selectedFlags,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { error: new Error(payload?.error ?? 'Unable to submit report.') };
    }

    return { data: payload, error: null };
  } catch (error) {
    return { error };
  }
}

export async function blockUser(userId) {
  if (!supabase) noClient();
  const { data: userData } = await supabase.auth.getUser();
  const blockerId = userData?.user?.id;
  if (!blockerId) return { error: new Error('You must be signed in to block.') };

  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: blockerId,
    blocked_id: userId,
  });
  return { error };
}
