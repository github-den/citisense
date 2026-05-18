import { supabase } from '@core/lib/supabase.js';

async function rpc(fn, params) {
  if (!supabase) return { error: null };
  const { data, error } = await supabase.rpc(fn, params);
  return { data, error };
}

function isMissingRpcFunction(error, fn) {
  const message = String(error?.message ?? '').toLowerCase();
  const target = String(fn ?? '').toLowerCase();
  return message.includes('schema cache')
    || message.includes('could not find the function')
    || message.includes('function')
    || (target && message.includes(target));
}

async function getCurrentUserId() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getAccessToken() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function tryPersistReaction(postId, userId, emoji) {
  if (!supabase || !postId || !userId) return { data: null, error: null };

  const clearResult = await supabase
    .from('reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (clearResult.error) return clearResult;
  if (!emoji) return { ...clearResult, data: { fallback: 'table', removed: true } };

  const payload = {
    post_id: postId,
    user_id: userId,
    emoji,
    updated_at: new Date().toISOString(),
  };

  const insertResult = await supabase
    .from('reactions')
    .insert(payload)
    .select('post_id, emoji')
    .maybeSingle();

  if (!insertResult.error) return { ...insertResult, data: { ...(insertResult.data ?? {}), fallback: 'table' } };
  return insertResult;
}

async function tryInsertBookmark(postId, userId) {
  if (!supabase || !postId || !userId) return { data: null, error: null };

  const bookmarkPayload = { post_id: postId, user_id: userId };

  const primaryInsert = await supabase
    .from('bookmarks')
    .insert(bookmarkPayload)
    .select('post_id')
    .maybeSingle();

  if (!primaryInsert.error) return primaryInsert;
  if (primaryInsert.error.code === '23505') return { data: { post_id: postId }, error: null };

  const message = String(primaryInsert.error.message ?? '').toLowerCase();
  const missingTable = message.includes('relation') || message.includes('does not exist');
  if (!missingTable) return primaryInsert;

  return supabase
    .from('saved_posts')
    .insert(bookmarkPayload)
    .select('post_id')
    .maybeSingle();
}

async function tryDeleteBookmark(postId, userId) {
  if (!supabase || !postId || !userId) return { data: null, error: null };

  const primaryDelete = await supabase
    .from('bookmarks')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);

  if (!primaryDelete.error) return primaryDelete;

  const message = String(primaryDelete.error.message ?? '').toLowerCase();
  const missingTable = message.includes('relation') || message.includes('does not exist');
  if (!missingTable) return primaryDelete;

  return supabase
    .from('saved_posts')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
}

async function fetchExactRaiseCount(postId) {
  if (!supabase || !postId) return null;

  const { count, error } = await supabase
    .from('raises')
    .select('post_id', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) {
    console.error('Error fetching exact raise count:', error);
    return null;
  }

  return count ?? 0;
}

export const raisePost = async (postId, passedUserId = null) => {
  try {
    // 1. Prioritize passed ID (for demo users)
    let finalUserId = passedUserId;
    
    // 2. Fallback to auth session
    if (!finalUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    }

    if (!finalUserId) return { error: new Error('User not authenticated') };

    // Handle Demo Users
    if (finalUserId && finalUserId.startsWith('demo-')) {
      console.log('[raisePost] Demo user detected, skipping DB write:', finalUserId);
      
      try {
        const demoRaises = JSON.parse(localStorage.getItem('citisense_demo_raises') || '{}');
        demoRaises[postId] = true;
        localStorage.setItem('citisense_demo_raises', JSON.stringify(demoRaises));
      } catch (e) {
        console.error('Error saving demo raise:', e);
      }
      
      return { data: { success: true }, error: null };
    }

    console.log('[raisePost] Attempting DB write for user:', finalUserId);
    const res = await rpc('raise_post', { p_post_id: postId });
    if (!res.error) {
      const exactCount = await fetchExactRaiseCount(postId);
      if (typeof exactCount === 'number') {
        return { ...res, data: { ...(res.data ?? {}), raises_count: exactCount } };
      }
      return res;
    }

    if (supabase) {
      // 1. Record the raise (using minimal return to avoid 403 select issues)
      const { error: insertErr } = await supabase
        .from('raises')
        .insert({ post_id: postId, user_id: finalUserId });

      if (insertErr && insertErr.code !== '23505') return { error: insertErr };

      // 2. Increment count on feedbacks table
      const { data: post } = await supabase.from('feedbacks').select('raises_count').eq('id', postId).single();
      const currentCount = post?.raises_count ?? 0;

      const updateResult = await supabase
        .from('feedbacks')
        .update({ raises_count: currentCount + 1 })
        .eq('id', postId);

      if (updateResult.error) return updateResult;

      const exactCount = await fetchExactRaiseCount(postId);
      return {
        ...updateResult,
        data: { ...(updateResult.data ?? {}), raises_count: exactCount ?? (currentCount + 1) },
      };
    }
    return res;
  } catch (err) {
    return { error: err };
  }
};

export const unraisePost = async (postId, passedUserId = null) => {
  try {
    // 1. Prioritize passed ID (for demo users)
    let finalUserId = passedUserId;
    
    // 2. Fallback to auth session
    if (!finalUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    }

    if (!finalUserId) return { error: new Error('User not authenticated') };

    // Handle Demo Users
    if (finalUserId && finalUserId.startsWith('demo-')) {
      console.log('[unraisePost] Demo user detected, skipping DB write:', finalUserId);
      
      try {
        const demoRaises = JSON.parse(localStorage.getItem('citisense_demo_raises') || '{}');
        delete demoRaises[postId];
        localStorage.setItem('citisense_demo_raises', JSON.stringify(demoRaises));
      } catch (e) {
        console.error('Error removing demo raise:', e);
      }
      
      return { data: { success: true }, error: null };
    }

    const res = await rpc('unraise_post', { p_post_id: postId });
    if (!res.error) {
      const exactCount = await fetchExactRaiseCount(postId);
      if (typeof exactCount === 'number') {
        return { ...res, data: { ...(res.data ?? {}), raises_count: exactCount } };
      }
      return res;
    }

    if (supabase) {
      // 1. Remove the raise record
      const { error: deleteErr } = await supabase
        .from('raises')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', finalUserId);

      if (deleteErr) return { error: deleteErr };

      // 2. Decrement count on feedbacks table
      const { data: post } = await supabase.from('feedbacks').select('raises_count').eq('id', postId).single();
      const currentCount = post?.raises_count ?? 0;

      const updateResult = await supabase
        .from('feedbacks')
        .update({ raises_count: Math.max(0, currentCount - 1) })
        .eq('id', postId);

      if (updateResult.error) return updateResult;

      const exactCount = await fetchExactRaiseCount(postId);
      return {
        ...updateResult,
        data: { ...(updateResult.data ?? {}), raises_count: exactCount ?? Math.max(0, currentCount - 1) },
      };
    }
    return res;
  } catch (err) {
    return { error: err };
  }
};
export const reactPost = async (postId, emoji) => {
  if (!supabase || !postId) return { data: null, error: null };

  const rpcResult = await rpc('react_post', { p_post_id: postId, p_emoji: emoji });
  if (!rpcResult.error) return rpcResult;
  if (!isMissingRpcFunction(rpcResult.error, 'react_post')) return rpcResult;

  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: new Error('User not authenticated') };

  return tryPersistReaction(postId, userId, emoji);
};
export const bookmarkPost  = async (postId) => {
  if (!supabase || !postId) return { data: { localOnly: true }, error: null };

  const rpcResult = await rpc('bookmark_post', { p_post_id: postId });
  if (!rpcResult.error) return rpcResult;
  if (!isMissingRpcFunction(rpcResult.error, 'bookmark_post')) return rpcResult;

  const userId = await getCurrentUserId();
  if (!userId) return { data: { localOnly: true }, error: null };

  const fallbackResult = await tryInsertBookmark(postId, userId);
  if (!fallbackResult.error) return { ...fallbackResult, data: { ...(fallbackResult.data ?? {}), fallback: 'table' } };

  const fallbackMessage = String(fallbackResult.error?.message ?? '').toLowerCase();
  const unsupported = fallbackMessage.includes('relation')
    || fallbackMessage.includes('does not exist')
    || fallbackMessage.includes('permission denied')
    || fallbackMessage.includes('row-level security');
  if (unsupported) return { data: { localOnly: true, fallback: 'local' }, error: null };

  return fallbackResult;
};
export const unbookmarkPost= async (postId) => {
  if (!supabase || !postId) return { data: { localOnly: true }, error: null };

  const rpcResult = await rpc('unbookmark_post', { p_post_id: postId });
  if (!rpcResult.error) return rpcResult;
  if (!isMissingRpcFunction(rpcResult.error, 'unbookmark_post')) return rpcResult;

  const userId = await getCurrentUserId();
  if (!userId) return { data: { localOnly: true }, error: null };

  const fallbackResult = await tryDeleteBookmark(postId, userId);
  if (!fallbackResult.error) return { ...fallbackResult, data: { ...(fallbackResult.data ?? {}), fallback: 'table' } };

  const fallbackMessage = String(fallbackResult.error?.message ?? '').toLowerCase();
  const unsupported = fallbackMessage.includes('relation')
    || fallbackMessage.includes('does not exist')
    || fallbackMessage.includes('permission denied')
    || fallbackMessage.includes('row-level security');
  if (unsupported) return { data: { localOnly: true, fallback: 'local' }, error: null };

  return fallbackResult;
};
export const followUser = async (userId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const finalUserId = user?.id;

    // Handle Demo Users
    if (finalUserId && finalUserId.startsWith('demo-')) {
      const demoFollows = JSON.parse(localStorage.getItem('citisense_demo_follows') || '[]');
      if (!demoFollows.includes(userId)) {
        demoFollows.push(userId);
        localStorage.setItem('citisense_demo_follows', JSON.stringify(demoFollows));
      }
      return { data: { success: true }, error: null };
    }

    return await rpc('follow_user', { p_user_id: userId });
  } catch (err) {
    return { error: err };
  }
};

export const unfollowUser = async (userId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const finalUserId = user?.id;

    // Handle Demo Users
    if (finalUserId && finalUserId.startsWith('demo-')) {
      const demoFollows = JSON.parse(localStorage.getItem('citisense_demo_follows') || '[]');
      const filtered = demoFollows.filter(id => id !== userId);
      localStorage.setItem('citisense_demo_follows', JSON.stringify(filtered));
      return { data: { success: true }, error: null };
    }

    return await rpc('unfollow_user', { p_user_id: userId });
  } catch (err) {
    return { error: err };
  }
};

export const flagPost = async (postId, reasons = []) => {
  if (!supabase || !postId) return { data: null, error: new Error('Supabase is not configured.') };

  const normalizedReasons = Array.isArray(reasons)
    ? reasons.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];

  const accessToken = await getAccessToken();
  if (!accessToken) return { data: null, error: new Error('You must be signed in to report.') };

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        entityType: 'feedback',
        entityId: postId,
        selectedFlags: normalizedReasons,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: new Error(payload?.error ?? 'Unable to submit report.') };
    }

    return {
      data: {
        ...(payload ?? {}),
        fallback: 'api',
        selected_flags: normalizedReasons,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
};



export async function postDiscuss(postId, body, { parentId = null, imageUrl = null, userId = null } = {}) {
  const result = await rpc('post_discuss', { p_post_id: postId, p_body: body, p_parent_id: parentId, p_image_url: imageUrl });
  if (!result.error || !supabase || !userId) return result;

  const rpcMessage = (result.error?.message ?? '').toLowerCase();
  const canFallback = rpcMessage.includes('could not find')
    || rpcMessage.includes('schema cache')
    || rpcMessage.includes('function')
    || rpcMessage.includes('post_discuss');
  if (!canFallback) return result;

  const discussionInsert = await supabase
    .from('discussions')
    .insert({ post_id: postId, user_id: userId, parent_id: parentId, body, image_url: imageUrl })
    .select('id')
    .single();

  if (!discussionInsert.error) return discussionInsert;

  return supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, parent_id: parentId, content: body, image_url: imageUrl })
    .select('id')
    .single();
}

export async function setDiscussionRaise(entryId, shouldRaise, { sourceTable = 'discussions' } = {}) {
  if (!supabase || !entryId) return { data: null, error: new Error('Supabase is not configured.') };

  const accessToken = await getAccessToken();
  if (!accessToken) return { data: null, error: new Error('You must be signed in to raise.') };

  try {
    const response = await fetch('/api/discussion-raises', {
      method: shouldRaise ? 'POST' : 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        entryId,
        sourceTable: sourceTable === 'comments' ? 'comments' : 'discussions',
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: new Error(payload?.error ?? 'Unable to update raise.') };
    }

    return { data: payload, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createFeedbackPost({ userId, content, type, service, location, barangay, evidenceNote, imageUrl = null, imageUrls = [], profile, flags = [] }) {
  if (userId?.startsWith('demo-')) {
    const { upsertDemoPost } = await import('./demoPosts.js');
    const newPost = upsertDemoPost({
      id: `demo-${Date.now()}`,
      content,
      type,
      service,
      location: location || barangay,
      barangay,
      user_id: userId,
      created_at: new Date().toISOString(),
      profiles: {
        username: profile?.username || 'citizen',
        avatar: profile?.avatar || '/avatars/avatar_1.png'
      }
    });
    return { data: newPost, error: null };
  }

  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') };

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const response = await fetch('/api/feedbacks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId,
        content,
        type,
        service,
        location,
        barangay,
        evidenceNote,
        imageUrl,
        imageUrls,
        flags,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: new Error(payload?.error ?? 'Submission failed.') };
    }

    return { data: payload, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
