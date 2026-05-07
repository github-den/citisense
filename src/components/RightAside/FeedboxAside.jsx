import { Archive, MapPinArea, TrendUp } from '@phosphor-icons/react';
import { useFeedboxes } from '@core/hooks/useFeedboxes.js';
import { EmptyState } from './shared.jsx';
import styles from './RightAside.module.css';

function extractPlace(topic) {
  const text = String(topic ?? '');
  const lower = text.toLowerCase();
  const index = lower.lastIndexOf(' sa ');
  if (index === -1) return '';
  return text.slice(index + 4).trim();
}

export default function FeedboxAside() {
  const { feedboxes } = useFeedboxes();
  const totalFeedback = feedboxes.reduce((sum, box) => sum + (box.feedback_count ?? 0), 0);
  const locations = new Set(feedboxes.map((box) => extractPlace(box.topic)).filter(Boolean));
  const topBoxes = [...feedboxes]
    .sort((a, b) => ((b.raises_count ?? 0) + (b.feedback_count ?? 0)) - ((a.raises_count ?? 0) + (a.feedback_count ?? 0)))
    .slice(0, 3);

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <Archive size={16} weight="fill" color="var(--brand)" /> Feedbox overview
        </div>
        <div className={styles.charterSummaryGrid}>
          <div className={styles.charterSummaryItem}>
            <strong>{feedboxes.length}</strong>
            <span>Active issue clusters currently visible.</span>
          </div>
          <div className={styles.charterSummaryItem}>
            <strong>{totalFeedback}</strong>
            <span>Total feedback entries grouped into topics.</span>
          </div>
          <div className={styles.charterSummaryItem}>
            <strong>{locations.size || 'Citywide'}</strong>
            <span>Distinct places currently surfacing in box titles.</span>
          </div>
        </div>
      </div>

      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <MapPinArea size={16} weight="fill" color="var(--brand)" /> How to read feedboxes
        </div>
        <ul className={styles.reminderList}>
          <li>Start with repeated issue clusters, then check the service and place tags.</li>
          <li>Use feedboxes when you want patterns, not just one report.</li>
          <li>Open a box to compare related feedback in one stream.</li>
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
                  <div className={styles.asideCardTitle}>{box.topic}</div>
                  <div className={styles.asideCardMeta}>
                    {box.feedback_count ?? 0} feedback entries
                  </div>
                  <div className={styles.asideCardSub}>{box.service || 'Service not tagged yet'}</div>
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
