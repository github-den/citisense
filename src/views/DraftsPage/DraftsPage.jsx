import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, NotePencil, Trash, WarningCircle } from '@phosphor-icons/react';
import { deleteDraftMediaItems } from '@core/services/draftMediaStore.js';
import { clearFeedbackDraft, listFeedbackDrafts } from '@core/services/localState.js';
import { routes } from '@core/lib/navigation/routes.js';
import shellStyles from '../CitizenDataPage.module.css';
import styles from './DraftsPage.module.css';

function getDraftTitle(name, content) {
  const explicitName = String(name ?? '').trim();
  if (explicitName) return explicitName;

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

function getDraftBadgeLabel(count) {
  if (count <= 0) return 'No drafts';
  if (count === 1) return '1 draft';
  return `${count} drafts`;
}

export default function DraftsPage({ embedded = false }) {
  const router = useRouter();
  const [draftVersion, setDraftVersion] = useState(0);
  const [draftToDeleteId, setDraftToDeleteId] = useState(null);

  useEffect(() => {
    function handleDraftChanged() {
      setDraftVersion((value) => value + 1);
    }

    window.addEventListener('citisense:draft-changed', handleDraftChanged);
    return () => {
      window.removeEventListener('citisense:draft-changed', handleDraftChanged);
    };
  }, []);

  const drafts = useMemo(() => listFeedbackDrafts() ?? [], [draftVersion]);
  const draftToDelete = draftToDeleteId
    ? drafts.find((draft) => draft.id === draftToDeleteId) ?? null
    : null;

  function handleDelete() {
    if (!draftToDeleteId) return;
    clearFeedbackDraft(draftToDeleteId);
    deleteDraftMediaItems(draftToDeleteId).catch(() => {});
    setDraftToDeleteId(null);
    setDraftVersion((value) => value + 1);
  }

  function handleContinueEditing(draftId) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    router.push(`${routes.write}?draft=${encodeURIComponent(draftId)}`);
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
            <span className={shellStyles.headerBadge}>{getDraftBadgeLabel(drafts.length)}</span>
          </div>
        </div>
      )}

      <div className={shellStyles.body}>
        {drafts.length > 0 ? (
          drafts.map((draft) => {
            const form = draft.form ?? {};
            const expiryDays = daysUntilExpiry(draft.savedAt);
            const isNearExpiry = expiryDays != null && expiryDays <= 7;

            return (
              <section key={draft.id} className={shellStyles.rowCard}>
                <article className={styles.draftCard}>
                  <div className={styles.draftTop}>
                    <div>
                      <h2 className={styles.draftTitle}>{getDraftTitle(draft.name, form.content)}</h2>
                      <div className={styles.draftDate}>{formatDraftDate(draft.savedAt)}</div>
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
                    {!form.service && !form.barangay && !form.location ? (
                      <span className={`${shellStyles.statusPill} ${shellStyles.neutral}`}>Incomplete</span>
                    ) : null}
                  </div>

                  {isNearExpiry ? (
                    <div className={styles.warningRow}>
                      <WarningCircle size={16} weight="fill" />
                      Expires in {expiryDays} day{expiryDays === 1 ? '' : 's'}
                    </div>
                  ) : null}

                  <div className={styles.actions}>
                    <button type="button" className={styles.primaryBtn} onClick={() => handleContinueEditing(draft.id)}>
                      <NotePencil size={16} weight="bold" />
                      Continue Editing
                    </button>
                    <button type="button" className={styles.dangerBtn} onClick={() => setDraftToDeleteId(draft.id)}>
                      <Trash size={16} weight="bold" />
                      Delete
                    </button>
                  </div>
                </article>
              </section>
            );
          })
        ) : (
          <div className={shellStyles.zeroState}>
            <p className={shellStyles.zeroTitle}>No drafts yet.</p>
            <span className={shellStyles.zeroText}>Start writing and save as draft anytime before submitting.</span>
          </div>
        )}
      </div>

      {draftToDelete ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Delete draft confirmation">
          <div className={styles.modalCard}>
            <h3>Delete this draft?</h3>
            <p>
              {getDraftTitle(draftToDelete.name, draftToDelete.form?.content)} will be removed from this device. You cannot undo this action.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalGhost} onClick={() => setDraftToDeleteId(null)}>Cancel</button>
              <button type="button" className={styles.modalDanger} onClick={handleDelete}>Delete draft</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) return content;

  return (
    <div className={shellStyles.page}>
      {content}
    </div>
  );
}
