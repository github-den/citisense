import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';

function score(box) {
  const raises = Number(box?.raises_count ?? 0);
  const shares = Number(box?.shares_count ?? 0);
  return raises + shares;
}

function pickRandom(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function useTrendingFeedboxes({ top = 10, pick = 4 } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    supabase
      .from('feedboxes')
      .select('id, topic, raises_count, shares_count, feedback_count, service, description')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setRows([]);
        else setRows(data ?? []);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [top]);

  const topTen = useMemo(() => {
    return [...rows]
      .filter((row) => score(row) >= 3)
      .sort((a, b) => score(b) - score(a))
      .slice(0, top);
  }, [rows, top]);

  const picked = useMemo(() => {
    return pickRandom(topTen, pick);
  }, [topTen, pick]);

  return { topTen, picked, loading };
}
