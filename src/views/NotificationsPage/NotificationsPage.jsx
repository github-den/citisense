import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowFatUp,
  Bell,
  BellSimpleSlash,
  ChatCircle,
  CheckCircle,
  Megaphone,
} from '@phosphor-icons/react';
import PageSectionHeader from '../../components/ui/PageSectionHeader.jsx';
import { notificationItems } from '../../data/notifications.js';
import styles from './NotificationsPage.module.css';

const FILTERS = ['All', 'Raises', 'Replies', 'System'];

const TYPE_META = {
  Raises:  { Icon: ArrowFatUp, color: 'var(--green)',  bg: 'rgba(22,163,74,0.10)'   },
  Replies: { Icon: ChatCircle, color: 'var(--brand)',  bg: 'rgba(37,99,235,0.10)'   },
  System:  { Icon: Megaphone,  color: 'var(--yellow)', bg: 'rgba(217,119,6,0.10)'   },
};

function NotificationRow({ item, onClick }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.System;
  return (
    <button
      type="button"
      className={[styles.row, item.unread ? styles.rowUnread : ''].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <span className={styles.rowIcon} style={{ background: meta.bg, color: meta.color }}>
        <meta.Icon size={18} weight="fill" />
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowMessage}>
          <strong>{item.actor}</strong> {item.message}
        </div>
        <div className={styles.rowTime}>{item.time}</div>
      </div>
      {item.unread && <span className={styles.unreadDot} />}
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [filter,  setFilter]  = useState('All');
  const [readIds, setReadIds] = useState(() => new Set());

  const notifications = useMemo(() =>
    notificationItems
      .filter(item => filter === 'All' || item.type === filter)
      .map(item => ({ ...item, unread: item.unread && !readIds.has(item.id) })),
  [filter, readIds]);

  const groups = useMemo(() =>
    notifications.reduce((acc, item) => {
      acc[item.bucket] ??= [];
      acc[item.bucket].push(item);
      return acc;
    }, {}),
  [notifications]);

  const hasUnread = notifications.some(item => item.unread);

  function markAllRead() {
    setReadIds(new Set(notificationItems.map(i => i.id)));
  }

  function openItem(item) {
    setReadIds(prev => new Set(prev).add(item.id));
    if (item.page) {
      window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
      router.push(`/${item.page}`);
    }
  }

  return (
    <div className={styles.page}>

      {/* ── INTRO HEADER (mirrors FeedboxPage) ─────────────────────── */}
      <div className={styles.introOuter}>
        <div className={styles.introInner}>
          <PageSectionHeader
            className={styles.tightHeader}
            icon={Bell}
            title={(
              <div className={styles.inlineHeader}>
                <span>Notifications</span>
                <span className={styles.headerSep}>|</span>
                <span className={styles.headerSub}>Raises, replies, and system messages.</span>
              </div>
            )}
            subtitle={(
              <div className={styles.filterBar}>
                {/* Filter chips */}
                <div className={styles.filterChips}>
                  {FILTERS.map(f => (
                    <button
                      key={f}
                      type="button"
                      className={[styles.chip, filter === f ? styles.chipActive : ''].filter(Boolean).join(' ')}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Mark all read */}
                <button
                  type="button"
                  className={styles.markAllBtn}
                  disabled={!hasUnread}
                  onClick={markAllRead}
                >
                  <CheckCircle size={15} weight="fill" />
                  Mark all as read
                </button>
              </div>
            )}
          />
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <div className={styles.mainSection}>
        {notifications.length === 0 ? (
          <div className={styles.empty}>
            <BellSimpleSlash size={44} weight="duotone" color="var(--text-3)" />
            <p>You're all caught up.</p>
            <span>New updates on your feedback and discussions will appear here.</span>
          </div>
        ) : (
          Object.entries(groups).map(([bucket, items]) => (
            <section key={bucket} className={styles.group}>
              <div className={styles.bucketLabel}>{bucket}</div>
              <div className={styles.groupList}>
                {items.map(item => (
                  <NotificationRow key={item.id} item={item} onClick={() => openItem(item)} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      
    </div>
  );
}

