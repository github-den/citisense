import { useEffect, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { createEmptyMoodBreakdown, normalizeCityMoodResult, summarizeMoodFromReactionRows } from '@core/utils/mood.js';

const FALLBACK = normalizeCityMoodResult({
  total: 0,
  breakdown: createEmptyMoodBreakdown(),
});

async function fetchCityMoodFallback(days) {
  if (!supabase) return FALLBACK;

  let query = supabase.from('reactions').select('emoji, created_at');
  if (Number.isFinite(days) && days > 0) {
    const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query;
  if (error) {
    console.error('City mood fallback failed:', error);
    return FALLBACK;
  }

  const summary = summarizeMoodFromReactionRows(data ?? []);
  return normalizeCityMoodResult({
    mood: summary.mood,
    emoji: summary.emoji,
    total: summary.total,
    breakdown: summary.breakdown,
  });
}

export function useCityMood({ days = 7 } = {}) {
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    supabase
      .rpc('get_city_mood', { p_days: days })
      .then(async ({ data: rows, error }) => {
        if (!mounted) return;
        if (error || !rows?.[0]) {
          const fallback = await fetchCityMoodFallback(days);
          if (mounted) setData(fallback);
        } else {
          setData(normalizeCityMoodResult(rows[0]));
        }
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [days]);

  return { data, loading };
}

