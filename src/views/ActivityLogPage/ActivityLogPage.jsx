import { ClockCountdown } from '@phosphor-icons/react';
import shellStyles from '../CitizenDataPage.module.css';

export default function ActivityLogPage({ embedded = false }) {
  const content = (
    <>
      {!embedded && (
        <div className={shellStyles.stickyBar}>
          <div className={shellStyles.headerRow}>
            <div>
              <h1 className={shellStyles.headerTitle}>Activity Log</h1>
              <p className={shellStyles.headerSub}>A history of your interactions and civic contributions.</p>
            </div>
          </div>
        </div>
      )}

      <div className={shellStyles.body}>
        <div className={shellStyles.emptyCard}>
          <ClockCountdown size={42} weight="duotone" color="var(--text-3)" />
          <p className={shellStyles.emptyTitle}>No recent activity.</p>
          <span className={shellStyles.emptyText}>Your civic actions, raises, and comments will appear here.</span>
        </div>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <div className={shellStyles.page}>
      {content}
    </div>
  );
}
