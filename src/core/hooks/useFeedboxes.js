import { useState, useEffect } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { feedboxFallback } from '@/data/feedboxFallback.js';

export function useFeedboxes() {
  const [feedboxes, setFeedboxes] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!supabase) {
      setFeedboxes(feedboxFallback);
      setLoading(false);
      return;
    }

    supabase
      .from('feedboxes')
      .select('id, topic, feedback_count, raises_count, shares_count, avg_satisfaction, is_hot, service, description, location, location_precise, created_at')
      .order('feedback_count', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err);
        else setFeedboxes((data?.length ?? 0) > 0 ? data : feedboxFallback);
        setLoading(false);
      });
  }, []);

  return { feedboxes, loading, error };
}
