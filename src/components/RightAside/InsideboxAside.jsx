import { useMemo } from 'react';
import { Stack, TrendUp } from '@phosphor-icons/react';
import { useTrendingFeedboxes } from '@core/hooks/useTrendingFeedboxes.js';
import { EmptyState, safeList, trimText } from './shared.jsx';
import styles from './RightAside.module.css';

export default function InsideboxAside({ activeFeedbox, onOpenFeedbox }) {
  const { topTen: trendingTop, loading: trendingLoading } = useTrendingFeedboxes({ top: 10, pick: 4 });

  const relatedFeedboxes = useMemo(() => {
    if (!activeFeedbox?.id) return [];
    return safeList(trendingTop)
      .filter((row) => row?.id && row.id !== activeFeedbox.id)
      .slice(0, 6);
  }, [activeFeedbox?.id, trendingTop]);

  if (!activeFeedbox) return null;

  return (
    <>
      <div className={styles.heroWidget}>
        <div className={styles.heroIcon}>
          <Stack size={20} weight="duotone" />
        </div>
        <div className={styles.heroEyebrow}>Topic snapshot</div>
        <div className={styles.heroTitle}>{trimText(activeFeedbox.topic, 72)}</div>
        <div className={styles.heroBody}>
          This aside stays compact on purpose: key issue facts first, then a few neighbor topic leads.
        </div>
      </div>

      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <Stack size={16} weight="fill" color="var(--brand)" /> Feedbox details
        </div>
        <div className={styles.detailGrid}>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Topic</span><span className={styles.detailValue}>{activeFeedbox.topic}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Service</span><span className={styles.detailValue}>{activeFeedbox.service || 'Not specified yet'}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Incident location</span><span className={styles.detailValue}>{activeFeedbox.location_precise || 'Not specified yet'}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Office in charge</span><span className={styles.detailValue}>{activeFeedbox.office_in_charge || 'Not specified yet'}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Status</span><span className={styles.detailValue}>{activeFeedbox.is_verified ? 'Verified' : 'Not yet verified'}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Resolution window</span><span className={styles.detailValue}>{activeFeedbox.resolution_window || 'Not yet verified'}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Resolution status</span><span className={styles.detailValue}>{activeFeedbox.resolution_status || 'Not yet verified'}</span></div>
          <div className={styles.detailRow}><span className={styles.detailLabel}>Satisfaction rate</span><span className={styles.detailValue}>{activeFeedbox.satisfaction_rate || 'Not yet resolved'}</span></div>
        </div>
      </div>

      <div className={`${styles.widget} ${styles.listWidget}`}>
        <div className={styles.widgetTitle}>
          <TrendUp size={16} weight="bold" /> Feedboxes that may be related
        </div>
        <div className={styles.listBody}>
          {relatedFeedboxes.length > 0 ? (
            <div className={styles.relatedStack}>
              {relatedFeedboxes.map((row) => (
                <button key={row.id} className={styles.relatedCard} type="button" onClick={() => onOpenFeedbox?.(row)} title={row.topic}>
                  <div className={styles.relatedTop}>
                    <Stack size={16} weight="duotone" color="var(--brand)" />
                    <span className={styles.relatedMeta}>{Math.round(((row.raises_count ?? 0) + (row.feedback_count ?? 0)) / 2)} avg</span>
                  </div>
                  <div className={styles.relatedTopic}>{trimText(row.topic, 54)}</div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState>
              {trendingLoading ? 'Looking for related feedboxes...' : 'No related feedboxes yet.'}
            </EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
