import { useMemo } from 'react';
import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react';
import { useTrendingFeedboxes } from '@core/hooks/useTrendingFeedboxes.js';
import { EmptyState } from './shared.jsx';
import styles from './RightAside.module.css';

export default function SearchAside({ setPage, setSearchQuery }) {
  const { topTen: trendingTop, loading: trendingLoading } = useTrendingFeedboxes({ top: 10, pick: 4 });

  const otherSearchedFor = useMemo(() => {
    return trendingTop.map((row) => row.topic).filter(Boolean).slice(0, 6);
  }, [trendingTop]);

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
