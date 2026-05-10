import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CaretRight, SmileyWink } from '@phosphor-icons/react';
import { useCityMood } from '@core/hooks/useCityMood.js';
import { useTopicFeedboxes } from '@core/hooks/useTopicFeedboxes.js';
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
  const router = useRouter();
  const { topics, loading: topicsLoading } = useTopicFeedboxes({ autoRefreshMs: 30 * 60 * 1000 });
  const { data: cityMood, loading: cityMoodLoading } = useCityMood({ days: 7 });
  const cityMoodLabel = getMoodLabel(cityMood?.mood);
  const [topicBusy, setTopicBusy] = useState(false);

  useEffect(() => {
    if (!topicsLoading && !cityMoodLoading) onReady?.();
  }, [cityMoodLoading, onReady, topicsLoading]);

  const topTopics = useMemo(() => (topics ?? []).slice(0, 4), [topics]);

  async function openTopic(topic) {
    const topicTitle = String(topic?.title ?? '').trim();
    if (!topicTitle || topicBusy) return;

    setTopicBusy(true);
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    try {
      const res = await fetch('/api/posts/by-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle,
          keywords: Array.isArray(topic?.keywords) ? topic.keywords : [],
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? 'Unable to load topic posts.');

      sessionStorage.setItem('citisense_topic_posts', JSON.stringify(payload.posts ?? []));
      sessionStorage.setItem('citisense_topic_query', topicTitle);
      router.push(`/search?q=${encodeURIComponent(topicTitle)}&topic=1`);
    } catch (err) {
      // Fallback to normal search if semantic route fails
      setSearchQuery(topicTitle);
      setPage('search');
    } finally {
      setTopicBusy(false);
    }
  }

  function openTopicTab() {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    router.push('/feedbox?tab=topic');
  }

  return (
    <>
      <section className={styles.moodCard}>
        <div className={styles.widgetTitle}>
          <SmileyWink size={18} weight="fill" color="var(--ui-accent)" /> City mood
          <button
            className={styles.widgetSeeMore}
            onClick={() => setPage('cityPerformance')}
            type="button"
          >
            See more
          </button>
        </div>
        <div className={styles.moodTop}>
          <div>
            <div className={`${styles.moodTitle} ${!cityMoodLabel ? styles.moodTitleEmpty : ''}`}>
              <span>{cityMoodLabel || 'No mood data yet'}</span>
            </div>
            {cityMood?.total ? (
              <div className={styles.moodSub}>{cityMood.total} reactions recorded in the last 7 days.</div>
            ) : null}
          </div>
          <span className={styles.moodEmoji} aria-hidden>{cityMood?.emoji || '\u{1F636}'}</span>
        </div>
      </section>

      <div className={`${styles.widget} ${styles.listWidget}`}>
        <div className={styles.widgetTitle}>
          <Archive size={18} weight="fill" color="var(--ui-accent)" /> Topic feedbox
          <button
            className={styles.widgetSeeMore}
            onClick={openTopicTab}
            type="button"
          >
            See more
          </button>
        </div>
        <div className={styles.listBody}>
          {topTopics.length > 0 ? (
            topTopics.map((topic) => (
              <button key={topic.id} className={styles.topicRow} onClick={() => openTopic(topic)} type="button">
                <div className={styles.topicRank}>{topic.rank ?? ''}</div>
                <div className={styles.topicBody}>
                  <div className={styles.topicTitle}>{topic.title}</div>
                  <div className={styles.topicMeta}>{topic.post_count ?? 0} posts</div>
                </div>
                <CaretRight size={14} weight="bold" className={styles.topicChevron} />
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




