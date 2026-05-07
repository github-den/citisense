import { useEffect, useState } from 'react';

export function useFeedboxes() {
  const [feedboxes, setFeedboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    fetch('/api/feedbox-topics', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load feedboxes.');
        }
        return payload.feedboxes ?? [];
      })
      .then((data) => {
        if (!mounted) return;
        setFeedboxes(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        setFeedboxes([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { feedboxes, loading, error };
}
