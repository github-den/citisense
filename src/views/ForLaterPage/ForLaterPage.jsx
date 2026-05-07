import { BookmarkSimple } from '@phosphor-icons/react';
import shellStyles from '../CitizenDataPage.module.css';

export default function ForLaterPage({ embedded = false }) {
  const header = (
    <div className={shellStyles.headerRow}>
      <div>
        <h1 className={shellStyles.headerTitle}>Saved</h1>
        <p className={shellStyles.headerSub}>Saved feedback and feedboxes for follow-up.</p>
      </div>
    </div>
  );

  const content = (
    <>
      {embedded ? header : <div className={shellStyles.stickyBar}>{header}</div>}

      <div className={shellStyles.body}>
        <div className={shellStyles.emptyCard}>
          <BookmarkSimple size={42} weight="duotone" color="var(--text-3)" />
          <p className={shellStyles.emptyTitle}>Nothing saved yet.</p>
          <span className={shellStyles.emptyText}>Tap the bookmark on any feedback to save it here for follow-up.</span>
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
