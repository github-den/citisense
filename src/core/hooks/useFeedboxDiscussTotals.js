import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';

export function useFeedboxDiscussTotals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setLoading(false); return; }

    supabase
      .rpc('get_feedbox_discuss_totals')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setRows([]);
        else setRows(data ?? []);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const discussByFeedboxId = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      if (row?.feedbox_id) map.set(row.feedbox_id, row.discuss_total ?? 0);
    }
    return map;
  }, [rows]);

  return { discussByFeedboxId, loading };
}

