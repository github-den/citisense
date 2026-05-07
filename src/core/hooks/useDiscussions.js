import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { formatTime, getInitials } from '@core/utils/format.js';

function mapDiscussion(row) {
  const profile = row?.profiles ?? {};
  const username = profile.username || 'citizen';
  const fullName = username;
  const initials = getInitials(username) || 'C';
  const bg = profile.avatar || '/avatars/avatar_1.png';

  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentId: row.parent_id,
    body: row.body ?? row.content,
    imageUrl: row.image_url,
    likes: row.likes_count ?? 0,
    isAdmin: !!(row.is_admin ?? row.is_admin_comment),
    isPinned: !!row.is_pinned,
    createdAt: row.created_at,
    time: formatTime(row.created_at),
    author: {
      fullName,
      username: username.startsWith('@') ? username : `@${username}`,
      initials,
      bg,
    },
  };
}

function uniqueIds(rows) {
  return [...new Set(rows.map(row => row?.user_id).filter(Boolean))];
}

async function fetchAuthorMap(userIds) {
  if (userIds.length === 0) return new Map();

  const profileResult = await supabase
    .from('profiles')
    .select('id, username, avatar')
    .in('id', userIds);

  if (!profileResult.error) {
    return new Map((profileResult.data ?? []).map(profile => [profile.id, profile]));
  }

  const usersResult = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (usersResult.error) return new Map();

  return new Map((usersResult.data ?? []).map(user => [
    user.id,
    {
      username: user.username,
      avatar: user.avatar_url ?? null,
    },
  ]));
}

async function hydrateRows(rows) {
  const authorMap = await fetchAuthorMap(uniqueIds(rows));
  return rows.map(row => ({
    ...row,
    profiles: row.profiles ?? authorMap.get(row.user_id) ?? null,
  }));
}

export function useDiscussions(postId, refreshKey = 0) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!supabase || !postId) { setLoading(false); return; }

    setLoading(true);
    supabase
      .from('discussions')
      .select(`
        id, post_id, user_id, parent_id, body, image_url, likes_count, is_admin, is_pinned, created_at,
        profiles ( username, avatar )
      `)
      .eq('post_id', postId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(120)
      .then(async ({ data, error: err }) => {
        if (!mounted) return;
        if (!err) {
          setRows(data ?? []);
          setLoading(false);
          return;
        }

        const { data: flat, error: flatErr } = await supabase
          .from('discussions')
          .select('id, post_id, user_id, parent_id, body, image_url, likes_count, is_admin, is_pinned, created_at')
          .eq('post_id', postId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(120);

        if (!flatErr) {
          const hydrated = await hydrateRows(flat ?? []);
          setRows(hydrated);
          setLoading(false);
          return;
        }

        const { data: legacy, error: legacyErr } = await supabase
          .from('comments')
          .select('id, post_id, user_id, parent_id, content, image_url, likes_count, is_admin_comment, is_pinned, created_at')
          .eq('post_id', postId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(120);

        if (legacyErr) setError(legacyErr);
        else {
          const hydrated = await hydrateRows(legacy ?? []);
          setRows(hydrated);
        }
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [postId, refreshKey]);

  const discussions = useMemo(() => (rows ?? []).map(mapDiscussion), [rows]);

  return { discussions, loading, error };
}


