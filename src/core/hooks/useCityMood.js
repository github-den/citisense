import { useEffect, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';

const FALLBACK = {
  mood: null,
  emoji: null,
  total: 0,
  breakdown: {},
};

export function useCityMood({ days = 7 } = {}) {
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    supabase
      .rpc('get_city_mood', { p_days: days })
      .then(({ data: rows, error }) => {
        if (!mounted) return;
        if (error || !rows?.[0]) {
          setData(FALLBACK);
        } else {
          setData(rows[0]);
        }
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [days]);

  return { data, loading };
}

