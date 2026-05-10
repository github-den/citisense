import { useEffect, useState } from 'react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import { listDemoPosts } from '@core/services/demoPosts.js';
import { listBookmarkedPostIds } from '@core/services/localState.js';
import { supabase } from '@core/lib/supabase.js';
import { mapPosts } from '@core/utils/postMapper.js';
import shellStyles from '../CitizenDataPage.module.css';

function sortRowsBySavedOrder(rows, savedIds) {
  const rank = new Map(savedIds.slice().reverse().map((id, index) => [id, index]));
  return [...rows].sort((a, b) => {
    const orderA = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
}

async function fetchProfileMap(userIds) {
  if (!supabase || userIds.length === 0) return new Map();

  const profileResult = await supabase
    .from('profiles')
    .select('id, username, avatar')
    .in('id', userIds);

  if (!profileResult.error) {
    return new Map((profileResult.data ?? []).map((profile) => [profile.id, profile]));
  }

  const usersResult = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (usersResult.error) return new Map();

  return new Map((usersResult.data ?? []).map((user) => [
    user.id,
    {
      username: user.username,
      avatar: user.avatar_url ?? null,
    },
  ]));
}

async function hydrateProfiles(rows) {
  const userIds = [...new Set((rows ?? []).map((row) => row?.user_id).filter(Boolean))];
  const profileMap = await fetchProfileMap(userIds);
  return (rows ?? []).map((row) => ({
    ...row,
    profiles: row.profiles ?? profileMap.get(row.user_id) ?? null,
  }));
}

async function fetchSavedFeedbackRows(savedIds) {
  const savedIdSet = new Set(savedIds);
  const demoRows = listDemoPosts().filter((row) => savedIdSet.has(row.id));

  if (!supabase) {
    return sortRowsBySavedOrder(demoRows, savedIds);
  }

  const dbIds = savedIds.filter((id) => !String(id).startsWith('demo-'));
  if (dbIds.length === 0) {
    return sortRowsBySavedOrder(demoRows, savedIds);
  }

  const baseSelect = `
    id, user_id, caption, type, status, service,
    location:incident_location, feedback_no, raises_count, discuss_count,
    reacts_count, created_at, updated_at, image_url, image_urls,
    profiles ( username, avatar )
  `;

  const { data, error } = await supabase
    .from('feedbacks')
    .select(baseSelect)
    .in('id', dbIds);

  if (!error) {
    return sortRowsBySavedOrder([...(data ?? []), ...demoRows], savedIds);
  }

  const message = String(error?.message ?? '').toLowerCase();
  const needsFallback = message.includes('relationship') || message.includes('schema cache') || message.includes('could not find');
  if (!needsFallback) throw error;

  const { data: flatRows, error: flatError } = await supabase
    .from('feedbacks')
    .select('id, user_id, caption, type, status, service, location:incident_location, feedback_no, raises_count, discuss_count, reacts_count, created_at, updated_at, image_url, image_urls')
    .in('id', dbIds);

  if (flatError) throw flatError;

  const hydrated = await hydrateProfiles(flatRows ?? []);
  return sortRowsBySavedOrder([...hydrated, ...demoRows], savedIds);
}

export default function SavedPage({ embedded = false }) {
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);

  useEffect(() => {
    function handleBookmarksChanged() {
      setBookmarkVersion((value) => value + 1);
    }

    window.addEventListener('citisense:bookmarks-changed', handleBookmarksChanged);
    return () => {
      window.removeEventListener('citisense:bookmarks-changed', handleBookmarksChanged);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSavedPosts() {
      setLoading(true);
      setError(null);

      const savedIds = listBookmarkedPostIds();
      if (savedIds.length === 0) {
        if (!mounted) return;
        setSavedPosts([]);
        setLoading(false);
        return;
      }

      try {
        const rows = await fetchSavedFeedbackRows(savedIds);
        if (!mounted) return;
        setSavedPosts(mapPosts(rows));
      } catch (err) {
        if (!mounted) return;
        setError(err);
        setSavedPosts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSavedPosts();

    return () => {
      mounted = false;
    };
  }, [bookmarkVersion]);

  const countLabel = savedPosts.length > 0
    ? `${savedPosts.length} saved`
    : 'No saved items';

  const header = (
    <div className={shellStyles.headerRow}>
      <div>
        <h1 className={shellStyles.headerTitle}>Saved</h1>
        <p className={shellStyles.headerSub}>Feedback you bookmarked for follow-up.</p>
      </div>
      <span className={shellStyles.headerBadge}>{countLabel}</span>
    </div>
  );

  const content = (
    <>
      {!embedded ? <div className={shellStyles.stickyBar}>{header}</div> : null}

      <div className={shellStyles.body}>
        {loading ? (
          <>
            <FeedCardSkeleton />
            <FeedCardSkeleton />
          </>
        ) : error ? (
          <div className={shellStyles.zeroInset}>
            <div className={shellStyles.zeroState}>
              <p className={shellStyles.zeroTitle}>Saved feedback could not load.</p>
              <span className={shellStyles.zeroText}>Try refreshing the page in a moment.</span>
            </div>
          </div>
        ) : savedPosts.length === 0 ? (
          <div className={shellStyles.zeroInset}>
            <div className={shellStyles.zeroState}>
              <p className={shellStyles.zeroTitle}>Nothing saved yet.</p>
              <span className={shellStyles.zeroText}>Tap the bookmark on any feedback to save it here for follow-up.</span>
            </div>
          </div>
        ) : (
          savedPosts.map((post) => (
            <FeedCard key={post.id} post={post} />
          ))
        )}
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <div className={shellStyles.page}>
      {content}
    </div>
  );
}
