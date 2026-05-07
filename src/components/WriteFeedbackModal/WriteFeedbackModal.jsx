'use client';

import { useEffect, useRef } from 'react';
import FeedbackComposerPage from '../FeedbackComposerPage/FeedbackComposerPage.jsx';
import styles from './WriteFeedbackModal.module.css';

export default function WriteFeedbackModal({ open, onClose }) {
  const overlayRef = useRef(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Write feedback"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={styles.modal}>
        <FeedbackComposerPage
          mode="create"
          setPage={(nextPage) => {
            if (nextPage === 'feed' || nextPage === 'back') {
              onClose();
            }
          }}
        />
      </div>
    </div>
  );
}
