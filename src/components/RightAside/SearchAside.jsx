import { useMemo } from 'react';
import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react';
import { useTopicFeedboxes } from '@core/hooks/useTopicFeedboxes.js';
import { EmptyState } from './shared.jsx';
import styles from './RightAside.module.css';

export default function SearchAside({ setPage, setSearchQuery }) {
  const { topics, loading: trendingLoading } = useTopicFeedboxes({ autoRefreshMs: 30 * 60 * 1000 });

  const otherSearchedFor = useMemo(() => {
    return (topics ?? []).map((row) => row.title).filter(Boolean).slice(0, 6);
  }, [topics]);

  function runSearch(value) {
    const query = String(value ?? '').trim();
    if (!query) return;
    setSearchQuery(query);
    setPage('search');
  }

  return (
    <div className={`${styles.widget} ${styles.listWidget}`}>
      <div className={styles.widgetTitle}>
        <TrendUp size={16} weight="bold" /> Others searched for
      </div>
      <div className={styles.listBody}>
        {otherSearchedFor.length > 0 ? (
          otherSearchedFor.map((keyword) => (
            <button key={keyword} className={styles.otherItem} onClick={() => runSearch(keyword)} type="button">
              <MagnifyingGlass size={15} color="var(--text-3)" />
              <span>{keyword}</span>
            </button>
          ))
        ) : (
          <EmptyState>
            {trendingLoading ? 'Finding citywide searches...' : 'No searched groups yet.'}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
