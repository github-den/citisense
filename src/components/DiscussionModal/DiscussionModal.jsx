'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from '@phosphor-icons/react';
import DiscussPage, { DiscussionComposer } from '../../views/DiscussPage/DiscussPage.jsx';
import { useDiscussions } from '@core/hooks/useDiscussions.js';
import { lockPageScroll } from '@core/utils/lockPageScroll.js';
import styles from './DiscussionModal.module.css';

export default function DiscussionModal({ post, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [parentId, setParentId] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const { discussions } = useDiscussions(post?.id, refresh);
  const replyingTo = useMemo(() => {
    if (!parentId) return null;
    return discussions.find(d => d.id === parentId) ?? null;
  }, [discussions, parentId]);

  useEffect(() => {
    if (post) {
      // Small delay to ensure the DOM is ready for the transition
      const timer = setTimeout(() => setIsVisible(true), 10);
      const unlockPageScroll = lockPageScroll();
      return () => {
        clearTimeout(timer);
        unlockPageScroll();
      };
    }
    setIsVisible(false);
  }, [post]);

  if (!post) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Match transition duration
  };

  return (
    <div 
      className={[styles.overlay, isVisible ? styles.overlayVisible : ''].join(' ')} 
      onMouseDown={handleClose}
    >
      <div 
        className={[styles.modal, isVisible ? styles.modalVisible : ''].join(' ')} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{post?.user}'s feedback</h2>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close discussion">
            <X size={20} weight="bold" />
          </button>
        </header>
        <div className={styles.content}>
          <DiscussPage 
            post={post} 
            onBack={handleClose} 
            hideComposer 
            onReplyClick={(id) => setParentId(id)}
          />
        </div>
        <footer className={styles.footer}>
          <DiscussionComposer 
            postId={post.id}
            replyingTo={replyingTo}
            onSent={() => {
              setRefresh(prev => prev + 1);
              setParentId(null);
              // Trigger a refresh event for DiscussPage if needed
              window.dispatchEvent(new CustomEvent('citicontrol:refresh-discussions'));
            }}
            onCancelReply={() => setParentId(null)}
          />
        </footer>
      </div>
    </div>
  );
}
