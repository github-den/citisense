import { useEffect, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BookmarkSimple,
  CalendarStar,
  ChatsCircle,
  FlagBanner,
  Lightbulb,
  ShareFat,
  Smiley,
  Star,
  TrayArrowUp,
  X,
  UserCirclePlus,
  UserCircleCheck,
  UserCircleMinus,
  Warning,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import { useApp } from '@core/context/AppContext.jsx';
import {
  bookmarkPost,
  followUser,
  reactPost,
  raisePost,
  unbookmarkPost,
  unfollowUser,
  unraisePost,
  flagPost,
} from '@core/services/posts.js';
import { isBookmarkedPost, setBookmarkedPost } from '@core/services/localState.js';
import { formatCount } from '@core/utils/format.js';
import { normalizeIncidentLocationLabel } from '@core/utils/location.js';
import { resolveFeedbackMood } from '@core/utils/mood.js';
import { dedupeMediaItems, getMediaGridModel, inferMediaType } from '@core/utils/mediaGrid.js';
import { lockPageScroll } from '@core/utils/lockPageScroll.js';
import { FEEDBACK_REPORT_FLAGS } from '@core/constants/reportFlags.js';
import Avatar from '../ui/Avatar.jsx';
import Popover from '../ui/Popover.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { showToast } from '../Toast/Toast.jsx';
import MediaCarousel from '../MediaGrid/MediaCarousel.jsx';

import styles from './FeedCard.module.css';
import FeedbackTimelineModal from './FeedbackTimelineModal.jsx';

const TYPE_META = {
  complaint: { label: 'Complaint', Icon: Warning, toneClass: styles.typeComplaint },
  suggestion: { label: 'Suggestion', Icon: Lightbulb, toneClass: styles.typeSuggestion },
  compliment: { label: 'Compliment', Icon: Star, toneClass: styles.typeCompliment },
};

const REACTIONS = [
  { emoji: '\u{1F970}', label: 'Grateful' },
  { emoji: '\u{1F642}', label: 'Satisfied' },
  { emoji: '\u{1F622}', label: 'Sad' },
  { emoji: '\u{1F621}', label: 'Angry' },
];

const REPORT_FLAGS = FEEDBACK_REPORT_FLAGS;

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const week = 604_800_000;

  if (diff < minute) return 'now';
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
  if (diff < week) return `${Math.max(1, Math.floor(diff / day))}d ago`;
  return `${Math.max(1, Math.floor(diff / week))}w ago`;
}

function formatExactDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const weekday = date.toLocaleString('en-US', { weekday: 'long' });
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.toLocaleString('en-US', { day: '2-digit' });
  const year = date.toLocaleString('en-US', { year: 'numeric' });
  const time = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${weekday}, ${month} ${day}, ${year} ${time}`;
}

function getDisplayUsername(post) {
  return String(post?.handle || post?.user || 'Citizen')
    .replace(/^@+/, '')
    .trim() || 'Citizen';
}




function Caption({ content, onOpenDiscuss, isFullView }) {
  const [expanded, setExpanded] = useState(isFullView);
  const [isClamped, setIsClamped] = useState(false);
  const captionRef = useRef(null);

  useEffect(() => {
    if (captionRef.current) {
      const { scrollHeight, clientHeight } = captionRef.current;
      setIsClamped(scrollHeight > clientHeight);
    }
  }, [content]);

  // Simple regex for [text](url)
  const parts = content.split(/(\[.*?\]\(.*?\))/g);
  
  const renderedContent = parts.map((part, i) => {
    const match = part.match(/\[(.*?)\]\((.*?)\)/);
    if (match) {
      const [_, text, url] = match;
      const isPostLink = url.includes('/post/');
      
      const handleClick = (e) => {
        if (isPostLink) {
          e.preventDefault();
          e.stopPropagation();
          const postId = url.split('/post/')[1];
          onOpenDiscuss?.({ id: postId }); // Assuming onOpenDiscuss takes a post object or ID
        }
      };

      return (
        <a 
          key={i} 
          href={url} 
          className={styles.mentionLink} 
          onClick={handleClick}
          target={isPostLink ? undefined : '_blank'}
          rel={isPostLink ? undefined : 'noopener noreferrer'}
        >
          {text}
        </a>
      );
    }
    return part;
  });

  return (
    <div className={styles.captionWrap}>
      <div 
        ref={captionRef} 
        className={[
          styles.caption, 
          !expanded ? styles.captionClamped : '',
          isFullView ? styles.captionFull : ''
        ].filter(Boolean).join(' ')}
      >
        {renderedContent}
      </div>
      {!isFullView && isClamped && !expanded && (
        <button
          type="button"
          className={styles.captionToggle}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
        >
          Show more
        </button>
      )}
      {!isFullView && expanded && (
        <button
          type="button"
          className={styles.captionToggle}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
        >
          Show less
        </button>
      )}
    </div>
  );
}

function formatDetailsLocation(post) {
  const barangay = String(post?.raw?.barangay ?? post?.barangay ?? '').trim();
  const locationWithoutCoords = normalizeIncidentLocationLabel(post?.location);

  if (locationWithoutCoords) return locationWithoutCoords;
  if (barangay) return `Barangay ${barangay}`;
  return '';
}

function formatCompactReviewDuration(ms) {
  const totalHours = Math.max(1, Math.ceil(Math.abs(ms) / 36e5));
  if (totalHours < 24) return `${totalHours}hr`;

  const totalDays = Math.ceil(totalHours / 24);
  if (totalDays < 14) return `${totalDays}d`;

  return `${Math.ceil(totalDays / 7)}w`;
}

function formatStatusForDetails(post) {
  if (!post.status) return 'Status N/A (Only for complaints)';
  
  const status = post.status;
  const createdAt = new Date(post?.raw?.created_at ?? post?.created_at ?? Date.now());
  if (Number.isNaN(createdAt.getTime())) return status;

  const reviewDeadline = createdAt.getTime() + (3 * 24 * 60 * 60 * 1000);

  if (status === 'Under Review') {
    const remainingMs = reviewDeadline - Date.now();
    if (remainingMs >= 0) return `Under review - ${formatCompactReviewDuration(remainingMs)} left`;
    return `Under review - ${formatCompactReviewDuration(remainingMs)} overdue`;
  }

  const reviewedAt = new Date(post?.raw?.updated_at ?? post?.updated_at ?? Date.now());
  const reviewedAtMs = Number.isNaN(reviewedAt.getTime()) ? Date.now() : reviewedAt.getTime();
  const reviewDeltaMs = reviewedAtMs - reviewDeadline;
  const reviewTiming = reviewDeltaMs <= 0 ? 'On time' : `${formatCompactReviewDuration(reviewDeltaMs)} late`;
  
  const verifiedList = ['In Progress', 'On Hold', 'Resolved'];
  if (verifiedList.includes(status)) {
    return `Verified - ${reviewTiming} / ${status}`;
  }

  return `Dismissed - ${reviewTiming}`;
}

function formatInlineComplaintStatus(post) {
  if (!post?.status) return '';

  const status = String(post.status).trim();
  const createdAt = new Date(post?.raw?.created_at ?? post?.created_at ?? Date.now());
  if (Number.isNaN(createdAt.getTime())) return status;

  if (status === 'Under Review') {
    if (post.type !== 'complaint') return 'Under Review';
    const reviewDeadline = createdAt.getTime() + (3 * 24 * 60 * 60 * 1000);
    const remainingMs = reviewDeadline - Date.now();
    return remainingMs >= 0
      ? `Under Review - ${formatCompactReviewDuration(remainingMs)} left`
      : `Under Review - ${formatCompactReviewDuration(remainingMs)} overdue`;
  }

  return status;
}

function FeedbackDetailsPopover({ post, typeLabel, relativeTime, exactTime, onFilterByType, onFilterByCategory, onFilterByLocation, onViewStatusTimeline }) {
  const displayLocation = formatDetailsLocation(post);
  const moodSummary = resolveFeedbackMood(post);

  return (
    <div className={styles.feedbackDetails}>
      <div className={styles.detailsHeader}>Feedback details</div>

      <div className={styles.detailsTwoCol}>
        <div className={styles.detailsCol}>
          <div className={styles.detailsRow}>
            <span>Feedback No.</span>
            <strong>{post.feedbackNo || '—'}</strong>
          </div>
          <div className={styles.detailsRow}>
            <span>Citizen</span>
            <strong>{getDisplayUsername(post)}</strong>
          </div>
          <div className={styles.detailsRow}>
            <span>Posted</span>
            <Tooltip content={exactTime} align="left">
              <strong className={styles.postedTime}>{relativeTime}</strong>
            </Tooltip>
          </div>
        </div>
        <div className={styles.detailsCol}>
          <div className={styles.detailsRow}>
            <span>Feedback Type</span>
            <button className={styles.detailsLink} onClick={() => onFilterByType?.(post.type)}>
              {typeLabel}
            </button>
          </div>
          <div className={styles.detailsRow}>
            <span>Service Category</span>
            {post.service ? (
              <button className={styles.detailsLink} onClick={() => onFilterByCategory?.(post.service)}>
                {post.service}
              </button>
            ) : <span className={styles.detailsEmpty}>—</span>}
          </div>
          <div className={styles.detailsRow}>
            <span>Location of Incident</span>
            {displayLocation ? (
              <button className={styles.detailsLink} onClick={() => onFilterByLocation?.(displayLocation)}>
                {displayLocation}
              </button>
            ) : <span className={styles.detailsEmpty}>—</span>}
          </div>
        </div>
      </div>

      {moodSummary && (
        <div className={styles.moodSection}>
          <div className={styles.moodRow}>
            <span className={styles.moodEmoji}>{moodSummary.emoji}</span>
            <span className={styles.moodLabel}>The mood of this feedback is <strong>{moodSummary.label.toLowerCase()}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportModal({
  postId,
  reportSubmitting,
  reported,
  selectedReportFlags,
  onClose,
  onToggleFlag,
  onSubmit,
}) {
  const modal = (
    <div className={styles.modalOverlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.reportModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`report-title-${postId}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id={`report-title-${postId}`}>Report feedback</h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close report modal"
            disabled={reportSubmitting}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className={styles.reportModalBody}>
          <div className={styles.reportFlagList} role="group" aria-label="Report reasons">
            {REPORT_FLAGS.map((flag) => {
              const checked = selectedReportFlags.includes(flag);
              return (
                <label
                  key={flag}
                  className={`${styles.reportFlagOption} ${checked ? styles.reportFlagOptionActive : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleFlag(flag)}
                    disabled={reportSubmitting || reported}
                  />
                  <span className={styles.reportFlagMarker} aria-hidden="true">
                    {checked ? <FlagBanner size={18} weight="fill" /> : null}
                  </span>
                  <span className={styles.reportFlagLabel}>{flag}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className={styles.reportModalActions}>
          <button type="button" className={styles.reportCancelButton} onClick={onClose} disabled={reportSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.reportSubmitButton}
            onClick={onSubmit}
            disabled={reportSubmitting || reported || selectedReportFlags.length === 0}
          >
            {reportSubmitting ? 'Reporting...' : (reported ? 'Reported' : 'Submit report')}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

const FeedCard = forwardRef(({
  post,
  onFilterByType,
  onFilterByCategory,
  onFilterByLocation,
  onViewStatusTimeline,
  onViewProfile,
  isFullView = false,
  isDiscussMode = false,
  className = '',
}, ref) => {
  const { requireAuth, isAuthenticated, session } = useAuth() ?? {};
  const router = useRouter();
  const currentUserId = session?.user?.id;
  const isCurrentUser = currentUserId === post.userId;

  const { openDiscuss } = useApp() ?? {};
  const mediaItems = dedupeMediaItems([post.imageUrl, ...(Array.isArray(post.images) ? post.images : [])]).slice(0, 10);
  const mediaModel = getMediaGridModel(mediaItems);

  const [raised, setRaised] = useState(!!post.raisedByMe);
  const [raiseCount, setRaiseCount] = useState(post.raises ?? 0);
  const [following, setFollowing] = useState(!!post.followedByMe);
  const [bookmarked, setBookmarked] = useState(() => isBookmarkedPost(post.id));
  const [reaction, setReaction] = useState(post.myReaction || null);
  const [reactCount, setReactCount] = useState(post.reacts ?? 0);


  // Sync state with props when post data changes (important for reloads/filtering)
  useEffect(() => {
    setRaised(!!post.raisedByMe);
    setRaiseCount(post.raises ?? 0);
    setFollowing(!!post.followedByMe);
    setReactCount(post.reacts ?? 0);
    setReaction(post.myReaction || null);
    setReported(!!post.reportedByMe);
  }, [post.id, post.raisedByMe, post.followedByMe, post.raises, post.reacts, post.myReaction, post.reportedByMe]);

  const [reported, setReported] = useState(!!post.reportedByMe);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [selectedReportFlags, setSelectedReportFlags] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reactsOpen, setReactsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const [hoveredAction, setHoveredAction] = useState(null);
  const pressTimer = useRef(null);

  const handleTouchStart = () => {
    pressTimer.current = setTimeout(() => {
      setReactsOpen(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const typeMeta = TYPE_META[post.type] ?? TYPE_META.complaint;
  const relativeTime = formatRelativeTime(post.raw?.created_at ?? post.created_at ?? post.time);
  const exactTime = formatExactDate(post.raw?.created_at ?? post.created_at);
  const inlineStatus = formatInlineComplaintStatus(post);



  useEffect(() => {
    if (!detailsOpen) return undefined;

    function closeDetailsOnScroll() {
      setDetailsOpen(false);
    }

    window.addEventListener('scroll', closeDetailsOnScroll, true);

    return () => {
      window.removeEventListener('scroll', closeDetailsOnScroll, true);
    };
  }, [detailsOpen]);

  useEffect(() => {
    if (!reportOpen) return undefined;
    return lockPageScroll();
  }, [reportOpen]);

  function gate(action, message) {
    if (requireAuth) requireAuth(action, message);
    else action();
  }

  async function toggleRaise() {
    gate(async () => {
      const next = !raised;
      const before = raiseCount;
      const after = next ? before + 1 : Math.max(0, before - 1);
      
      setRaised(next);
      setRaiseCount(after);
      
      const result = next 
        ? await raisePost(post.id, currentUserId) 
        : await unraisePost(post.id, currentUserId);
      if (result?.error) {
        setRaised(!next);
        setRaiseCount(before);
        return;
      }

      const exactCount = result?.data?.raises_count;
      if (typeof exactCount === 'number') {
        setRaiseCount(exactCount);
      }
    }, 'Sign in to raise this feedback.');
  }

  async function toggleFollow() {
    gate(async () => {
      const next = !following;
      setFollowing(next);

      const result = next ? await followUser(post.userId) : await unfollowUser(post.userId);
      if (result?.error) {
        setFollowing(!next);
      }
    }, 'Sign in to follow this citizen.');
  }

  async function toggleBookmark() {
    gate(async () => {
      const next = !bookmarked;
      setBookmarked(next);
      setBookmarkedPost(post.id, next);
      const result = next ? await bookmarkPost(post.id) : await unbookmarkPost(post.id);
      if (result?.error) {
        setBookmarked(!next);
        setBookmarkedPost(post.id, !next);
        return;
      }

      showToast(next ? 'Feedback saved.' : 'Feedback unsaved.', 'success');
    }, 'Sign in to save feedback for later.');
  }

  async function pickReaction(emoji) {
    gate(async () => {
      // Toggle off if same emoji, otherwise set new
      const isUnreact = (reaction === emoji);
      const nextEmoji = isUnreact ? null : emoji;
      const previous = reaction;
      const beforeCount = reactCount;
      
      setReaction(nextEmoji);
      
      // Update count logic
      let afterCount = beforeCount;
      if (isUnreact) {
        afterCount = Math.max(0, beforeCount - 1);
      } else if (!previous) {
        afterCount = beforeCount + 1;
      }
      // If just changing emoji, count stays the same (handled by !previous check)
      
      setReactCount(afterCount);

      const result = await reactPost(post.id, nextEmoji);
      if (result?.error) {
        setReaction(previous);
        setReactCount(beforeCount);
      }
    }, 'Sign in to react to this feedback.');
  }

  function handleMainReactClick(e) {
    e.stopPropagation();
    // Default to Grateful (same as the first feed reaction) if no reaction, otherwise remove current
    const defaultEmoji = '\u{1F970}';
    if (reaction) {
      pickReaction(reaction);
    } else {
      pickReaction(defaultEmoji);
    }
  }

  function openReportModal() {
    gate(() => {
      setSelectedReportFlags([]);
      setReportOpen(true);
    }, 'Sign in to report this feedback.');
  }

  function closeReportModal() {
    if (reportSubmitting) return;
    setReportOpen(false);
    setSelectedReportFlags([]);
  }

  function toggleReportFlag(label) {
    setSelectedReportFlags((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
  }

  async function submitReport() {
    if (reported) {
      closeReportModal();
      return;
    }

    if (selectedReportFlags.length === 0) {
      showToast('Select at least one reason before submitting.', { type: 'warning' });
      return;
    }

    setReportSubmitting(true);
    const previousReported = reported;
    setReported(true);

    const result = await flagPost(post.id, selectedReportFlags);
    setReportSubmitting(false);

    if (result?.error) {
      setReported(previousReported);
      const message = String(result.error?.message ?? 'Unable to submit your flag right now.');
      showToast(message, { type: 'error' });
      return;
    }

    setReportOpen(false);
    showToast('Feedback flagged for review.', { type: 'success' });
  }

  function handleShare() {
    gate(async () => {
      const shareUrl = `${window.location.origin}/post/${post.id}`;
      const shareText = `Check out this feedback on Citisense: "${post.content.substring(0, 100)}..."`;
      
      if (navigator.share) {
        try {
          await navigator.share({ 
            title: 'Citisense Feedback',
            text: shareText,
            url: shareUrl 
          });
        } catch {
          return;
        }
      } else {
        handleCopy();
      }
    }, 'Sign in to share this feedback.');
  }

  function handleCopy() {
    gate(async () => {
      const shareUrl = `${window.location.origin}/post/${post.id}`;
      await navigator.clipboard?.writeText(shareUrl);
      showToast('Link copied!', { type: 'success' });
    }, 'Sign in to copy and share this feedback.');
  }



  function handleAvatarClick() {
    if (onViewProfile) onViewProfile(post.userId);
    else if (post.user) router.push(`/profile/${post.user.replace('@', '')}`);
  }

  function handleUsernameClick() {
    if (onViewProfile) onViewProfile(post.userId);
    else if (post.user) router.push(`/profile/${post.user.replace('@', '')}`);
  }

  const handleEdit = (e) => {
    e.stopPropagation();
    router.push(`/write?edit=${post.id}`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      if (post.id.startsWith('demo-')) {
        const { deleteDemoPost } = await import('@core/services/demoPosts.js');
        deleteDemoPost(post.id);
      } else {
        const { supabase } = await import('@core/lib/supabase.js');
        if (supabase) {
          const { error } = await supabase
            .from('feedbacks')
            .delete()
            .eq('id', post.id);

          if (error) {
            showToast(error.message || 'Unable to delete feedback.', 'error');
            return;
          }
        }
      }
      showToast('Feedback deleted.', 'success');
      window.location.reload();
    } catch (err) {
      console.error(err);
      showToast('An error occurred while deleting feedback.', 'error');
    }
  };

  return (
    <article 
      ref={ref}
      className={[styles.card, className].filter(Boolean).join(' ')} 
      aria-labelledby={`post-username-${post.id}`} 
      role="article"
    >
      <div className={styles.topRow}>
        <div className={styles.identity}>
          <button className={styles.avatarButton} onClick={handleAvatarClick} aria-label="View profile">
            <Avatar
              size="lg"
              name={post.user}
              initials={post.initials}
              src={typeof post.bg === 'string' && post.bg.startsWith('/avatars/') ? post.bg : null}
              bg={post.bg}
              aria-hidden="true"
            />
          </button>
          <div className={styles.identityCopy}>
            <div className={styles.usernameRow}>
              <button className={styles.usernameButton} onClick={handleUsernameClick} id={`post-username-${post.id}`}>
                {getDisplayUsername(post)}
              </button>
              {!isCurrentUser && !following ? (
                <button
                  type="button"
                  className={styles.inlineFollowButton}
                  onClick={toggleFollow}
                >
                  Follow
                </button>
              ) : null}
            </div>
            <div className={styles.metadataRow}>
              <Tooltip content={exactTime} align="left">
                <button type="button" className={styles.timeButton} aria-label={`Posted ${exactTime}`}>
                  {relativeTime}
                </button>
              </Tooltip>
              <span className={styles.metadataSeparator}>·</span>
              <button 
                type="button" 
                className={[styles.typeButton, typeMeta.toneClass].join(' ')} 
                onClick={() => onFilterByType?.(post.type)}
              >
                <typeMeta.Icon size={14} weight="duotone" aria-hidden="true" />
                <span>{typeMeta.label}</span>
              </button>
              {inlineStatus ? (
                <>
                  <span className={styles.metadataSeparator}>·</span>
                  <Tooltip content="View status timeline" align="top" delayDuration={0}>
                    <button
                      type="button"
                      className={styles.statusButton}
                      onClick={(e) => { e.stopPropagation(); setTimelineOpen(true); }}
                    >
                      <CalendarStar size={14} weight="duotone" aria-hidden="true" />
                      <span>{inlineStatus}</span>
                    </button>
                  </Tooltip>
                </>
              ) : null}
              <span className={styles.metadataSeparator}>·</span>
              <Popover
                open={detailsOpen}
                align="start"
                onOpenChange={setDetailsOpen}
                trigger={<button type="button" className={styles.moreButton}>{detailsOpen ? 'less' : 'more'}</button>}
                panelClassName={styles.detailsPopover}
              >
                <FeedbackDetailsPopover
                  post={post}
                  typeLabel={typeMeta.label}
                  relativeTime={relativeTime}
                  exactTime={exactTime}
                  onFilterByType={onFilterByType}
                  onFilterByCategory={onFilterByCategory}
                  onFilterByLocation={onFilterByLocation}
                  onViewStatusTimeline={onViewStatusTimeline}
                />
              </Popover>
            </div>
          </div>
        </div>

        <div className={styles.topActions}>
          {!isCurrentUser && (
            <Tooltip content={bookmarked ? 'Saved' : 'Save'} align="right">
              <button 
                type="button" 
                className={styles.saveButtonTop} 
                onClick={toggleBookmark} 
                aria-label={bookmarked ? 'Remove from saved' : 'Save for later'} 
                aria-pressed={bookmarked}
                onMouseEnter={() => setHoveredAction('save')}
                onMouseLeave={() => setHoveredAction(null)}
              >
                <BookmarkSimple size={20} weight={hoveredAction === 'save' ? 'duotone' : (bookmarked ? 'fill' : 'regular')} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          {isCurrentUser && post.status === 'Under Review' && (
            <>
              <Tooltip content="Edit" align="top">
                <button 
                  type="button" 
                  className={styles.editButton} 
                  onClick={handleEdit} 
                  aria-label="Edit feedback"
                >
                  <PencilSimple size={20} weight="regular" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip content="Delete" align="top">
                <button 
                  type="button" 
                  className={styles.deleteButton} 
                  onClick={handleDelete} 
                  aria-label="Delete feedback"
                >
                  <Trash size={20} weight="regular" aria-hidden="true" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
      <div className={styles.captionRow}>
        <Caption 
          content={post.content} 
          onOpenDiscuss={() => openDiscuss?.(post)} 
          isFullView={isFullView}
        />
      </div>

      {mediaModel.total > 0 ? (
        <MediaCarousel 
          items={mediaItems} 
          className={styles.mediaBlock} 
        />
      ) : null}

      <div className={styles.actionRow} role="toolbar" aria-label="Feedback actions">
        <div className={styles.actionCluster}>
          <div
            className={[
              styles.raiseFlagSwitch,
              raised ? styles.raiseFlagSwitchActive : '',
              reported ? styles.raiseFlagSwitchReported : '',
              hoveredAction === 'raiseSwitch' ? styles.raiseFlagSwitchRaiseHover : '',
              hoveredAction === 'flagSwitch' && !reported ? styles.raiseFlagSwitchFlagHover : '',
            ].filter(Boolean).join(' ')}
          >
            <Tooltip content={raised ? 'Unraise' : 'Raise'} align="top" delayDuration={0}>
              <button
                type="button"
                className={styles.raiseSwitchButton}
                onClick={toggleRaise}
                aria-pressed={raised}
                aria-label={`${raised ? 'Remove raise from' : 'Raise this'} feedback`}
                onMouseEnter={() => setHoveredAction('raiseSwitch')}
                onMouseLeave={() => setHoveredAction(null)}
              >
                <TrayArrowUp
                  size={20}
                  weight={raised ? 'fill' : 'regular'}
                  className={styles.raiseSwitchIcon}
                  aria-hidden="true"
                />
                <strong className={styles.raiseSwitchCount}>{formatCount(raiseCount)}</strong>
              </button>
            </Tooltip>

            <span className={styles.raiseFlagDivider} aria-hidden="true" />

            <Tooltip content={reported ? 'Reported' : 'Report'} align="top" delayDuration={0}>
              <button
                type="button"
                className={styles.flagSwitchButton}
                onClick={reported ? undefined : openReportModal}
                aria-label={reported ? 'Feedback already reported' : 'Report feedback'}
                aria-pressed={reported}
                aria-disabled={reported}
                disabled={reported}
                onMouseEnter={() => !reported && setHoveredAction('flagSwitch')}
                onMouseLeave={() => setHoveredAction(null)}
              >
                <FlagBanner
                  size={20}
                  weight={reported ? 'fill' : 'regular'}
                  className={styles.flagSwitchIcon}
                  aria-hidden="true"
                />
              </button>
            </Tooltip>
          </div>

          <Popover
            hoverable
            align="start"
            open={reactsOpen}
            onOpenChange={setReactsOpen}
            trigger={(
              <button 
                type="button" 
                className={[styles.actionButton, reaction ? styles.reactActive : ''].filter(Boolean).join(' ')} 
                aria-label="React to feedback" 
                aria-expanded={reactsOpen}
                onClick={handleMainReactClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseEnter={() => setHoveredAction('react')}
                onMouseLeave={() => setHoveredAction(null)}
              >
                {reaction ? (
                  <span className={styles.activeReaction}>{reaction}</span>
                ) : (
                  <Smiley size={20} weight={hoveredAction === 'react' ? 'duotone' : 'regular'} aria-hidden="true" />
                )}
                <strong style={reaction ? { marginLeft: '4px' } : {}}>{formatCount(reactCount)}</strong>
              </button>
            )}
            panelClassName={styles.reactPopover}
          >
            <div className={styles.reactPanelInner}>
              <div className={styles.reactQuestion}>What do you feel about this service?</div>
              <div className={styles.reactList} role="radiogroup" aria-label="Select reaction">
                {REACTIONS.map((item) => (
                  <button 
                    key={item.label} 
                    type="button" 
                    className={[styles.reactItem, hoveredReaction === item.label ? styles.reactItemHovered : ''].join(' ')} 
                    onClick={() => {
                      pickReaction(item.emoji);
                      setReactsOpen(false);
                    }} 
                    onMouseEnter={() => setHoveredReaction(item.label)}
                    onMouseLeave={() => setHoveredReaction(null)}
                    aria-label={`React as ${item.label}`} 
                    aria-checked={reaction === item.emoji}
                  >
                    <span className={styles.reactEmoji} aria-hidden="true">{item.emoji}</span>
                    {hoveredReaction === item.label && (
                      <span className={styles.reactLabel}>{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Popover>

          <Tooltip content="Discuss" align="top">
            <button 
              type="button" 
              className={[styles.actionButton, isDiscussMode ? styles.actionButtonActiveDiscuss : ''].join(' ')} 
              onClick={() => openDiscuss?.(post)} 
              aria-label={`Discuss feedback (${formatCount(post.discuss ?? 0)} discussions)`}
              onMouseEnter={() => setHoveredAction('discuss')}
              onMouseLeave={() => setHoveredAction(null)}
            >
              <ChatsCircle 
                size={20} 
                weight={isDiscussMode ? 'duotone' : (hoveredAction === 'discuss' ? 'duotone' : 'regular')} 
                color={isDiscussMode ? 'var(--ui-accent)' : undefined}
                aria-hidden="true" 
              />
              <strong style={isDiscussMode ? { color: 'var(--ui-text-muted)' } : {}}>{formatCount(post.discuss ?? 0)}</strong>
            </button>
          </Tooltip>

          <Tooltip content="Share" align="top">
            <button
              type="button"
              className={styles.shareButton}
              aria-label="Share feedback"
              onClick={handleShare}
              onMouseEnter={() => setHoveredAction('share')}
              onMouseLeave={() => setHoveredAction(null)}
            >
              <ShareFat size={20} weight={hoveredAction === 'share' ? 'duotone' : 'regular'} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

      </div>

      {reportOpen ? (
        <ReportModal
          postId={post.id}
          reportSubmitting={reportSubmitting}
          reported={reported}
          selectedReportFlags={selectedReportFlags}
          onClose={closeReportModal}
          onToggleFlag={toggleReportFlag}
          onSubmit={submitReport}
        />
      ) : null}

      {deleteConfirmOpen ? createPortal(
        <div className={styles.modalOverlay} role="presentation" onMouseDown={() => setDeleteConfirmOpen(false)}>
          <div
            className={styles.reportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${post.id}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id={`delete-title-${post.id}`} className={styles.deleteModalTitle}>
                <Trash size={18} weight="fill" className={styles.deleteModalIcon} />
                Delete feedback
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDeleteConfirmOpen(false)}
                aria-label="Close delete modal"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className={styles.reportModalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to delete this feedback? This action cannot be undone.
              </p>
            </div>
            <div className={styles.reportModalActions}>
              <button type="button" className={styles.reportCancelButton} onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.deleteConfirmButton} onClick={confirmDelete}>
                <Trash size={14} weight="fill" /> Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      <FeedbackTimelineModal
        post={post}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        currentUserId={currentUserId}
      />

    </article>
  );
});

export default FeedCard;
