import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  MagnifyingGlass, 
  MapPin, 
  Clock, 
  CheckCircle, 
  WarningCircle, 
  CaretDown,
  CaretRight,
  GpsFix,
  CirclesThreePlus
} from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import { useProfile } from '@core/hooks/useProfile.js';
import { useFeed } from '@core/hooks/useFeed.js';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import styles from './TrackFeedbackPage.module.css';

const STATUS_GROUPS = [
  { id: 'under_review', label: 'Under Review', icon: Clock,        status: 'under_review' },
  {
    id: 'verified',
    label: 'Verified',
    icon: CheckCircle,
    subStatuses: [
      { id: 'in_progress', label: 'In Progress', status: 'in_progress' },
      { id: 'on_hold',     label: 'On Hold',     status: 'on_hold'     },
      { id: 'resolved',    label: 'Completed',   status: 'resolved'    },
    ],
  },
  { id: 'dismissed', label: 'Dismissed', icon: WarningCircle, status: 'dismissed' },
];

// Human-readable label for empty state
const STATUS_LABEL = {
  under_review: 'Under Review',
  in_progress:  'In Progress',
  on_hold:      'On Hold',
  resolved:     'Resolved',
  dismissed:    'Dismissed',
};

export default function TrackFeedbackPage({ onReady }) {
  const { session } = useAuth();
  const { profile } = useProfile(session?.user?.id);
  const [activeStatus, setActiveStatus] = useState('under_review');
  const [expandedGroups, setExpandedGroups] = useState(['verified']);

  // Fetch all the current user's posts (no status filter — avoids post_status enum mismatch)
  // Uses the same pattern as ProfilePage so the guard fires correctly before session loads
  const { posts, loading, loadingMore, hasMore, loadMore, error } = useFeed({
    tab: 'activity',
    currentUserId: session?.user?.id,
    currentBarangay: profile?.barangay,
  });

  // Client-side status filter — null status (pre-migration rows) defaults to 'under_review'
  const filteredPosts = posts.filter(p => {
    const rawStatus = p.raw?.status ?? 'under_review';
    return rawStatus === activeStatus;
  });

  const observer = useRef();
  const triggerRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMore]);

  useEffect(() => {
    if (!loading) onReady?.();
  }, [loading, onReady]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className={styles.trackContainer}>
      {/* LEFT ASIDE */}
      <aside className={styles.leftAside}>
        <div className={styles.leftAsideContent}>
          <div className={styles.asideIntro}>
            <div className={styles.asideHeader}>
              <div className={styles.iconWrap}>
                <GpsFix size={20} weight="fill" />
              </div>
              <h1>Track</h1>
            </div>
            <p className={styles.asideSubtitle}>
              Your civic progress in real-time.
            </p>
          </div>

          <nav className={styles.statusNav}>
            <div className={styles.navList}>
              {STATUS_GROUPS.map((group) => {
                const isExpanded = expandedGroups.includes(group.id);
                const hasSub = !!group.subStatuses;
                const isActive = activeStatus === group.status || (hasSub && group.subStatuses.some(s => s.status === activeStatus));

                return (
                  <div key={group.id} className={styles.navGroup}>
                    <button 
                      className={`
                        ${styles.navItem} 
                        ${isActive ? styles.navItemActive : ''} 
                        ${styles['status_' + group.id]}
                      `}
                      onClick={() => {
                        if (hasSub) toggleGroup(group.id);
                        else setActiveStatus(group.status);
                      }}
                    >
                      <div className={styles.navItemContent}>
                        <group.icon 
                          size={20} 
                          weight={isActive ? "duotone" : "regular"} 
                        />
                        <span>{group.label}</span>
                      </div>
                      {hasSub && (
                        isExpanded ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />
                      )}
                    </button>

                    {hasSub && isExpanded && (
                      <div className={styles.subList}>
                        {group.subStatuses.map(sub => {
                          const isSubActive = activeStatus === sub.status;
                          return (
                            <button
                              key={sub.id}
                              className={`
                                ${styles.subItem} 
                                ${isSubActive ? styles.subItemActive : ''}
                                ${styles['sub_' + sub.id]}
                              `}
                              onClick={() => setActiveStatus(sub.status)}
                            >
                              <div className={styles.dot} />
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </nav>
        </div>
      </aside>

      {/* RIGHT CONTENT (FEED) */}
      <main className={styles.feedContent}>
          {loading && posts.length === 0 && (
            <div className={styles.skeletons}>
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </div>
          )}

          {!loading && filteredPosts.length === 0 && (
            <div className={styles.zeroState}>
              <h3 className={styles.zeroTitle}>
                {activeStatus === 'under_review'
                  ? 'No feedbacks under review'
                  : `No ${STATUS_LABEL[activeStatus] ?? activeStatus} feedbacks`}
              </h3>
              <p className={styles.zeroText}>Try selecting another status or check back later.</p>
            </div>
          )}

          {filteredPosts.map((post, index) => {
            const isTrigger = index === posts.length - 5;
            return (
              <FeedCard 
                key={post.id} 
                post={post} 
                ref={isTrigger ? triggerRef : undefined}
              />
            );
          })}

          {loadingMore && (
            <div className={styles.loadingMore}>
              <FeedCardSkeleton />
            </div>
          )}
      </main>
    </div>
  );
}
