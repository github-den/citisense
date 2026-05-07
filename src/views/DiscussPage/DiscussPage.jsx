import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatCircle, PaperPlaneTilt, Paperclip, X, At } from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { postDiscuss } from '@core/services/posts.js';
import { uploadMediaFiles } from '@core/services/media.js';
import { useDiscussions } from '@core/hooks/useDiscussions.js';
import styles from './DiscussPage.module.css';

const MAX_ATTACHMENTS = 5;

function isVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(url ?? ''));
}

function isImage(url) {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(String(url ?? ''));
}

function buildThread(items) {
  const byParent = new Map();
  for (const item of items) {
    const key = item.parentId ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  }

  function walk(parentId = 'root', depth = 0) {
    const nodes = byParent.get(parentId) ?? [];
    return nodes.flatMap((node) => [
      { ...node, depth },
      ...walk(node.id, depth + 1),
    ]);
  }

  return walk();
}

function makeAttachment(file) {
  return {
    id: crypto.randomUUID(),
    file,
    url: URL.createObjectURL(file),
    type: file.type?.startsWith('video/') ? 'video' : 'image',
  };
}

export default function DiscussPage({ post, onBack, hideComposer = false, onReplyClick }) {
  const [refresh, setRefresh] = useState(0);
  const [parentId, setParentId] = useState(null);
  const { discussions, loading, error: discussionsError } = useDiscussions(post?.id, refresh);

  const replyingTo = useMemo(() => {
    if (!parentId) return null;
    return discussions.find(d => d.id === parentId) ?? null;
  }, [discussions, parentId]);

  const threadedDiscussions = useMemo(() => buildThread(discussions), [discussions]);

  useEffect(() => {
    const handleRefresh = () => setRefresh(prev => prev + 1);
    window.addEventListener('citicontrol:refresh-discussions', handleRefresh);
    return () => window.removeEventListener('citicontrol:refresh-discussions', handleRefresh);
  }, []);

  // Expose setParentId if needed via callback
  useEffect(() => {
    if (onReplyClick && parentId) {
      onReplyClick(parentId);
      setParentId(null);
    }
  }, [onReplyClick, parentId]);

  if (!post) return null;

  return (
    <div className={styles.container}>
      <div className={styles.cardWrap}>
        <FeedCard 
          post={post} 
          isFullView={true} 
          isDiscussMode={true}
          className={styles.feedCardNoRadius}
        />
      </div>

      <section className={styles.discussSection}>
        <div className={styles.statsRow}>
          <div className={styles.statsLeft}>
            <strong>{discussions.length} feedbacks</strong>
          </div>
          {discussions.length > 1 && (
            <div className={styles.statsRight}>
              <button className={`${styles.filterBtn} ${styles.filterBtnActive}`}>Popular</button>
              <button className={styles.filterBtn}>Recent</button>
            </div>
          )}
        </div>

        <div className={styles.thread}>
          {loading && <div className={styles.threadLoading}>Loading discussion...</div>}
          {!loading && discussionsError && <div className={styles.threadError}>Discussion could not load.</div>}

          {!loading && threadedDiscussions.map((d) => (
            <div
              key={d.id}
              className={`${styles.item} ${d.parentId ? styles.itemReply : ''}`}
              style={{ '--reply-depth': Math.min(d.depth ?? 0, 4) }}
            >
              <div className={styles.avatar} style={(d.author.bg?.startsWith?.('/avatars/') || d.author.bg?.startsWith?.('http')) ? { backgroundImage: `url(${d.author.bg})` } : { background: d.author.bg }}>
                {!(d.author.bg?.startsWith?.('/avatars/') || d.author.bg?.startsWith?.('http')) ? d.author.initials : null}
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemTop}>
                  <span className={styles.name}>{d.author.fullName}</span>
                  <span className={styles.handle}>{d.author.username}</span>
                  {d.isAdmin && <span className={styles.badge}>Admin</span>}
                  {d.isPinned && <span className={styles.badgePinned}>Pinned</span>}
                  <span className={styles.time}>{d.time}</span>
                </div>
                <div className={styles.bodyText}>{d.body}</div>
                {!!d.imageUrl && (
                  isImage(d.imageUrl) ? (
                    <a className={styles.mediaAttachment} href={d.imageUrl} target="_blank" rel="noreferrer">
                      <img src={d.imageUrl} alt="" />
                    </a>
                  ) : isVideo(d.imageUrl) ? (
                    <div className={styles.mediaAttachment}>
                      <video src={d.imageUrl} controls playsInline preload="metadata" />
                    </div>
                  ) : (
                    <a className={styles.attachment} href={d.imageUrl} target="_blank" rel="noreferrer">
                      {d.imageUrl}
                    </a>
                  )
                )}
                <div className={styles.itemActions}>
                  <button type="button" className={styles.actionBtn} onClick={() => setParentId(d.id)}>
                    Reply
                  </button>
                  {!!d.likes && <span className={styles.likeMeta}>{d.likes} helpful</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && !discussionsError && discussions.length === 0 && (
          <div className={styles.empty}>
            <ChatCircle size={38} weight="duotone" color="var(--text-3)"/>
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

      const extraUrls = uploadedUrls.slice(1);
      const finalBody = [
        body || 'Attached media',
        extraUrls.length > 0 ? `Additional media:\n${extraUrls.join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

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
          multiple
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
