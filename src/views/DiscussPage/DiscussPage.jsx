import { useEffect, useMemo, useRef, useState } from 'react';
import { PaperPlaneTilt, Paperclip, X, At, TrayArrowUp, FlagBanner } from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { postDiscuss, setDiscussionRaise } from '@core/services/posts.js';
import { uploadMediaFiles } from '@core/services/media.js';
import { reportEntity } from '@core/services/moderation.js';
import { DISCUSSION_REPORT_FLAGS } from '@core/constants/reportFlags.js';
import { fetchUserRaisedDiscussionKeys, getDiscussionRaiseKey } from '@core/services/discussionRaiseState.js';
import { fetchUserReportedEntityKeys } from '@core/services/reportState.js';
import { useDiscussions } from '@core/hooks/useDiscussions.js';
import { formatCount, formatTime } from '@core/utils/format.js';
import feedCardStyles from '../../components/FeedCard/FeedCard.module.css';
import styles from './DiscussPage.module.css';

const MAX_ATTACHMENTS = 1;
const DEFAULT_VISIBLE_REPLIES = 5;

function isVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(url ?? ''));
}

function isImage(url) {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(String(url ?? ''));
}

function makeAttachment(file) {
  return {
    id: crypto.randomUUID(),
    file,
    url: URL.createObjectURL(file),
    type: file.type?.startsWith('video/') ? 'video' : 'image',
  };
}

function formatDiscussionTimestamp(value) {
  if (!value) return '';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';

  const diff = Date.now() - timestamp;
  if (diff < 24 * 60 * 60 * 1000) return formatTime(value);

  const date = new Date(timestamp);
  const day = date.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.toLocaleDateString('en-GB', { year: '2-digit' });
  return `${day} ${month} '${year}`;
}

function buildDiscussionGroups(items, sortMode = 'popular') {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const byParent = new Map();

  items.forEach((item) => {
    const key = String(item.parentId ?? 'root');
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  });

  function getReplies(parentId) {
    const nodes = [...(byParent.get(String(parentId)) ?? [])]
      .sort((left, right) => Date.parse(left.createdAt ?? '') - Date.parse(right.createdAt ?? ''));

    return nodes.flatMap((node) => {
      const parent = byId.get(String(node.parentId));
      const replyTarget = parent?.author?.fullName ?? null;
      return [
        {
          ...node,
          replyTarget,
          displayTime: formatDiscussionTimestamp(node.createdAt),
        },
        ...getReplies(node.id),
      ];
    });
  }

  return items
    .filter((item) => !item.parentId)
    .map((item) => ({
      ...item,
      replies: getReplies(item.id),
      displayTime: formatDiscussionTimestamp(item.createdAt),
    }))
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      if (sortMode === 'popular') {
        const likeDelta = Number(right.likes ?? 0) - Number(left.likes ?? 0);
        if (likeDelta !== 0) return likeDelta;
      }
      return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
    });
}

function getDiscussionEntityType(entry) {
  return entry?.parentId ? 'reply' : 'discussion';
}

function getDiscussionReportKey(entry) {
  return `${getDiscussionEntityType(entry)}:${String(entry?.id ?? '').trim()}`;
}

function DiscussionReportModal({ entry, reported, onClose, onReported }) {
  const { requireAuth, session } = useAuth() ?? {};
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [busy, setBusy] = useState(false);

  if (!entry) return null;

  const entityType = entry.parentId ? 'reply' : 'discussion';
  const isOwnEntry = session?.user?.id && session.user.id === entry.userId;
  const modalTitle = entityType === 'reply' ? 'Report reply' : 'Report discussion';

  function toggleFlag(label) {
    setSelectedFlags((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
  }

  function handleSubmit() {
    const submit = async () => {
      if (isOwnEntry || selectedFlags.length === 0 || reported) return;
      setBusy(true);

      const { error: reportError } = await reportEntity({
        entityType,
        entityId: entry.id,
        selectedFlags,
      });

      if (reportError) {
        setBusy(false);
        return;
      }

      setBusy(false);
      onReported?.(entry.id);
      onClose?.();
    };

    if (requireAuth) requireAuth(submit, 'Sign in to report this discussion entry.');
    else submit();
  }

  return (
    <div className={feedCardStyles.modalOverlay} role="presentation" onMouseDown={onClose}>
      <div
        className={feedCardStyles.reportModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`discussion-report-title-${entry.id}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={feedCardStyles.modalHeader}>
          <h2 id={`discussion-report-title-${entry.id}`}>{modalTitle}</h2>
          <button
            type="button"
            className={feedCardStyles.modalClose}
            onClick={onClose}
            aria-label="Close report modal"
            disabled={busy}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className={feedCardStyles.reportModalBody}>
          <div className={feedCardStyles.reportFlagList} role="group" aria-label="Report reasons">
            {DISCUSSION_REPORT_FLAGS.map((flag) => {
              const checked = selectedFlags.includes(flag);
              return (
                <label
                  key={flag}
                  className={`${feedCardStyles.reportFlagOption} ${checked ? feedCardStyles.reportFlagOptionActive : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFlag(flag)}
                    disabled={busy || reported || isOwnEntry}
                  />
                  <span className={feedCardStyles.reportFlagMarker} aria-hidden="true">
                    {checked ? <FlagBanner size={18} weight="fill" /> : null}
                  </span>
                  <span className={feedCardStyles.reportFlagLabel}>{flag}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className={feedCardStyles.reportModalActions}>
          <button type="button" className={feedCardStyles.reportCancelButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={feedCardStyles.reportSubmitButton}
            onClick={handleSubmit}
            disabled={busy || reported || isOwnEntry || selectedFlags.length === 0}
          >
            {busy ? 'Reporting...' : (reported ? 'Reported' : 'Submit report')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscussionThreadSkeleton() {
  return (
    <div className={styles.threadLoading} aria-hidden="true">
      <div className={styles.threadSkeletonCard}>
        <div className={styles.threadSkeletonHeader}>
          <div className={styles.threadSkeletonAvatar} />
          <div className={styles.threadSkeletonMeta}>
            <div className={styles.threadSkeletonName} />
            <div className={styles.threadSkeletonTime} />
          </div>
        </div>
        <div className={styles.threadSkeletonBody}>
          <div className={styles.threadSkeletonLine} />
          <div className={`${styles.threadSkeletonLine} ${styles.threadSkeletonLineShort}`} />
        </div>
        <div className={styles.threadSkeletonFooter}>
          <div className={styles.threadSkeletonChip} />
          <div className={styles.threadSkeletonChip} />
          <div className={styles.threadSkeletonChip} />
        </div>
      </div>
    </div>
  );
}

export default function DiscussPage({ post, onBack, hideComposer = false, onReplyClick }) {
  const { session, requireAuth } = useAuth() ?? {};
  const [refresh, setRefresh] = useState(0);
  const [parentId, setParentId] = useState(null);
  const [reportEntry, setReportEntry] = useState(null);
  const [sortMode, setSortMode] = useState('popular');
  const [expandedReplies, setExpandedReplies] = useState({});
  const [raisedEntryKeys, setRaisedEntryKeys] = useState(() => new Set());
  const [entryLikeOverrides, setEntryLikeOverrides] = useState({});
  const [reportedEntryKeys, setReportedEntryKeys] = useState(() => new Set());
  const { discussions, loading, error: discussionsError } = useDiscussions(post?.id, refresh);

  const replyingTo = useMemo(() => {
    if (!parentId) return null;
    return discussions.find(d => d.id === parentId) ?? null;
  }, [discussions, parentId]);

  const discussionGroups = useMemo(() => buildDiscussionGroups(discussions, sortMode), [discussions, sortMode]);
  const topLevelCount = discussionGroups.length;
  const postWithDiscussionCount = useMemo(
    () => ({ ...post, discuss: topLevelCount }),
    [post, topLevelCount],
  );

  useEffect(() => {
    const handleRefresh = () => setRefresh(prev => prev + 1);
    window.addEventListener('citicontrol:refresh-discussions', handleRefresh);
    return () => window.removeEventListener('citicontrol:refresh-discussions', handleRefresh);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session?.user?.id || discussions.length === 0) {
      setRaisedEntryKeys(new Set());
      setReportedEntryKeys(new Set());
      return () => {
        cancelled = true;
      };
    }

    const reportEntries = discussions.map((entry) => ({
      id: entry.id,
      entityType: getDiscussionEntityType(entry),
    }));

    Promise.all([
      fetchUserRaisedDiscussionKeys(discussions, session.user.id),
      fetchUserReportedEntityKeys(reportEntries, session.user.id),
    ]).then(([raisedKeys, reportedKeys]) => {
      if (cancelled) return;
      setRaisedEntryKeys(raisedKeys);
      setReportedEntryKeys(reportedKeys);
    }).catch(() => {
      if (cancelled) return;
      setRaisedEntryKeys(new Set());
      setReportedEntryKeys(new Set());
    });

    return () => {
      cancelled = true;
    };
  }, [discussions, session?.user?.id]);

  // Expose setParentId if needed via callback
  useEffect(() => {
    if (onReplyClick && parentId) {
      onReplyClick(parentId);
      setParentId(null);
    }
  }, [onReplyClick, parentId]);

  function getVisibleReplyCount(group) {
    if (!group?.replies?.length) return 0;
    return expandedReplies[group.id] ?? 0;
  }

  function handleShowMoreReplies(group) {
    setExpandedReplies((current) => ({
      ...current,
      [group.id]: Math.min(group.replies.length, getVisibleReplyCount(group) + DEFAULT_VISIBLE_REPLIES),
    }));
  }

  function handleCollapseReplies(group) {
    setExpandedReplies((current) => ({
      ...current,
      [group.id]: 0,
    }));
  }

  function getEntryLikes(entry) {
    return entryLikeOverrides[getDiscussionRaiseKey(entry.id, entry.sourceTable)] ?? Number(entry.likes ?? 0);
  }

  function isEntryRaised(entry) {
    return raisedEntryKeys.has(getDiscussionRaiseKey(entry.id, entry.sourceTable));
  }

  function isEntryReported(entry) {
    return reportedEntryKeys.has(getDiscussionReportKey(entry));
  }

  function handleRaiseEntry(entry) {
    const submit = async () => {
      const entryKey = getDiscussionRaiseKey(entry.id, entry.sourceTable);
      const nextRaised = !raisedEntryKeys.has(entryKey);
      const previousLikes = getEntryLikes(entry);

      setRaisedEntryKeys((current) => {
        const next = new Set(current);
        if (nextRaised) next.add(entryKey);
        else next.delete(entryKey);
        return next;
      });
      setEntryLikeOverrides((current) => ({
        ...current,
        [entryKey]: nextRaised ? previousLikes + 1 : Math.max(0, previousLikes - 1),
      }));

      const result = await setDiscussionRaise(entry.id, nextRaised, { sourceTable: entry.sourceTable });
      if (result?.error) {
        setRaisedEntryKeys((current) => {
          const next = new Set(current);
          if (nextRaised) next.delete(entryKey);
          else next.add(entryKey);
          return next;
        });
        setEntryLikeOverrides((current) => ({
          ...current,
          [entryKey]: previousLikes,
        }));
        return;
      }

      setEntryLikeOverrides((current) => ({
        ...current,
        [entryKey]: Number(result.data?.likes_count ?? current[entryKey] ?? previousLikes),
      }));
    };

    if (requireAuth) requireAuth(submit, 'Sign in to raise this discussion.');
    else submit();
  }

  if (!post) return null;

  return (
    <div className={styles.container}>
      <div className={styles.cardWrap}>
        <FeedCard 
          post={postWithDiscussionCount} 
          isFullView={true} 
          isDiscussMode={true}
          className={styles.feedCardNoRadius}
        />
      </div>

      <section className={styles.discussSection}>
        <div className={styles.statsRow}>
          <div className={styles.statsLeft}>
            <strong>{topLevelCount} {topLevelCount === 1 ? 'discussion' : 'discussions'}</strong>
          </div>
          <div className={styles.statsRight}>
            <button
              type="button"
              className={`${styles.filterBtn} ${sortMode === 'popular' ? styles.filterBtnActive : ''}`}
              onClick={() => setSortMode('popular')}
            >
              Popular
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${sortMode === 'recent' ? styles.filterBtnActive : ''}`}
              onClick={() => setSortMode('recent')}
            >
              Recent
            </button>
          </div>
        </div>

        <div className={styles.thread}>
          {loading && <DiscussionThreadSkeleton />}
          {!loading && discussionsError && <div className={styles.threadError}>Discussion could not load.</div>}

          {!loading && discussionGroups.map((discussion) => {
            const visibleReplyCount = getVisibleReplyCount(discussion);
            const visibleReplies = discussion.replies.slice(0, visibleReplyCount);
            const hiddenReplyCount = Math.max(0, discussion.replies.length - visibleReplyCount);
            const showMoreCount = Math.min(DEFAULT_VISIBLE_REPLIES, hiddenReplyCount);
            const discussionRaised = isEntryRaised(discussion);
            const discussionLikes = getEntryLikes(discussion);
            const discussionReported = isEntryReported(discussion);

            return (
              <article key={discussion.id} className={styles.discussionCard}>
                <div className={styles.discussionHeader}>
                  <div className={styles.avatar} style={(discussion.author.bg?.startsWith?.('/avatars/') || discussion.author.bg?.startsWith?.('http')) ? { backgroundImage: `url(${discussion.author.bg})` } : { background: discussion.author.bg }}>
                    {!(discussion.author.bg?.startsWith?.('/avatars/') || discussion.author.bg?.startsWith?.('http')) ? discussion.author.initials : null}
                  </div>
                  <div className={styles.discussionHeaderMeta}>
                    <div className={styles.discussionAuthorRow}>
                      <span className={styles.name}>{discussion.author.fullName}</span>
                      {discussion.isAdmin ? <span className={styles.badge}>Admin</span> : null}
                      {discussion.isPinned ? <span className={styles.badgePinned}>Pinned</span> : null}
                    </div>
                    <div className={styles.discussionTime}>{discussion.displayTime}</div>
                  </div>
                </div>

                <div className={styles.discussionBody}>{discussion.body}</div>

                {!!discussion.imageUrl && (
                  isImage(discussion.imageUrl) ? (
                    <a className={styles.mediaAttachment} href={discussion.imageUrl} target="_blank" rel="noreferrer">
                      <img src={discussion.imageUrl} alt="" />
                    </a>
                  ) : isVideo(discussion.imageUrl) ? (
                    <div className={styles.mediaAttachment}>
                      <video src={discussion.imageUrl} controls playsInline preload="metadata" />
                    </div>
                  ) : (
                    <a className={styles.attachment} href={discussion.imageUrl} target="_blank" rel="noreferrer">
                      {discussion.imageUrl}
                    </a>
                  )
                )}

                <div className={styles.discussionFooter}>
                  <span className={styles.replyCountLabel}>{discussion.replies.length} {discussion.replies.length === 1 ? 'reply' : 'replies'}</span>
                  <span className={styles.footerDivider} aria-hidden="true" />
                  <button
                    type="button"
                    className={`${styles.discussionRaiseButton} ${discussionRaised ? styles.discussionRaiseButtonActive : ''}`}
                    onClick={() => handleRaiseEntry(discussion)}
                  >
                    <TrayArrowUp size={15} weight={discussionRaised ? 'fill' : 'regular'} />
                    <span>{formatCount(discussionLikes)}</span>
                  </button>
                  <button type="button" className={styles.actionBtn} onClick={() => setParentId(discussion.id)}>
                    Reply
                  </button>
                  {session?.user?.id !== discussion.userId ? (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setReportEntry(discussion)}
                      disabled={discussionReported}
                    >
                      {discussionReported ? 'Reported' : 'Report'}
                    </button>
                  ) : null}
                </div>

                {visibleReplies.length > 0 ? (
                  <div className={styles.replyList}>
                    {visibleReplies.map((reply) => {
                      const replyRaised = isEntryRaised(reply);
                      const replyLikes = getEntryLikes(reply);
                      const replyReported = isEntryReported(reply);
                      return (
                        <div key={reply.id} className={styles.replyCard}>
                          <div className={styles.replyHeader}>
                            <div className={styles.avatar} style={(reply.author.bg?.startsWith?.('/avatars/') || reply.author.bg?.startsWith?.('http')) ? { backgroundImage: `url(${reply.author.bg})` } : { background: reply.author.bg }}>
                              {!(reply.author.bg?.startsWith?.('/avatars/') || reply.author.bg?.startsWith?.('http')) ? reply.author.initials : null}
                            </div>
                            <div className={styles.replyMeta}>
                              <div className={styles.replyNames}>
                                <span className={styles.replyAuthor}>{reply.author.fullName}</span>
                                {reply.replyTarget ? (
                                  <>
                                    <span className={styles.replyArrow} aria-hidden="true">&gt;</span>
                                    <span className={styles.replyTarget}>{reply.replyTarget}</span>
                                  </>
                                ) : null}
                              </div>
                              <div className={styles.replyTime}>{reply.displayTime}</div>
                            </div>
                          </div>
                          <div className={styles.replyBody}>{reply.body}</div>
                          {!!reply.imageUrl && (
                            isImage(reply.imageUrl) ? (
                              <a className={styles.mediaAttachment} href={reply.imageUrl} target="_blank" rel="noreferrer">
                                <img src={reply.imageUrl} alt="" />
                              </a>
                            ) : isVideo(reply.imageUrl) ? (
                              <div className={styles.mediaAttachment}>
                                <video src={reply.imageUrl} controls playsInline preload="metadata" />
                              </div>
                            ) : (
                              <a className={styles.attachment} href={reply.imageUrl} target="_blank" rel="noreferrer">
                                {reply.imageUrl}
                              </a>
                            )
                          )}
                          <div className={styles.replyFooter}>
                            <button
                              type="button"
                              className={`${styles.discussionRaiseButton} ${replyRaised ? styles.discussionRaiseButtonActive : ''}`}
                              onClick={() => handleRaiseEntry(reply)}
                            >
                              <TrayArrowUp size={15} weight={replyRaised ? 'fill' : 'regular'} />
                              <span>{formatCount(replyLikes)}</span>
                            </button>
                            <button type="button" className={styles.actionBtn} onClick={() => setParentId(reply.id)}>
                              Reply
                            </button>
                            {session?.user?.id !== reply.userId ? (
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => setReportEntry(reply)}
                                disabled={replyReported}
                              >
                                {replyReported ? 'Reported' : 'Report'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {discussion.replies.length > 0 ? (
                  <div className={`${styles.replyToggleRow} ${visibleReplyCount > 0 ? styles.replyToggleRowIndented : ''}`}>
                    {showMoreCount > 0 ? (
                      <button type="button" className={styles.replyToggleBtn} onClick={() => handleShowMoreReplies(discussion)}>
                        {visibleReplyCount > 0
                          ? `Show ${showMoreCount} more ${showMoreCount === 1 ? 'reply' : 'replies'}`
                          : `Show ${showMoreCount} ${showMoreCount === 1 ? 'reply' : 'replies'}`}
                      </button>
                    ) : null}
                    {visibleReplyCount > 0 ? (
                      <button type="button" className={styles.replyToggleBtn} onClick={() => handleCollapseReplies(discussion)}>
                        Collapse replies
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {!loading && !discussionsError && discussions.length === 0 && (
          <div className={`${styles.empty} ${hideComposer ? styles.emptyCompact : ''}`}>
            <span className={styles.emptyBee} role="img" aria-label="Bee">
              🐝
            </span>
            <p>No discussion yet</p>
            <span>Be the first to add useful context for this feedback.</span>
          </div>
        )}
      </section>

      {!hideComposer && (
        <DiscussionComposer 
          postId={post.id} 
          replyingTo={replyingTo} 
          onSent={() => {
            setRefresh(prev => prev + 1);
            setParentId(null);
          }}
          onCancelReply={() => setParentId(null)}
        />
      )}

      {reportEntry ? (
        <DiscussionReportModal
          entry={reportEntry}
          reported={isEntryReported(reportEntry)}
          onClose={() => setReportEntry(null)}
          onReported={(entryId) => {
            const entryType = getDiscussionEntityType(reportEntry);
            setReportedEntryKeys((current) => {
              const next = new Set(current);
              next.add(`${entryType}:${String(entryId)}`);
              return next;
            });
          }}
        />
      ) : null}
    </div>
  );
}

export function DiscussionComposer({ postId, replyingTo, onSent, onCancelReply }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const attachmentsRef = useRef([]);

  const { requireAuth, session } = useAuth() ?? {};
  const remainingAttachments = MAX_ATTACHMENTS - attachments.length;
  const hasInput = input.trim().length > 0 || attachments.length > 0;

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, []);

  // Auto-expand textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      if (!isFocused && !hasInput) {
        textarea.style.height = '44px';
        return;
      }
      textarea.style.height = 'auto';
      const minH = 80; // approx 3 lines + padding
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minH), 225); // max 225px ~ 10 lines
      textarea.style.height = `${newHeight}px`;
    }
  }, [input, isFocused, hasInput]);

  function chooseFiles(files) {
    const incoming = Array.from(files ?? [])
      .filter(file => file.type?.startsWith('image/') || file.type?.startsWith('video/'))
      .slice(0, remainingAttachments)
      .map(makeAttachment);

    if (incoming.length === 0) return;
    setAttachments(prev => [...prev, ...incoming].slice(0, MAX_ATTACHMENTS));
  }

  function removeAttachment(id) {
    setAttachments(prev => {
      const item = prev.find(row => row.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(row => row.id !== id);
    });
  }

  function handleSend() {
    const body = input.trim();
    if ((!body && attachments.length === 0) || sending) return;

    const submit = async () => {
      setSending(true);
      setError('');
      const { data: uploadedUrls, error: uploadError } = await uploadMediaFiles(
        attachments.map(item => item.file),
        { ownerId: session?.user?.id, folder: 'discuss' },
      );

      if (uploadError) {
        setError(uploadError.message ?? 'Unable to upload attachment.');
        setSending(false);
        return;
      }

      const finalBody = body || '';

      const { error: submitError } = await postDiscuss(postId, finalBody, {
        parentId: replyingTo?.id || null,
        imageUrl: uploadedUrls[0] || null,
        userId: session?.user?.id,
      });
      if (submitError) {
        setError(submitError.message ?? 'Unable to post discussion.');
      } else {
        setInput('');
        attachments.forEach(item => URL.revokeObjectURL(item.url));
        setAttachments([]);
        setIsFocused(false);
        onSent?.();
      }
      setSending(false);
    };

    if (requireAuth) requireAuth(submit, 'Sign in to join the discussion.');
    else submit();
  }

  return (
    <div className={styles.composerCard}>
      <div className={styles.composerMain}>
        <Avatar 
          size="lg" 
          name={session?.user?.user_metadata?.username || 'citizen'} 
          src={session?.user?.user_metadata?.avatar}
        />
        <div className={[styles.inputBox, isFocused || hasInput ? styles.inputBoxFocused : ''].join(' ')}>
          <div className={styles.inputRow1}>
            <textarea
              ref={textareaRef}
              className={styles.discussInput}
              placeholder={replyingTo ? `Replying to ${replyingTo.author.fullName}...` : 'Start a discussion'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                if (input.length === 0 && attachments.length === 0) setIsFocused(false);
              }}
            />
            {!isFocused && !hasInput && (
              <div className={styles.inputIconsRight}>
                <button 
                  className={styles.miniIconBtn} 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={18} />
                </button>
                <button className={styles.miniIconBtn} type="button">
                  <At size={18} />
                </button>
              </div>
            )}
          </div>

          {(isFocused || hasInput) && (
            <div className={styles.inputRow2}>
              <div className={styles.row2Left}>
                <button 
                  className={styles.iconBtn} 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={() => setHoveredIcon('media')}
                  onMouseLeave={() => setHoveredIcon(null)}
                >
                  <Paperclip size={18} weight={hoveredIcon === 'media' ? 'duotone' : 'regular'} />
                </button>
                <button 
                  className={styles.iconBtn} 
                  type="button"
                  onMouseEnter={() => setHoveredIcon('mention')}
                  onMouseLeave={() => setHoveredIcon(null)}
                >
                  <At size={18} weight={hoveredIcon === 'mention' ? 'duotone' : 'regular'} />
                </button>
              </div>
              <button
                className={styles.sendBtn}
                disabled={!hasInput || sending}
                onClick={handleSend}
                aria-label="Send"
              >
                <PaperPlaneTilt size={18} weight="fill" />
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            chooseFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      
      {attachments.length > 0 && (
        <div className={styles.attachTray}>
          <div className={styles.attachPreviewGrid}>
            {attachments.map(item => (
              <div key={item.id} className={styles.attachPreview}>
                {item.type === 'video' ? (
                  <video src={item.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={item.url} alt="" />
                )}
                <button type="button" onClick={() => removeAttachment(item.id)} aria-label="Remove">
                  <X size={14} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {replyingTo && (
        <div className={styles.replyBar}>
          <span>Replying to <strong>{replyingTo.author.fullName}</strong></span>
          <button onClick={onCancelReply}><X size={14} weight="bold" /></button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
