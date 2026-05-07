import { useMemo, useState } from 'react';
import { Camera, MapPin, NotePencil, Trash, WarningCircle } from '@phosphor-icons/react';
import { clearFeedbackDraft, loadFeedbackDraft } from '@core/services/localState.js';
import shellStyles from '../CitizenDataPage.module.css';
import styles from './DraftsPage.module.css';

function getDraftTitle(content) {
  const text = String(content ?? '').trim();
  if (!text) return 'Untitled Draft';
  return text.length > 64 ? `${text.slice(0, 64).trim()}...` : text;
}

function formatDraftDate(value) {
  if (!value) return 'Recently edited';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently edited';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function daysUntilExpiry(savedAt) {
  if (!savedAt) return null;
  const now = Date.now();
  const diff = new Date(savedAt).getTime() + (30 * 24 * 60 * 60 * 1000) - now;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export default function DraftsPage({ setPage, embedded = false }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);

  const draft = useMemo(() => loadFeedbackDraft(), [draftVersion]);
  const form = draft?.form ?? null;
  const expiryDays = daysUntilExpiry(draft?.savedAt);
  const isNearExpiry = expiryDays != null && expiryDays <= 7;

  function handleDelete() {
    clearFeedbackDraft();
    setConfirmOpen(false);
    setDraftVersion((value) => value + 1);
  }

  const content = (
    <>
      {!embedded && (
        <div className={shellStyles.stickyBar}>
        <div className={shellStyles.headerRow}>
          <div>
            <h1 className={shellStyles.headerTitle}>Drafts</h1>
            <p className={shellStyles.headerSub}>Feedback you started but have not submitted yet.</p>
          </div>
          <span className={shellStyles.headerBadge}>{form ? '1 draft' : 'No drafts'}</span>
        </div>
      </div>
      )}

      <div className={shellStyles.body}>
        {form ? (
          <section className={shellStyles.rowCard}>
            <article className={styles.draftCard}>
              <div className={styles.draftTop}>
                <div>
                  <h2 className={styles.draftTitle}>{getDraftTitle(form.content)}</h2>
                  <div className={styles.draftDate}>{formatDraftDate(draft?.savedAt)}</div>
                </div>
              </div>

              <div className={styles.metaRow}>
                {form.service ? (
                  <span className={shellStyles.pill}>
                    <NotePencil size={14} weight="bold" />
                    {form.service}
                  </span>
                ) : null}
                {(form.barangay || form.location) ? (
                  <span className={shellStyles.pill}>
                    <MapPin size={14} weight="bold" />
                    {form.barangay || form.location}
                  </span>
                ) : null}
                {!form.service && !form.barangay && !form.location && (
                  <span className={`${shellStyles.statusPill} ${shellStyles.neutral}`}>Incomplete</span>
                )}
              </div>

              {isNearExpiry && (
                <div className={styles.warningRow}>
                  <WarningCircle size={16} weight="fill" />
                  Expires in {expiryDays} day{expiryDays === 1 ? '' : 's'}
                </div>
              )}

              <div className={styles.actions}>
                <button type="button" className={styles.primaryBtn} onClick={() => setPage?.('writefb')}>
                  <NotePencil size={16} weight="bold" />
                  Continue Editing
                </button>
                <button type="button" className={styles.dangerBtn} onClick={() => setConfirmOpen(true)}>
                  <Trash size={16} weight="bold" />
                  Delete
                </button>
              </div>
            </article>
          </section>
        ) : (
          <div className={shellStyles.emptyCard}>
            <NotePencil size={42} weight="duotone" color="var(--text-3)" />
            <p className={shellStyles.emptyTitle}>No drafts yet.</p>
            <span className={shellStyles.emptyText}>Start writing and save as draft anytime before submitting.</span>
          </div>
        )}

      </div>

      {confirmOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Delete draft confirmation">
          <div className={styles.modalCard}>
            <h3>Delete this draft?</h3>
            <p>This removes the saved draft from this device. You cannot undo this action.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalGhost} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button type="button" className={styles.modalDanger} onClick={handleDelete}>Delete draft</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className={shellStyles.page}>
      {content}
    </div>
  );
}
