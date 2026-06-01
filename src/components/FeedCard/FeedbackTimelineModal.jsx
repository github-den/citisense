import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClockCountdown, Star, X } from '@phosphor-icons/react';
import { showToast } from '../Toast/Toast.jsx';
import styles from './FeedbackTimelineModal.module.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(value) {
  const ts = Date.parse(value ?? '');
  if (!Number.isFinite(ts)) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCompactReviewDuration(ms) {
  const totalHours = Math.max(1, Math.ceil(Math.abs(ms) / 36e5));
  if (totalHours < 24) return `${totalHours}h`;
  const totalDays = Math.ceil(totalHours / 24);
  if (totalDays < 14) return `${totalDays}d`;
  return `${Math.ceil(totalDays / 7)}w`;
}

function getResponseWindowLabel(post) {
  if (post?.type !== 'complaint') return '';
  const createdAt = Date.parse(post?.created_at ?? '');
  if (!Number.isFinite(createdAt)) return '';
  const deadline = createdAt + 3 * 24 * 60 * 60 * 1000;

  if (!post.status || post.status === 'Under Review') {
    const remaining = deadline - Date.now();
    return remaining >= 0
      ? `${formatCompactReviewDuration(remaining)} left`
      : `${formatCompactReviewDuration(remaining)} overdue`;
  }

  const reviewedAt = Date.parse(post?.updated_at ?? '');
  if (!Number.isFinite(reviewedAt)) return '';
  const delta = reviewedAt - deadline;
  return delta > 0
    ? `${formatCompactReviewDuration(delta)} late`
    : 'on time';
}

function buildTimeline(post) {
  if (!post) return [];

  const responseWindow = getResponseWindowLabel(post);
  const status = post.status ?? 'Under Review';
  const updatedAt = post.updated_at ?? post.created_at;
  const isVerified = ['In Progress', 'On Hold', 'Resolved'].includes(status);
  const isDismissed = status === 'Dismissed';

  const steps = [
    {
      key: 'posted',
      label: 'Posted',
      detail: post.service ? `Assigned category: ${post.service}` : 'Feedback entered the queue.',
      value: formatDateTime(post.created_at),
      state: 'done',
    },
    {
      key: 'verification',
      label: status === 'Under Review' ? 'Under Review' : isVerified ? 'Verified' : 'Dismissed',
      detail: status === 'Under Review'
        ? 'Feedback is being reviewed by the assigned office.'
        : isVerified
          ? 'Confirmed actionable. Resolution tracking is now active.'
          : 'Closed as not actionable for the current workflow.',
      value: status === 'Under Review'
        ? (responseWindow || 'Pending review')
        : formatDateTime(updatedAt),
      responseWindow,
      state: status === 'Under Review' ? 'current' : isDismissed ? 'blocked' : 'done',
    },
  ];

  if (isVerified) {
    const resLabel = status;
    steps.push({
      key: 'resolution',
      label: resLabel,
      detail: status === 'In Progress'
        ? 'Work is actively moving with the responsible office.'
        : status === 'On Hold'
          ? 'Progress is paused while waiting for input or resources.'
          : 'The issue has been completed and resolved.',
      value: formatDateTime(updatedAt),
      state: status === 'Resolved' ? 'done' : 'current',
    });
  }

  return steps;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ postId, initialRating, onRated }) {
  const [hover, setHover] = useState(0);
  const [saved, setSaved] = useState(initialRating ?? 0);
  const [saving, setSaving] = useState(false);

  async function handleRate(value) {
    if (saving) return;
    setSaving(true);
    setSaved(value);

    try {
      const { supabase } = await import('@core/lib/supabase.js');
      const { error } = await supabase
        .from('feedbacks')
        .update({ rating: value })
        .eq('id', postId);

      if (error) {
        setSaved(initialRating ?? 0);
        showToast('Unable to save your rating.', 'error');
      } else {
        onRated?.(value);
      }
    } catch {
      setSaved(initialRating ?? 0);
      showToast('Unable to save your rating.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const display = hover || saved;

  return (
    <div className={styles.ratingSection}>
      <span className={styles.ratingLabel}>
        {saved ? 'Your rating' : 'Rate this resolution'}
      </span>
      <div
        className={styles.stars}
        role="group"
        aria-label="Rate this resolution 1 to 5 stars"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-pressed={saved === n}
            className={styles.starBtn}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleRate(n)}
            disabled={saving}
          >
            <Star
              size={26}
              weight={display >= n ? 'fill' : 'regular'}
              className={display >= n ? styles.starFilled : styles.starEmpty}
            />
          </button>
        ))}
      </div>
      {saved > 0 && (
        <span className={styles.ratingValue}>{saved}/5</span>
      )}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export default function FeedbackTimelineModal({ post, isOpen, onClose, currentUserId }) {
  const [localRating, setLocalRating] = useState(post?.rating ?? 0);
  const overlayRef = useRef(null);

  const timeline = buildTimeline(post);
  const isResolved = post?.status === 'Resolved';
  const isAuthor = currentUserId && post?.userId && currentUserId === post?.userId;
  const showRating = isResolved && isAuthor;

  // Sync rating if post changes
  useEffect(() => {
    setLocalRating(post?.rating ?? 0);
  }, [post?.id, post?.rating]);

  // Lock scroll when open
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const modal = (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Status Timeline"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <ClockCountdown size={18} weight="duotone" className={styles.headerIcon} />
            <div>
              <h2 className={styles.headerTitle}>Status Timeline</h2>
              <p className={styles.headerSub}>Track the movement of this feedback.</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Feedback reference */}
        {post.feedbackNo && (
          <div className={styles.feedbackRef}>
            <span className={styles.feedbackRefLabel}>Feedback No.</span>
            <strong className={styles.feedbackRefNo}>{post.feedbackNo}</strong>
          </div>
        )}

        {/* Timeline steps */}
        <div className={styles.timeline}>
          {timeline.map((step, index) => (
            <div key={step.key} className={styles.step}>
              <div className={styles.stepIndicator}>
                <span
                  className={[
                    styles.dot,
                    styles[`dot_${step.state}`],
                  ].filter(Boolean).join(' ')}
                />
                {index < timeline.length - 1 && (
                  <span className={styles.line} />
                )}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTopline}>
                  <strong className={styles.stepLabel}>{step.label}</strong>
                  {step.responseWindow && (
                    <span
                      className={[
                        styles.stepWindow,
                        step.responseWindow.includes('overdue') ? styles.stepWindowOverdue
                          : step.responseWindow.includes('late') ? styles.stepWindowLate
                          : styles.stepWindowOnTime,
                      ].join(' ')}
                    >
                      {step.responseWindow}
                    </span>
                  )}
                  <span className={styles.stepValue}>{step.value}</span>
                </div>
                <p className={styles.stepDetail}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Star rating — only for resolved feedback by author */}
        {showRating && (
          <StarRating
            postId={post.id}
            initialRating={localRating}
            onRated={(v) => setLocalRating(v)}
          />
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
