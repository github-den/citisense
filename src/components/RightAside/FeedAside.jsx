import { useEffect } from 'react';
import { Archive, CaretRight, SmileyWink, TrendUp } from '@phosphor-icons/react';
import { useTrendingFeedboxes } from '@core/hooks/useTrendingFeedboxes.js';
import { useCityMood } from '@core/hooks/useCityMood.js';
import { getMoodLabel } from './shared.jsx';
import styles from './RightAside.module.css';

function FeedboxPlaceholders() {
  return (
    <div className={styles.feedboxPlaceholderList} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={styles.tPlaceholder}>
          <div className={styles.tPlaceholderCol1}>
            <Archive size={16} weight="fill" />
          </div>
          <div className={styles.tPlaceholderCol2}>
            <div className={styles.tPlaceholderTitle} />
            <div className={styles.tPlaceholderSub} />
          </div>
          <div className={styles.tPlaceholderCol3}>
            <CaretRight size={14} weight="bold" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeedAside({ setPage, setSearchQuery, onReady }) {
  const { picked: trendingPicked, loading: trendingLoading } = useTrendingFeedboxes({ top: 10, pick: 4 });
  const { data: cityMood, loading: cityMoodLoading } = useCityMood({ days: 7 });
  const cityMoodLabel = getMoodLabel(cityMood?.mood);

  useEffect(() => {
    if (!trendingLoading && !cityMoodLoading) onReady?.();
  }, [cityMoodLoading, onReady, trendingLoading]);

  function runSearch(value) {
    const query = String(value ?? '').trim();
    if (!query) return;
    setSearchQuery(query);
    setPage('search');
  }

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <SmileyWink size={18} weight="fill" color="var(--ui-accent)" /> City Mood
          <button
            className={styles.widgetSeeMore}
            onClick={() => setPage('cityPerformance')}
            type="button"
          >
            See more
          </button>
        </div>
        <div className={`${styles.moodTitle} ${!cityMoodLabel ? styles.moodTitleEmpty : ''}`}>
          {cityMoodLabel ? cityMoodLabel : 'No mood data yet'}
          <span className={styles.moodEmoji} aria-hidden>{cityMood?.emoji || '\uD83D\uDE36'}</span>
        </div>
        {cityMood?.total ? (
          <div className={styles.moodSub}>{cityMood.total} reactions recorded in the last 7 days.</div>
        ) : null}
      </div>

      <div className={`${styles.widget} ${styles.listWidget}`}>
        <div className={styles.widgetTitle}>
          <Archive size={18} weight="fill" color="var(--ui-accent)" /> Feedboxes for you
          <button
            className={styles.widgetSeeMore}
            onClick={() => setPage('feedbox')}
            type="button"
          >
            See more
          </button>
        </div>
        <div className={styles.listBody}>
          {trendingPicked.length > 0 ? (
            trendingPicked.map((item) => (
              <button key={item.id} className={styles.tItem} onClick={() => runSearch(item.topic)} type="button">
                <div className={styles.tTopic}>{item.topic}</div>
                <div className={styles.tMeta}>
                  <TrendUp size={13} weight="bold" />
                  {item.raises_count ?? 0} raises, {item.shares_count ?? 0} shares
                </div>
              </button>
            ))
          ) : (
            <FeedboxPlaceholders />
          )}
        </div>
      </div>
    </>
  );
}




