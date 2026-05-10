import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowFatUp,
  Bell,
  CaretDown,
  ChatCircle,
  Heart,
  Megaphone,
  RadioButton,
  SquaresFour,
} from '@phosphor-icons/react';
import styles from './NotificationsPage.module.css';
import Popover from '../../components/ui/Popover.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { useNotifications } from '@core/hooks/useNotifications.js';
import shellStyles from '../CitizenDataPage.module.css';

const TYPE_META = {
  Raises: { Icon: ArrowFatUp, color: 'var(--green)', bg: 'rgba(22,163,74,0.10)' },
  Replies: { Icon: ChatCircle, color: 'var(--brand)', bg: 'rgba(37,99,235,0.10)' },
  React: { Icon: Heart, color: 'var(--red)', bg: 'rgba(244,63,94,0.10)' },
  System: { Icon: Megaphone, color: 'var(--yellow)', bg: 'rgba(217,119,6,0.10)' },
};

const READ_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'read', label: 'Read' },
  { key: 'unread', label: 'Unread' },
];

const TYPE_FILTERS = [
  { key: 'all', label: 'All', matches: null },
  { key: 'raises', label: 'Raises', matches: ['Raises'] },
  { key: 'react', label: 'Reacts', matches: ['React'] },
  { key: 'discussion', label: 'Discussions', matches: ['Replies'] },
];

function FilterSelect({ icon: Icon, label, valueLabel, options, value, onChange, active = false }) {
  const [open, setOpen] = useState(false);
  const triggerLabel = value === 'all' ? `${valueLabel} ${label.toLowerCase()}` : valueLabel;

  return (
    <Popover
      align="start"
      open={open}
      onOpenChange={setOpen}
      className={styles.filterPopover}
      panelClassName={styles.filterPanel}
      trigger={(
        <button
          type="button"
          className={[styles.filterTrigger, active ? styles.filterTriggerActive : ''].filter(Boolean).join(' ')}
        >
          <span className={styles.navItemContent}>
            <span className={styles.filterLeading}>
              <span className={styles.filterIconWrap}>
                <Icon size={18} weight={active || open ? 'fill' : 'regular'} />
              </span>
              <span className={styles.filterTitle}>{triggerLabel}</span>
            </span>
            <CaretDown size={16} weight="bold" className={styles.filterCaret} />
          </span>
        </button>
      )}
    >
      <div className={styles.filterOptions}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={[styles.filterOption, value === option.key ? styles.filterOptionActive : ''].filter(Boolean).join(' ')}
            onClick={() => {
              onChange(option.key);
              setOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}

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
        <div className={styles.rowMeta}>
          <span className={styles.rowTag}>{item.type === 'Replies' ? 'Discussion' : item.type}</span>
          <span className={styles.rowTime}>{item.time}</span>
        </div>
      </div>
      {item.unread ? <span className={styles.unreadDot} /> : null}
    </button>
  );
}

function getEmptyCopy(readFilter, typeFilter) {
  if (readFilter === 'unread' && typeFilter === 'discussion') {
    return {
      title: 'No unread discussion notifications.',
      sub: 'Replies to your feedback and discussion threads will appear here.',
    };
  }
  if (readFilter === 'unread' && typeFilter === 'raises') {
    return {
      title: 'No unread raise notifications.',
      sub: 'New raise activity on your feedback will appear here.',
    };
  }
  if (readFilter === 'unread' && typeFilter === 'react') {
    return {
      title: 'No unread react notifications.',
      sub: 'New reactions to your feedback will appear here.',
    };
  }
  if (readFilter === 'unread') {
    return {
      title: 'No unread notifications.',
      sub: 'You are all caught up for now.',
    };
  }
  if (readFilter === 'read' && typeFilter === 'discussion') {
    return {
      title: 'No read discussion notifications.',
      sub: 'Discussion notifications you have already opened will appear here.',
    };
  }
  if (readFilter === 'read' && typeFilter === 'raises') {
    return {
      title: 'No read raise notifications.',
      sub: 'Raise notifications you have already opened will appear here.',
    };
  }
  if (readFilter === 'read' && typeFilter === 'react') {
    return {
      title: 'No read react notifications.',
      sub: 'Reaction notifications you have already opened will appear here.',
    };
  }
  if (readFilter === 'read') {
    return {
      title: 'No read notifications.',
      sub: 'Notifications you have already opened will appear here.',
    };
  }
  if (typeFilter === 'discussion') {
    return {
      title: 'No discussion notifications yet.',
      sub: 'Replies to your feedback and threads will appear here.',
    };
  }
  if (typeFilter === 'raises') {
    return {
      title: 'No raise notifications yet.',
      sub: 'Raise activity on your feedback will appear here.',
    };
  }
  if (typeFilter === 'react') {
    return {
      title: 'No react notifications yet.',
      sub: 'Reactions to your feedback will appear here.',
    };
  }
  return {
    title: "You're all caught up.",
    sub: 'New updates on your feedback and discussions will appear here.',
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [readFilter, setReadFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { notifications, markRead } = useNotifications({ userId: session?.user?.id, limit: 120 });

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (readFilter === 'unread' && !item.unread) return false;
      if (readFilter === 'read' && item.unread) return false;
      if (typeFilter === 'all') return true;

      const filterConfig = TYPE_FILTERS.find(entry => entry.key === typeFilter);
      if (!filterConfig?.matches) return true;
      return filterConfig.matches.includes(item.type);
    });
  }, [notifications, readFilter, typeFilter]);

  const groups = useMemo(
    () => filteredNotifications.reduce((acc, item) => {
      acc[item.bucket] ??= [];
      acc[item.bucket].push(item);
      return acc;
    }, {}),
    [filteredNotifications],
  );

  const emptyCopy = getEmptyCopy(readFilter, typeFilter);
  const selectedStatus = READ_FILTERS.find(item => item.key === readFilter)?.label ?? 'All';
  const selectedActivity = TYPE_FILTERS.find(item => item.key === typeFilter)?.label ?? 'All';

  function openItem(item) {
    if (item?.id) markRead(item.id);
    if (item.page) {
      window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
      router.push(`/${item.page}`);
    }
  }

  return (
    <div className={styles.notificationsContainer}>
      <aside className={styles.leftAside}>
        <div className={styles.leftAsideContent}>
          <div className={styles.asideSection}>
            <div className={styles.sidebarTitleRow}>
              <div className={styles.iconWrap}>
                <Bell size={20} weight="fill" />
              </div>
              <h1 className={styles.sidebarTitle}>Notifications</h1>
            </div>
            <p className={styles.sidebarSubtitle}>Updates related to your feedback.</p>
          </div>

          <div className={styles.asideSection}>
            <div className={styles.filterStack}>
              <FilterSelect
                icon={RadioButton}
                label="Status"
                valueLabel={selectedStatus}
                options={READ_FILTERS}
                value={readFilter}
                onChange={setReadFilter}
                active={readFilter !== 'all'}
              />
              <FilterSelect
                icon={SquaresFour}
                label="Activity"
                valueLabel={selectedActivity}
                options={TYPE_FILTERS}
                value={typeFilter}
                onChange={setTypeFilter}
                active={typeFilter !== 'all'}
              />
            </div>
          </div>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {filteredNotifications.length === 0 ? (
          <div className={styles.zeroWrap}>
            <div className={shellStyles.zeroState}>
              <p className={shellStyles.zeroTitle}>{emptyCopy.title}</p>
              <span className={shellStyles.zeroText}>{emptyCopy.sub}</span>
            </div>
          </div>
        ) : (
          Object.entries(groups).map(([bucket, items]) => (
            <section key={bucket} className={styles.group}>
              <div className={styles.bucketLabel}>{bucket}</div>
              <div className={styles.groupList}>
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onClick={() => openItem(item)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
