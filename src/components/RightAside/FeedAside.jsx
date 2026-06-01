import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CaretRight, HandHeart, MapPin, SmileyWink } from '@phosphor-icons/react';
import { useCityMood } from '@core/hooks/useCityMood.js';
import { useTopicFeedboxes } from '@core/hooks/useTopicFeedboxes.js';
import { getMoodLabel } from './shared.jsx';
import { supabase } from '@core/lib/supabase.js';
import styles from './RightAside.module.css';

function FeedboxPlaceholders() {
  return (
    <div className={styles.feedboxPlaceholderList} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
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

function formatTopCategories(categories) {
  if (categories.length === 0) return '';
  if (categories.length === 1) return categories[0];
  if (categories.length === 2) return `${categories[0]} and ${categories[1]}`;
  return `${categories.slice(0, -1).join(', ')}, and ${categories[categories.length - 1]}`;
}

export default function FeedAside({ setPage, setSearchQuery, onReady }) {
  const router = useRouter();
  const { topics, loading: topicsLoading } = useTopicFeedboxes({ autoRefreshMs: 30 * 60 * 1000 });
  const { data: cityMood, loading: cityMoodLoading } = useCityMood({ days: 30 });
  const cityMoodLabel = getMoodLabel(cityMood?.mood);
  const percentage = Math.round((cityMood?.confidence ?? 0) * 100);
  const [topicBusy, setTopicBusy] = useState(false);
  const [topCategories, setTopCategories] = useState([]);

  useEffect(() => {
    if (!topicsLoading && !cityMoodLoading) onReady?.();
  }, [cityMoodLoading, onReady, topicsLoading]);

  useEffect(() => {
    if (!cityMood?.mood) {
      setTopCategories([]);
      return;
    }
    if (!supabase) return;

    const cutoff = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();

    supabase
      .from('feedbacks')
      .select('service')
      .eq('final_mood', cityMood.mood)
      .gte('created_at', cutoff)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const counts = {};
          data.forEach(row => {
            const s = row.service;
            if (s) counts[s] = (counts[s] || 0) + 1;
          });
          const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([category]) => category.toLowerCase());
          setTopCategories(sorted.slice(0, 3).map(
            (s) => s.charAt(0).toUpperCase() + s.slice(1)
          ));
        } else {
          setTopCategories([]);
        }
      });
  }, [cityMood?.mood]);

  const topTopics = useMemo(() => (topics ?? []).slice(0, 5), [topics]);

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

  return (
    <>
      <section className={styles.moodCard}>
        <div className={styles.widgetTitle}>
          <SmileyWink size={18} weight="fill" color="var(--ui-accent)" /> City Mood
        </div>
        <div className={styles.moodTop}>
          <div>
            <div className={`${styles.moodTitle} ${!cityMoodLabel ? styles.moodTitleEmpty : ''}`}>
              <span>
                {cityMoodLabel ? (
                  `${cityMood?.emoji || '\u{1F636}'} The city feels ${cityMoodLabel.toLowerCase()}`
                ) : (
                  'No mood data yet'
                )}
              </span>
            </div>
            {cityMoodLabel ? (
              <div className={styles.moodSub}>
                {percentage}% of feedbacks for the last 30 days is {cityMoodLabel.toLowerCase()}.{topCategories.length > 0 && ` These feedbacks are mostly about ${formatTopCategories(topCategories)}.`}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className={`${styles.widget} ${styles.listWidget}`}>
        <div className={styles.widgetTitle}>
          <Archive size={18} weight="fill" color="var(--ui-accent)" /> Talk of the town
        </div>
        <div className={styles.listBody}>
          {topTopics.length > 0 ? (
            topTopics.map((topic) => (
              <button key={topic.id} className={styles.topicRow} onClick={() => openTopic(topic)} type="button">
                <div className={styles.topicRank}>{topic.rank ?? ''}</div>
                <div className={styles.topicBody}>
                  <div className={styles.topicTitle}>{topic.title}</div>
                  {(topic.top_service || topic.top_location) && (
                    <div className={styles.topicMetaChips}>
                      {topic.top_service && (
                        <span className={styles.topicMetaChip}>
                          <HandHeart size={12} weight="fill" aria-hidden="true" />
                          <span className={styles.topicMetaChipText}>{topic.top_service}</span>
                        </span>
                      )}
                      {topic.top_location && (
                        <span className={styles.topicMetaChip}>
                          <MapPin size={12} weight="fill" aria-hidden="true" />
                          <span className={styles.topicMetaChipText}>{topic.top_location}</span>
                        </span>
                      )}
                    </div>
                  )}
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


