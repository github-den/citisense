import { useState } from 'react';
import { ChatCircle, CheckCircle, Warning } from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import { blockUser, reportEntity } from '@core/services/moderation.js';
import { EmptyState } from './shared.jsx';
import styles from './RightAside.module.css';

export default function DiscussAside({ discussPost }) {
  const { requireAuth } = useAuth() ?? {};
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDesc, setReportDesc] = useState('');
  const [blockAfter, setBlockAfter] = useState(true);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportDone, setReportDone] = useState(false);

  return (
    <>
      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <ChatCircle size={16} weight="fill" color="var(--brand)" /> Discussion guide
        </div>
        <ul className={styles.reminderList}>
          <li>Start with facts, timelines, and locations.</li>
          <li>Reply with updates, proof, or useful clarification.</li>
          <li>Avoid private personal data or personal attacks.</li>
          <li>Attach images or video only if it helps verify the service issue.</li>
        </ul>
      </div>

      <div className={styles.widget}>
        <div className={styles.widgetTitle}>
          <Warning size={16} weight="fill" color="var(--amber)" /> Reporting guide
        </div>
        <ul className={styles.reminderList}>
          <li>Report a citizen for harassment, spam, private information, or off-topic content.</li>
          <li>Pick the closest reason, then describe what happened so moderators have context.</li>
          <li>You can block the user after sending the report.</li>
        </ul>
        {!!discussPost?.userId ? (
          <button
            className={styles.reportBtn}
            type="button"
            onClick={() => {
              setReportDone(false);
              setReportError('');
              setReportDesc('');
              setReportReason('harassment');
              setBlockAfter(true);
              setReportOpen(true);
            }}
          >
            <Warning size={16} weight="fill" /> Report citizen
          </button>
        ) : (
          <EmptyState>Open a citizen discussion to report or block a user.</EmptyState>
        )}
      </div>

      {reportOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Report citizen">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>Report this citizen</div>
                <div className={styles.modalSub}>Choose the closest reason and add a short description.</div>
              </div>
              <button className={styles.modalClose} type="button" onClick={() => setReportOpen(false)} aria-label="Close">
                X
              </button>
            </div>

            {reportDone ? (
              <div className={styles.modalSuccess}>
                <CheckCircle size={18} weight="fill" color="var(--green)" />
                Report submitted. Thanks for helping keep CitiSense useful.
              </div>
            ) : (
              <>
                <div className={styles.modalReasons}>
                  {[
                    { key: 'spam', label: 'Spam', sample: 'Repeated promotion, scams, or irrelevant posting.' },
                    { key: 'harassment', label: 'Harassment', sample: 'Threats, bullying, or targeting a person.' },
                    { key: 'misinformation', label: 'Misinformation', sample: 'Knowingly false claims presented as fact.' },
                    { key: 'private_information', label: 'Private info', sample: 'Phone numbers, IDs, addresses, private medical details.' },
                    { key: 'inappropriate_content', label: 'Inappropriate', sample: 'Hate content, sexual content, graphic content.' },
                    { key: 'not_civic_related', label: 'Not civic-related', sample: 'Off-topic content unrelated to public services.' },
                    { key: 'other', label: 'Other', sample: 'Anything else that breaks the rules.' },
                  ].map((reason) => (
                    <button
                      key={reason.key}
                      type="button"
                      className={`${styles.reasonBtn} ${reportReason === reason.key ? styles.reasonActive : ''}`}
                      onClick={() => setReportReason(reason.key)}
                    >
                      <div className={styles.reasonLabel}>{reason.label}</div>
                      <div className={styles.reasonSample}>{reason.sample}</div>
                    </button>
                  ))}
                </div>

                <label className={styles.modalField}>
                  <span>Describe what happened (optional)</span>
                  <textarea
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Example: They posted private contact details and personal attacks in the discussion."
                    rows={3}
                  />
                </label>

                <label className={styles.blockRow}>
                  <input type="checkbox" checked={blockAfter} onChange={(e) => setBlockAfter(e.target.checked)} />
                  <span>Block this user after reporting</span>
                </label>

                {reportError && <div className={styles.modalError}>{reportError}</div>}

                <div className={styles.modalActions}>
                  <button className={styles.modalGhost} type="button" onClick={() => setReportOpen(false)} disabled={reportBusy}>
                    Cancel
                  </button>
                  <button
                    className={styles.modalPrimary}
                    type="button"
                    disabled={reportBusy || !discussPost?.userId}
                    onClick={() => {
                      const submit = async () => {
                        if (!discussPost?.userId) return;
                        setReportBusy(true);
                        setReportError('');
                        const { error: reportErr } = await reportEntity({
                          entityType: 'profile',
                          entityId: discussPost.userId,
                          reason: reportReason,
                          description: reportDesc.trim(),
                        });
                        if (reportErr) {
                          setReportError(reportErr.message ?? 'Unable to submit report.');
                          setReportBusy(false);
                          return;
                        }
                        if (blockAfter) {
                          const { error: blockErr } = await blockUser(discussPost.userId);
                          if (blockErr) setReportError(blockErr.message ?? 'Report submitted, but blocking failed.');
                        }
                        setReportBusy(false);
                        setReportDone(true);
                      };

                      if (requireAuth) requireAuth(submit, 'Sign in to report and block users.');
                      else submit();
                    }}
                  >
                    {reportBusy ? 'Submitting...' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
