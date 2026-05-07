import { ShieldCheck } from '@phosphor-icons/react';
import { DEFAULT_SETUP_HINTS, safeList } from './shared.jsx';
import styles from './RightAside.module.css';

export default function SetupAside({ setupDraft }) {
  const setupChecks = safeList(setupDraft?.checks)
    .filter((row) => row?.label === 'Display name' || row?.label === 'Username');
  const setupHints = safeList(setupDraft?.hints).length > 0 ? safeList(setupDraft?.hints) : DEFAULT_SETUP_HINTS;

  return (
    <div className={styles.widget}>
      <div className={styles.widgetTitle}>
        <ShieldCheck size={16} weight="fill" color="var(--brand)" /> Setup checks
      </div>
      <div className={styles.setupList}>
        {setupChecks.length === 0 && <div className={styles.setupHint}>Start typing to see validation.</div>}
        {setupChecks.map((row) => (
          <div key={row.label} className={`${styles.setupItem} ${row.ok ? styles.setupOk : styles.setupBad}`}>
            <span className={styles.setupDot} aria-hidden />
            <div>
              <div className={styles.setupLabel}>{row.label}</div>
              {row.detail && <div className={styles.setupDetail}>{row.detail}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.setupHints}>
        <div className={styles.setupHintTitle}>
          <ShieldCheck size={15} weight="fill" color="var(--text-3)" /> Reminder
        </div>
        <ul className={styles.reminderList}>
          {setupHints.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </div>
    </div>
  );
}
