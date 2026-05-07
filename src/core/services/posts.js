import { supabase } from '@core/lib/supabase.js';

async function rpc(fn, params) {
  if (!supabase) return { error: null };
  const { data, error } = await supabase.rpc(fn, params);
  return { data, error };
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
    if (!res.error) return res;

    if (supabase) {
      // 1. Record the raise (using minimal return to avoid 403 select issues)
      const { error: insertErr } = await supabase
        .from('raises')
        .insert({ post_id: postId, user_id: finalUserId });

      if (insertErr && insertErr.code !== '23505') return { error: insertErr };

      // 2. Increment count on feedbacks table
      const { data: post } = await supabase.from('feedbacks').select('raises_count').eq('id', postId).single();
      const currentCount = post?.raises_count ?? 0;

      return supabase
        .from('feedbacks')
        .update({ raises_count: currentCount + 1 })
        .eq('id', postId);
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
    if (!res.error) return res;

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

      return supabase
        .from('feedbacks')
        .update({ raises_count: Math.max(0, currentCount - 1) })
        .eq('id', postId);
    }
    return res;
  } catch (err) {
    return { error: err };
  }
};
export const reactPost     = (postId, emoji) => rpc('react_post', { p_post_id: postId, p_emoji: emoji });
export const bookmarkPost  = (postId) => rpc('bookmark_post',  { p_post_id: postId });
export const unbookmarkPost= (postId) => rpc('unbookmark_post',{ p_post_id: postId });
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

export const flagPost      = (postId) => rpc('flag_post',      { p_post_id: postId });



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

  const modernPayload = {
    user_id: userId || null,
    caption: content || '',
    type: type || null,
    service: service || null,
    incident_location: location || barangay || 'Unknown',
    image_url: imageUrl || null,
    image_urls: imageUrls || [],
  };

  try {
    const result = await supabase
      .from('feedbacks')
      .insert(modernPayload)
      .select('id, feedback_no')
      .single();

    if (!result.error) return result;

    const message = result.error.message?.toLowerCase() ?? '';
    // If it's a legacy schema error, try the fallback with more column variations
    if (message.includes('author_id') || message.includes('category') || message.includes('caption') || message.includes('incident_location')) {
      return await supabase
        .from('feedbacks')
        .insert({
          user_id: userId || null,
          caption: content || '',
          type: type || null,
          category: type || null,
          service: service || null,
          incident_location: location || barangay || 'Unknown',
          image_urls: imageUrls || [],
        })
        .select('id, feedback_no')
        .single();
    }

    return result;
  } catch (err) {
    return { data: null, error: err };
  }
}
