import { useState } from 'react';
import { CheckCircle, Crosshair } from '@phosphor-icons/react';
import { useFeed } from '@core/hooks/useFeed.js';
import { EmptyState, trimText } from './shared.jsx';
import styles from './RightAside.module.css';

export default function TrackAside() {
  const [trackVal, setTrackVal] = useState('');
  const { posts: recentlyResolved } = useFeed({ status: 'Resolved' });

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.widgetTitle}>Track feedback</div>
        <div className={styles.trackCard}>
          <input
            type="text"
            placeholder="Enter feedback number"
            value={trackVal}
            onChange={(e) => setTrackVal(e.target.value)}
            className={styles.trackInput}
            aria-label="Feedback number"
          />
          <button className={styles.trackCardBtn} type="button">
            <Crosshair size={15} weight="bold" /> Track
          </button>
        </div>
      </div>

      <div className={`${styles.widget} ${styles.listWidget}`}>
        <div className={styles.widgetTitle}>
          <CheckCircle size={16} weight="fill" color="var(--green)" /> Recently resolved
        </div>
        <div className={styles.listBody}>
          {recentlyResolved.length > 0 ? (
            recentlyResolved.map((post) => (
              <div key={post.id} className={styles.resolvedItem}>
                <CheckCircle size={14} weight="fill" color="var(--green)" className={styles.resolvedIcon} />
                <div>
                  <div className={styles.resolvedId}>{post.feedbackNo}</div>
                  <div className={styles.resolvedText}>{trimText(post.content)}</div>
                  <div className={styles.resolvedMeta}>{post.location || 'Urdaneta'} - {post.time}</div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState>No resolved feedback to highlight yet.</EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
