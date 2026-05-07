import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.notFoundPage}>
      <div className={styles.notFoundContent}>
        <div className={styles.notFoundIcon}>🔍</div>
        <h1 className={styles.notFoundTitle}>Page not found</h1>
        <p className={styles.notFoundMessage}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className={styles.homeButton}>
          Go to home
        </Link>
      </div>
    </div>
  );
}
