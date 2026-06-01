'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import { useFeed } from '@core/hooks/useFeed.js';
import styles from './StatusTimelinePage.module.css';

function formatDateTime(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildTimeline(post) {
  if (!post) return [];

  const entries = [
    {
      id: `${post.id}-created`,
      status: 'Submitted',
      when: post.created_at,
      by: 'Citizen',
    },
  ];

  if (post.status && post.status !== 'Under Review') {
    entries.unshift({
      id: `${post.id}-reviewed`,
      status: post.status,
      when: post.closedAt ?? post.created_at,
      by: 'Assigned office',
      note: post.status === 'Dismissed' ? post.evidenceNote : '',
    });
  } else {
    entries.unshift({
      id: `${post.id}-under-review`,
      status: 'Under Review',
      when: post.created_at,
      by: 'System',
    });
  }

  return entries;
}

export default function StatusTimelinePage() {
  const { id } = useParams();
  const { posts, loading } = useFeed();
  const post = useMemo(() => posts.find((item) => String(item.id) === String(id ?? '')), [id, posts]);
  const timeline = useMemo(() => buildTimeline(post), [post]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <ClockCounterClockwise size={18} weight="duotone" />
        <div>
          <h1>Status Timeline</h1>
          <p>Track the visible movement of this feedback.</p>
        </div>
      </div>

      {loading ? <div className={styles.empty}>Loading feedback timeline…</div> : null}
      {!loading && !post ? <div className={styles.empty}>Feedback not found.</div> : null}

      {!loading && post ? (
        <>
          <div className={styles.cardWrap}>
            <FeedCard post={post} />
          </div>

          <div className={styles.timeline}>
            {timeline.map((entry, index) => (
              <article key={entry.id} className={styles.item}>
                <div className={styles.markerCol}>
                  <span className={styles.marker} />
                  {index < timeline.length - 1 ? <span className={styles.line} /> : null}
                </div>
                <div className={styles.body}>
                  <div className={styles.status}>{entry.status}</div>
                  <div className={styles.when}>{formatDateTime(entry.when)}</div>
                  <div className={styles.by}>Changed by: {entry.by}</div>
                  {entry.note ? <div className={styles.note}>{entry.note}</div> : null}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
