import { useState } from 'react';
import { CaretDown, Hourglass, SealCheck, WarningCircle, XCircle } from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import { useFeed } from '@core/hooks/useFeed.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './TrackPage.module.css';

const EMPTY = {
  underreview: {
    Icon:  Hourglass,
    title: 'No feedback under review.',
    sub:   'Feedback awaiting official action will appear here.',
  },
  verified: {
    Icon:  SealCheck,
    title: 'No verified feedback.',
    sub:   'Feedback that has been reviewed and acknowledged will appear here.',
  },
  notaccepted: {
    Icon:  XCircle,
    title: 'No feedback here.',
    sub:   'Dismissed, invalid, and closed feedback will appear here.',
  },
};

const VERIFIED_OPTIONS     = ['All', 'In Progress', 'On hold', 'Resolved'];
const NOT_ACCEPTED_OPTIONS = ['Dismissed'];

function getStatuses(activeTab, verifiedSub, notAcceptedSub) {
  if (activeTab === 'underreview') return ['under_review'];
  if (activeTab === 'verified') {
    return verifiedSub === 'All'
      ? ['in_progress', 'on_hold', 'resolved']
      : [verifiedSub.toLowerCase().replace(/ /g, '_')];
  }
  if (activeTab === 'notaccepted') return ['dismissed'];
  return [];
}

export default function TrackPage() {
  const [activeTab,      setActiveTab]      = useState('underreview');
  const [verifiedSub,    setVerifiedSub]    = useState('All');
  const [notAcceptedSub, setNotAcceptedSub] = useState('All');
  const { session } = useAuth();

  // Same pattern as ProfilePage: tab='activity' + currentUserId
  // Guards against fetching all posts when session hasn't loaded yet
  const { posts, loading, error } = useFeed({
    tab: 'activity',
    currentUserId: session?.user?.id,
  });

  const statuses = getStatuses(activeTab, verifiedSub, notAcceptedSub);

  // Use raw DB status (p.raw?.status) so that 'Invalid' and 'Closed' aren't
  // collapsed into 'Dismissed' by normalizeStatus in postMapper
  const filtered = session
    ? posts.filter(p => statuses.includes(p.raw?.status ?? p.status))
    : [];

  return (
    <div>
      <div className={styles.stickyBar}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Track</h1>
          <span className={styles.titleSep}>/</span>
          <span className={styles.titleSub}>Check the status of your submitted feedback</span>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'underreview'}
            className={`${styles.tabBtn} ${activeTab === 'underreview' ? styles.active : ''}`}
            onClick={() => setActiveTab('underreview')}
          >
            <span className={styles.tabLabel}>Under Review</span>
          </button>

          <div className={styles.dropTab}>
            <button
              role="tab"
              aria-selected={activeTab === 'verified'}
              className={`${styles.tabBtn} ${activeTab === 'verified' ? styles.active : ''}`}
              onClick={() => setActiveTab('verified')}
            >
              <span className={styles.tabLabel}>
                Verified
                {activeTab === 'verified' && verifiedSub !== 'All' && (
                  <span className={styles.subBadge}>{verifiedSub}</span>
                )}
              </span>
              <CaretDown size={13} weight="bold" className={styles.caret} />
            </button>
            <div className={styles.dropdown}>
              {VERIFIED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  className={`${styles.dropItem} ${verifiedSub === opt ? styles.dropActive : ''}`}
                  onClick={() => { setVerifiedSub(opt); setActiveTab('verified'); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.dropTab}>
            <button
              role="tab"
              aria-selected={activeTab === 'notaccepted'}
              className={`${styles.tabBtn} ${activeTab === 'notaccepted' ? styles.active : ''}`}
              onClick={() => setActiveTab('notaccepted')}
            >
              <span className={styles.tabLabel}>
                Not Accepted
                {activeTab === 'notaccepted' && notAcceptedSub !== 'All' && (
                  <span className={styles.subBadge}>{notAcceptedSub}</span>
                )}
              </span>
              <CaretDown size={13} weight="bold" className={styles.caret} />
            </button>
            <div className={styles.dropdown}>
              {NOT_ACCEPTED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  className={`${styles.dropItem} ${notAcceptedSub === opt ? styles.dropActive : ''}`}
                  onClick={() => { setNotAcceptedSub(opt); setActiveTab('notaccepted'); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <>
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </>
      )}

      {!loading && error && (
        <div className={styles.empty}>
          <WarningCircle size={44} weight="duotone" color="var(--amber)" />
          <p>Status board could not load.</p>
          <span>Please check your connection or try again in a moment.</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (() => {
        const { Icon, title, sub } = EMPTY[activeTab];
        return (
          <div className={styles.empty}>
            <Icon size={44} weight="duotone" color="var(--text-3)" />
            <p>{title}</p>
            <span>{sub}</span>
          </div>
        );
      })()}

      {!loading && !error && filtered.map((post) => (
        <div key={post.id} className={styles.postRow}>
          <FeedCard post={post} />
        </div>
      ))}
    </div>
  );
}
