import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { mapPosts } from '@core/utils/postMapper.js';
import { listDemoPosts } from '@core/services/demoPosts.js';

const POST_SELECT = '*';
const PAGE_SIZE = 20;

function uniqueIds(rows) {
  return [...new Set(
    rows
      .map(row => row?.user_id ?? row?.author_id)
      .filter(Boolean)
  )];
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

async function fetchFeedboxMap(feedboxIds) {
  if (feedboxIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('feedboxes')
    .select('id, topic')
    .in('id', feedboxIds);

  if (error) return new Map();
  return new Map((data ?? []).map(feedbox => [feedbox.id, feedbox]));
}

async function fetchFollowingIds(currentUserId) {
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId);

  if (error) {
    console.error('Error fetching following IDs:', error);
    return [];
  }
  return (data ?? []).map(row => row.following_id).filter(Boolean);
}



async function fetchUserRaises(currentUserId, postIds) {
  if (!currentUserId || postIds.length === 0) return new Set();
  
  const { data, error } = await supabase
    .from('raises')
    .select('post_id')
    .eq('user_id', currentUserId)
    .in('post_id', postIds);

  if (error) {
    console.error('Error fetching user raises:', error);
    return new Set();
  }
  return new Set((data ?? []).map(row => row.post_id));
}

async function fetchUserReactions(userId, postIds) {
  if (!supabase || !userId || postIds.length === 0) return new Map();

  const { data } = await supabase
    .from('reactions')
    .select('post_id, emoji')
    .eq('user_id', userId)
    .in('post_id', postIds);
  
  const map = new Map();
  (data ?? []).forEach(row => map.set(row.post_id, row.emoji));
  return map;
}

async function hydrateRows(rows, currentUserId) {
  if (rows.length === 0) return [];
  const postIds = rows.map(r => r.id).filter(Boolean);
  const userIds = [...new Set(rows.map(row => row.user_id ?? row.author_id).filter(Boolean))];
  const feedboxIds = [...new Set(rows.map(row => row?.feedbox_id).filter(Boolean))];

  // Fetch all metadata in parallel for better performance
  const [authorMap, feedboxMap, raisedIds, followingIds, reactionMap] = await Promise.all([
    fetchAuthorMap(userIds),
    fetchFeedboxMap(feedboxIds),
    fetchUserRaises(currentUserId, postIds),
    (async () => {
      if (!currentUserId) return new Set();
      const ids = await fetchFollowingIds(currentUserId);
      return new Set(ids);
    })(),
    fetchUserReactions(currentUserId, postIds)
  ]);

  return rows.map(row => {
    const userId = row.user_id ?? row.author_id;
    return {
      ...row,
      profiles: row.profiles ?? authorMap.get(userId) ?? null,
      feedboxes: row.feedboxes ?? feedboxMap.get(row.feedbox_id) ?? null,
      raisedByMe: raisedIds.has(row.id),
      followedByMe: followingIds.has(userId),
      myReaction: reactionMap.get(row.id) || null
    };
  });
}

export function useFeed({ status, userId, tab = 'forYou', currentUserId, currentBarangay } = {}) {
  const [posts,       setPosts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(true);
  const [page,        setPage]        = useState(0);

  const fetchPosts = useCallback(async (pageNum, isInitial = false) => {
    if (!supabase) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    // Guard: If we're on a tab that requires a user context but don't have it yet, skip
    if (!userId && !currentUserId && (tab === 'activity' || tab === 'following' || tab === 'neighbor' || tab === 'barangay')) {
      setPosts([]);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      return;
    }

    try {

      let scopedUserIds = null;
      let effectiveUserId = userId;

      if (!effectiveUserId && tab === 'activity') {
        effectiveUserId = currentUserId;
      }

      if (!effectiveUserId && tab === 'following') {
        scopedUserIds = await fetchFollowingIds(currentUserId);
      }

      if (!effectiveUserId && (tab === 'neighbor' || tab === 'barangay')) {
        // Handled by direct column filter below
      }

      if (scopedUserIds && scopedUserIds.length === 0) {
        setPosts([]);
        setLoading(false);
        setLoadingMore(false);
        setHasMore(false);
        return;
      }

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('feedbacks')
        .select(POST_SELECT)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (status) query = query.eq('status', status);
      if (effectiveUserId) query = query.eq('user_id', effectiveUserId);
      if (scopedUserIds) query = query.in('user_id', scopedUserIds);
      if (!effectiveUserId && (tab === 'neighbor' || tab === 'barangay') && currentBarangay) {
        query = query.eq('barangay', currentBarangay);
      }

      const { data, error: err } = await query;

      if (err) throw err;

      const hydrated = await hydrateRows(data ?? [], currentUserId);
      const mapped = mapPosts(hydrated);

      if (isInitial) setPosts(mapped);
      else setPosts(prev => [...prev, ...mapped]);

      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentBarangay, currentUserId, status, tab, userId]);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  }, [fetchPosts, hasMore, loading, loadingMore, page]);

  const refresh = useCallback(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
  }, [fetchPosts]);

  return { posts, loading, loadingMore, error, hasMore, loadMore, refresh };
}
