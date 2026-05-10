import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

function countByTopicId(rows = []) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = String(row?.topic_id ?? '');
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function fetchRaisesMap(postIds) {
  if (!supabase || postIds.length === 0) return new Map();

  const map = new Map();
  const chunkSize = 500;
  for (let i = 0; i < postIds.length; i += chunkSize) {
    const chunk = postIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('feedbacks')
      .select('id, raises_count')
      .in('id', chunk);

    if (!error) {
      (data ?? []).forEach((row) => {
        map.set(String(row.id), Number(row.raises_count ?? 0));
      });
      continue;
    }

    // If feedbacks isn't the active table, ignore and fall back to 0 raises.
    if (!isSchemaMismatch(error)) throw error;
  }

  return map;
}

export function useTopicFeedboxes({ autoRefreshMs = 30 * 60 * 1000 } = {}) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!autoRefreshMs) return undefined;
    const id = window.setInterval(() => setRefreshKey((v) => v + 1), autoRefreshMs);
    return () => window.clearInterval(id);
  }, [autoRefreshMs]);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setTopics([]);
      setLoading(false);
      setError(null);
      return () => { mounted = false; };
    }

    setLoading(true);
    setError(null);

    Promise.all([
      supabase
        .from('topic_feedbox')
        .select('id, title, keywords, score, rank, created_at')
        .order('rank', { ascending: true }),
      supabase
        .from('topic_feedbox_posts')
        .select('topic_id, post_id'),
    ])
      .then(async ([topicResult, mappingResult]) => {
        if (!mounted) return;
        if (topicResult.error) throw topicResult.error;
        if (mappingResult.error && !isSchemaMismatch(mappingResult.error)) throw mappingResult.error;

        const rows = Array.isArray(topicResult.data) ? topicResult.data : [];
        const mappingRows = mappingResult.data ?? [];
        const countMap = countByTopicId(mappingRows);

        const uniquePostIds = [...new Set(mappingRows.map((r) => String(r.post_id)).filter(Boolean))];
        const raisesMap = await fetchRaisesMap(uniquePostIds);
        const raisesByTopic = new Map();
        mappingRows.forEach((row) => {
          const topicId = String(row.topic_id ?? '');
          const postId = String(row.post_id ?? '');
          if (!topicId || !postId) return;
          raisesByTopic.set(topicId, (raisesByTopic.get(topicId) ?? 0) + (raisesMap.get(postId) ?? 0));
        });

        const mapped = rows.map((row) => ({
          id: row.id,
          title: row.title,
          keywords: Array.isArray(row.keywords) ? row.keywords : [],
          score: row.score ?? null,
          rank: row.rank ?? null,
          created_at: row.created_at ?? null,
          post_count: countMap.get(String(row.id)) ?? 0,
          raises_count: raisesByTopic.get(String(row.id)) ?? 0,
        }));

        setTopics(mapped);
      })
      .catch((err) => {
        if (!mounted) return;
        setTopics([]);
        setError(err);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [refreshKey]);

  const byRank = useMemo(() => [...(topics ?? [])].sort((a, b) => Number(a.rank ?? 9e9) - Number(b.rank ?? 9e9)), [topics]);

  return { topics: byRank, loading, error };
}

