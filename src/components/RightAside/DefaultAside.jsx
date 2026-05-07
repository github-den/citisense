import { MapPinArea } from '@phosphor-icons/react';
import styles from './RightAside.module.css';

export default function DefaultAside() {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetTitle}>
        <MapPinArea size={16} weight="fill" color="var(--brand)" /> Local context
      </div>
      <div className={styles.areaCard}>
        <MapPinArea size={20} weight="fill" color="var(--brand)" />
        <div>
          <div className={styles.areaName}>Urdaneta City</div>
          <div className={styles.areaSub}>Civic signals and public service feedback</div>
        </div>
      </div>
    </div>
  );
}
