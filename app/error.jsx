'use client';

import { useEffect } from 'react';
import styles from './error.module.css';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className={styles.errorPage}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>⚠️</div>
        <h1 className={styles.errorTitle}>Something went wrong</h1>
        <p className={styles.errorMessage}>
          We encountered an unexpected error. Please try refreshing the page or contact support if the
          problem persists.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className={styles.errorDetails}>
            <summary>Error details</summary>
            <pre className={styles.errorStack}>{error?.message}</pre>
          </details>
        )}
        <button onClick={reset} className={styles.resetButton}>
          Try again
        </button>
      </div>
    </div>
  );
}
