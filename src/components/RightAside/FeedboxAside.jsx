import { Archive, MapPinArea, TrendUp } from '@phosphor-icons/react';
import { useTopicFeedboxes } from '@core/hooks/useTopicFeedboxes.js';
import { EmptyState } from './shared.jsx';
import styles from './RightAside.module.css';

export default function FeedboxAside() {
  const { topics } = useTopicFeedboxes({ autoRefreshMs: 30 * 60 * 1000 });
  const totalFeedback = (topics ?? []).reduce((sum, box) => sum + (box.post_count ?? 0), 0);
  const topBoxes = [...(topics ?? [])]
    .sort((a, b) => Number(a.rank ?? 9999) - Number(b.rank ?? 9999))
    .slice(0, 3);

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <Archive size={16} weight="fill" color="var(--brand)" /> Feedbox overview
        </div>
        <div className={styles.charterSummaryGrid}>
          <div className={styles.charterSummaryItem}>
            <strong>{topics?.length ?? 0}</strong>
            <span>Active topic feedboxes currently visible.</span>
          </div>
          <div className={styles.charterSummaryItem}>
            <strong>{totalFeedback}</strong>
            <span>Total related posts covered by ranked topics.</span>
          </div>
          <div className={styles.charterSummaryItem}>
            <strong>{topBoxes.length || 0}</strong>
            <span>Top ranked topics currently highlighted.</span>
          </div>
        </div>
      </div>

      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <MapPinArea size={16} weight="fill" color="var(--brand)" /> How to read feedboxes
        </div>
        <ul className={styles.reminderList}>
          <li>Start with repeated raw issue phrases, then compare the feedback inside each topic.</li>
          <li>Use feedboxes when you want patterns, not just one report.</li>
          <li>Use service and incident location tabs when you want a broader grouping view.</li>
        </ul>
      </div>

      <div className={`${styles.widget} ${styles.listWidget}`}>
        <div className={styles.widgetTitle}>
          <TrendUp size={16} weight="fill" color="var(--brand)" /> Strong signals
        </div>
        <div className={`${styles.asideList} ${styles.listBody}`}>
          {topBoxes.length > 0 ? (
            topBoxes.map((box) => (
              <div key={box.id} className={styles.asideCard}>
                <div>
                  <div className={styles.asideCardTitle}>#{box.rank ?? '-'} {box.title}</div>
                  <div className={styles.asideCardMeta}>
                    {box.post_count ?? 0} related posts
                  </div>
                  <div className={styles.asideCardSub}>{(box.keywords ?? []).slice(0, 2).join(', ') || 'topic cluster'}</div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState>No strong feedbox signals yet.</EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
