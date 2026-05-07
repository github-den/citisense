import { Buildings, MapPin, MapPinArea, ShieldStar, Users } from '@phosphor-icons/react';
import { URDANETA_BARANGAYS } from '../../constants/index.js';
import styles from './RightAside.module.css';

const CITY_FACTS = [
  { label: 'Location', value: '5th District, Pangasinan' },
  { label: 'Founded', value: 'January 8, 1858' },
  { label: 'Cityhood', value: 'March 21, 1998' },
  { label: 'Barangays', value: String(URDANETA_BARANGAYS.length) },
];

const CITY_LEADERS = [
  { label: 'Mayor', value: 'Julio F. Parayno III' },
  { label: 'Vice Mayor', value: 'Jimmy D. Parayno' },
];

export default function CitiMoodAside() {
  return (
    <section className={styles.cityProfileCard}>
      <div className={styles.cityProfileGlow} aria-hidden />

      <div className={styles.cityProfileTop}>
        <div className={styles.cityProfileBadge}>
          <Buildings size={18} weight="duotone" />
          <span>Your City</span>
        </div>
        <div className={styles.cityProfileIcon}>
          <MapPinArea size={22} weight="duotone" />
        </div>
      </div>

      <div className={styles.cityProfileHeader}>
        <h3>Urdaneta City</h3>
        <p>
          A component city in Pangasinan and a regional bagsakan hub, with civic activity shaped by service access,
          mobility, and barangay-level concerns.
        </p>
      </div>

      <div className={styles.cityFactGrid}>
        {CITY_FACTS.map((item, index) => (
          <div key={item.label} className={styles.cityFactCard}>
            <span className={styles.cityFactLabel}>{item.label}</span>
            <strong>{item.value}</strong>
            <span className={styles.cityFactIcon} aria-hidden>
              {index === 0 && <MapPin size={14} weight="fill" />}
              {index === 1 && <ShieldStar size={14} weight="fill" />}
              {index === 2 && <Buildings size={14} weight="fill" />}
              {index === 3 && <MapPinArea size={14} weight="fill" />}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.citySection}>
        <div className={styles.citySectionTitle}>
          <Users size={15} weight="duotone" color="var(--brand)" />
          <span>City leadership</span>
        </div>
        <div className={styles.cityLeaderList}>
          {CITY_LEADERS.map((leader) => (
            <div key={leader.label} className={styles.cityLeaderRow}>
              <span>{leader.label}</span>
              <strong>{leader.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.citySection}>
        <div className={styles.citySectionTitle}>
          <MapPinArea size={15} weight="duotone" color="var(--brand)" />
          <span>Barangays</span>
        </div>
        <div className={styles.cityChipWrap}>
          {URDANETA_BARANGAYS.map((barangay) => (
            <span key={barangay} className={styles.cityChip}>
              {barangay}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
