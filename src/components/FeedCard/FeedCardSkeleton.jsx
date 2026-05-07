'use client';

import React from 'react';
import styles from './FeedCardSkeleton.module.css';

export default function FeedCardSkeleton({ className }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} aria-hidden="true">
      <div className={styles.header}>
        <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '999px', flexShrink: 0 }} />
        <div className={styles.headerInfo}>
          <div className="skeleton" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '180px', height: '10px', borderRadius: '4px' }} />
        </div>
      </div>
      
      <div className={styles.caption}>
        <div className="skeleton" style={{ height: '12px', width: '100%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '12px', width: '100%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '4px' }} />
      </div>
      
      <div className="skeleton" style={{ width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-md)' }} />
      
      <div className={styles.actions}>
        <div className="skeleton" style={{ width: '70px', height: '24px', borderRadius: '999px' }} />
        <div className="skeleton" style={{ width: '70px', height: '24px', borderRadius: '999px' }} />
        <div className="skeleton" style={{ width: '70px', height: '24px', borderRadius: '999px' }} />
      </div>
    </div>
  );
}
