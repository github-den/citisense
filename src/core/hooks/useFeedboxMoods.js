import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';

export function useFeedboxMoods({ days = 7 } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    supabase
      .rpc('get_feedbox_moods', { p_days: days })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setRows([]);
        else setRows(data ?? []);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [days]);

  const moodByFeedboxId = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      if (row?.feedbox_id) map.set(row.feedbox_id, row);
    }
    return map;
  }, [rows]);

  return { moodByFeedboxId, loading };
}

