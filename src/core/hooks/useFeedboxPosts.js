import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { mapPosts } from '@core/utils/postMapper.js';

function popularityScore(row) {
  const raises = Number(row?.raises_count ?? 0);
  const discuss = Number(row?.discuss_count ?? 0);
  return (raises + discuss) / 2;
}

export function useFeedboxPosts(feedboxId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!supabase || !feedboxId) { setLoading(false); return; }

    setLoading(true);
    supabase
      .from('feedbacks')
      .select(`
        id, user_id, caption, type, status, service,
        location:incident_location, feedback_no, raises_count, discuss_count,
        reacts_count, shares_count, created_at, image_url, image_urls,
        profiles ( username, avatar )
      `)
      .eq('service', feedboxId)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(async ({ data, error: err }) => {
        if (!mounted) return;
        if (!err) {
          setRows(data ?? []);
          setLoading(false);
          return;
        }

        const msg = (err?.message ?? '').toLowerCase();
        const needsFallback = msg.includes('relationship') || msg.includes('schema cache') || msg.includes('could not find');
        if (!needsFallback) {
          setError(err);
          setLoading(false);
          return;
        }

        const { data: flat, error: flatErr } = await supabase
          .from('feedbacks')
          .select('id, user_id, caption, type, status, service, location:incident_location, feedback_no, raises_count, discuss_count, reacts_count, shares_count, created_at, image_url, image_urls')
          .eq('service', feedboxId)
          .order('created_at', { ascending: false })
          .limit(80);

        if (flatErr) setError(flatErr);
        else setRows(flat ?? []);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [feedboxId]);

  const posts = useMemo(() => mapPosts(rows ?? []), [rows]);

  const popular = useMemo(() => {
    const sorted = [...(rows ?? [])].sort((a, b) => popularityScore(b) - popularityScore(a));
    return mapPosts(sorted);
  }, [rows]);

  const recent = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const sorted = [...(rows ?? [])].sort((a, b) => {
      const aTime = new Date(a?.created_at ?? 0).getTime();
      const bTime = new Date(b?.created_at ?? 0).getTime();
      const aRecent = now - aTime <= dayMs ? 1 : 0;
      const bRecent = now - bTime <= dayMs ? 1 : 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      return bTime - aTime;
    });
    return mapPosts(sorted);
  }, [rows]);

  return { posts, popular, recent, loading, error, raw: rows };
}

