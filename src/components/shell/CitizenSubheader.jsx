'use client';

import Tabs from '../ui/Tabs.jsx';
import styles from '../../App.module.css';

export default function CitizenSubheader({ items, value, onChange }) {
  return (
    <div className={styles.subheaderBar} data-mobile-only="true">
      <div className={styles.subheaderInner}>
        <Tabs items={items} value={value} onChange={onChange} className={styles.subheaderTabs} />
      </div>
    </div>
  );
}
