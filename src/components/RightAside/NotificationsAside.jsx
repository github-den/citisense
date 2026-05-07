import { Bell } from '@phosphor-icons/react';
import styles from './RightAside.module.css';

export default function NotificationsAside() {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetTitle}>
        <Bell size={16} weight="fill" color="var(--brand)" /> Tip
      </div>
      <ul className={styles.reminderList}>
        <li>Watch for status updates on your submitted feedback.</li>
        <li>Open discussions to add missing context.</li>
        <li>Remove noise by clearing resolved items.</li>
      </ul>
    </div>
  );
}
