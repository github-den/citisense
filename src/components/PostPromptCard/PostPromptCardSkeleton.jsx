'use client';

import React from 'react';
import styles from './PostPromptCardSkeleton.module.css';
import skeletonStyles from '../../styles/skeleton.css'; // This won't work directly as an import in CSS modules if not configured, but I'll use class names

export default function PostPromptCardSkeleton({ className }) {
  // We'll use a global 'skeleton' class or inline the shimmer
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} aria-hidden="true">
      <div className={styles.top}>
        <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '999px', flexShrink: 0 }} />
        <div className="skeleton" style={{ flex: 1, height: '44px', borderRadius: '22px' }} />
        <div className={styles.actions}>
          <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '999px' }} />
          <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '999px' }} />
        </div>
      </div>
    </div>
  );
}
