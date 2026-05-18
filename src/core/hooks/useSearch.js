import { useState, useEffect } from 'react';
import { attachTopLevelDiscussionCounts, fetchTopLevelDiscussionCountMap } from '@core/services/discussionState.js';
import { supabase } from '@core/lib/supabase.js';
import { attachReportedByMe, fetchUserReportedPostIds } from '@core/services/reportState.js';
import { mapPosts } from '@core/utils/postMapper.js';
import { searchDemoPosts } from '@core/services/demoPosts.js';

export function useSearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!query?.trim()) { setResults([]); return; }
    if (!supabase) {
      setResults(mapPosts(searchDemoPosts(query)));
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('feedbacks')
      .select(`
        id, user_id, caption, type, status, service,
        location:incident_location, feedback_no, raises_count, discuss_count,
        reacts_count, created_at, image_url, image_urls,
        profiles ( username, avatar )
      `)
      .ilike('caption', `%${query}%`)
      .order('created_at', { ascending: false })
      .then(async ({ data, error: err }) => {
        if (err) {
          const local = searchDemoPosts(query);
          if (local.length > 0) setResults(mapPosts(local));
          else setError(err);
        } else {
          const postIds = (data ?? []).map((row) => row?.id).filter(Boolean);
          const [reportedIds, discussionCountMap] = await Promise.all([
            fetchUserReportedPostIds(postIds),
            fetchTopLevelDiscussionCountMap(postIds),
          ]);
          const mapped = mapPosts(attachTopLevelDiscussionCounts(attachReportedByMe(data ?? [], reportedIds), discussionCountMap));
          if (mapped.length === 0) {
            const local = searchDemoPosts(query);
            if (local.length > 0) setResults(mapPosts(local));
            else setResults(mapped);
          } else {
            setResults(mapped);
          }
        }
        setLoading(false);
      });
  }, [query]);

  return { results, loading, error };
}

