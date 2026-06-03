import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClockCountdown, Star, X } from '@phosphor-icons/react';
import { showToast } from '../Toast/Toast.jsx';
import { lockPageScroll } from '@core/utils/lockPageScroll.js';
import styles from './FeedbackTimelineModal.module.css';
import feedCardStyles from './FeedCard.module.css';

// ─── Star Rating Component ────────────────────────────────────────────────────

function StarRating({ rating, onRate, isSaving }) {
  const [hover, setHover] = useState(0);
  const displayRating = hover || rating;

  return (
    <div className={styles.ratingSection}>
      <span className={styles.ratingLabel}>Rate this resolution:</span>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={styles.starBtn}
            onClick={() => !isSaving && onRate(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            disabled={isSaving}
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              size={22}
              weight={star <= displayRating ? 'fill' : 'regular'}
              className={star <= displayRating ? styles.starFilled : styles.starEmpty}
            />
          </button>
        ))}
      </div>
      <span className={styles.ratingValue}>{displayRating > 0 ? `${displayRating}/5` : '—'}</span>
    </div>
  );
}

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

// ─── Modal ───────────────────────────────────────────────────────────────────

export default function FeedbackTimelineModal({ 
  post, 
  isOpen, 
  onClose, 
  isCurrentUser = false, 
  rating = 0, 
  onRate = () => {}, 
  ratingSaving = false 
}) {
  const overlayRef = useRef(null);

  const timeline = buildTimeline(post);

  // Lock scroll when open
  useEffect(() => {
    if (!isOpen) return undefined;
    return lockPageScroll();
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
      className={feedCardStyles.modalOverlay}
      role="presentation"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={feedCardStyles.reportModal}
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

        {/* Star Rating Section */}
        {isCurrentUser && post?.status === 'Resolved' && (
          <StarRating 
            rating={rating} 
            onRate={onRate} 
            isSaving={ratingSaving} 
          />
        )}

      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
