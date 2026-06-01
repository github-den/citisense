import { useEffect, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { createEmptyMoodBreakdown, normalizeCityMoodResult, summarizeMoodFromStoredMoodRows } from '@core/utils/mood.js';

const FALLBACK = normalizeCityMoodResult({
  total: 0,
  breakdown: createEmptyMoodBreakdown(),
});

// Module-level TTL cache — survives remounts, keyed by `days`
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // key: days → { data, fetchedAt }

function getCached(days) {
  const entry = cache.get(days);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(days);
    return null;
  }
  return entry.data;
}

function setCached(days, data) {
  cache.set(days, { data, fetchedAt: Date.now() });
}

async function fetchCityMoodFallback(days) {
  if (!supabase) return FALLBACK;

  // Use a fixed cutoff so repeated calls within the same session are consistent
  let query = supabase.from('feedbacks').select('final_mood, created_at');
  if (Number.isFinite(days) && days > 0) {
    const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query;
  if (error) {
    console.error('City mood fallback failed:', error);
    return FALLBACK;
  }

  const summary = summarizeMoodFromStoredMoodRows(data ?? [], { minTotal: 1, minShare: 0 });
  return normalizeCityMoodResult({
    mood: summary.mood,
    emoji: summary.emoji,
    total: summary.total,
    breakdown: summary.breakdown,
    confidence: summary.confidence,
  });
}

export function useCityMood({ days = 7 } = {}) {
  const [data, setData] = useState(() => getCached(days) ?? FALLBACK);
  const [loading, setLoading] = useState(() => !getCached(days));

  useEffect(() => {
    // Return cached result immediately — no fetch needed
    const cached = getCached(days);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    supabase
      .rpc('get_city_mood', { p_days: days })
      .then(async ({ data: rows, error }) => {
        if (!mounted) return;
        let result;
        if (error || !rows?.[0]) {
          result = await fetchCityMoodFallback(days);
        } else {
          result = normalizeCityMoodResult(rows[0]);
        }
        setCached(days, result);
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [days]);

  return { data, loading };
}
