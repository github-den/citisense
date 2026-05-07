import { ClipboardText, Info, Warning } from '@phosphor-icons/react';
import styles from './RightAside.module.css';

export default function HelpAside({ setPage, setSearchQuery }) {
  function runSearch(value) {
    const query = String(value ?? '').trim();
    if (!query) return;
    setSearchQuery(query);
    setPage('search');
  }

  return (
    <div className={styles.widget}>
      <div className={styles.widgetTitle}>
        <Info size={16} weight="fill" color="var(--brand)" /> Quick support
      </div>
      <div className={styles.quickList}>
        <button onClick={() => runSearch('how to track feedback')} type="button">
          <ClipboardText size={15} /> How tracking works
        </button>
        <button onClick={() => runSearch('what feedback is allowed')} type="button">
          <Warning size={15} /> What can be reported
        </button>
      </div>
    </div>
  );
}
