'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  UserCircle, 
  WarningCircle, 
  RowsPlusTop,
  SignOut,
  ClockCountdown,
  BookmarkSimple,
  FileDashed,
  GearSix,
  Question,
  UserPlus,
  Prohibit,
  CheckCircle,
} from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import { useFeed } from '@core/hooks/useFeed.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import { supabase } from '@core/lib/supabase.js';
import { followUser, unfollowUser } from '@core/services/posts.js';
import styles from './PublicProfilePage.module.css';

export default function PublicProfilePage() {
  const { username } = useParams();
  const { session, requireAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [isHoveringFollowing, setIsHoveringFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const normalizedUsername = String(username ?? '').replace(/^@/, '').toLowerCase();
  const isCurrentUser = session?.user?.id === profile?.id;

  const { posts, loading: postsLoading, error: postsError } = useFeed({ 
    userId: profile?.id,
    currentUserId: session?.user?.id
  });

  function gate(action, message) {
    if (requireAuth) requireAuth(action, message);
    else action();
  }

  async function toggleFollow() {
    gate(async () => {
      const next = !following;
      setFollowing(next);
      const result = next ? await followUser(profile.id) : await unfollowUser(profile.id);
      if (result?.error) setFollowing(!next);
    }, 'Sign in to follow this citizen.');
  }

  async function toggleBlock() {
    gate(async () => {
      const next = !isBlocked;
      setIsBlocked(next);
      // Backend implementation for block would go here
    }, 'Sign in to block this citizen.');
  }

  useEffect(() => {
    let mounted = true;
    if (!supabase || !normalizedUsername) return undefined;

    setProfileLoading(true);
    supabase
      .from('profiles')
      .select('id, username, avatar, created_at, following_count, followers_count, raises_count, resolved_count')
      .eq('username', normalizedUsername)
      .maybeSingle()
      .then(async ({ data }) => {
        if (mounted && data) {
          setProfile(data);
          
          // Check following status
          if (session?.user?.id) {
            const { data: followData } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', session.user.id)
              .eq('following_id', data.id)
              .maybeSingle();
            if (mounted) setFollowing(!!followData);
          }
          
          setProfileLoading(false);
        } else if (mounted) {
          setProfileLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [normalizedUsername, session]);

  const resolvedPosts = useMemo(
    () => posts.filter((post) => ['Resolved', 'Closed'].includes(post.status)),
    [posts],
  );

  const avatarBg = profile?.avatar ?? '/avatars/avatar_1.png';
  const avatarIsImage = typeof avatarBg === 'string' && avatarBg.startsWith('/avatars/');
  const avatarInitials = (profile?.username ?? 'C').slice(0, 1).toUpperCase();
  const displayName = profile?.username ?? 'citizen';

  return (
    <div className={styles.profileContainer}>
      <aside className={styles.leftAside}>
        <div className={styles.leftAsideContent}>
          {/* Section 1: User Info */}
          <div className={styles.asideSection}>
            <div className={styles.userColumn}>
              <div
                className={styles.asideAvatar}
                style={avatarIsImage ? { backgroundImage: `url(${avatarBg})` } : { background: avatarBg }}
              >
                {avatarIsImage ? null : avatarInitials}
              </div>
              <h1 className={styles.userName}>{displayName}</h1>
              <div className={styles.userActionRow}>
                {!isCurrentUser && (
                  <>
                    <Button 
                      variant={following ? "outline" : "duotone"} 
                      className={[
                        styles.profileActionBtn,
                        following && isHoveringFollowing ? styles.danger : ''
                      ].filter(Boolean).join(' ')}
                      size="md" 
                      onClick={toggleFollow}
                      onMouseEnter={() => setIsHoveringFollowing(true)}
                      onMouseLeave={() => setIsHoveringFollowing(false)}
                    >
                      {following ? (isHoveringFollowing ? 'Unfollow' : 'Following') : (
                        <>
                          <UserPlus size={18} weight="bold" />
                          <span>Follow</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      className={[styles.profileActionBtn, styles.dangerBtn].join(' ')}
                      size="md"
                      onClick={toggleBlock}
                    >
                      <Prohibit size={18} weight="bold" />
                      <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                    </Button>
                  </>
                )}
                {isCurrentUser && (
                  <div className={styles.selfTag}>
                    <CheckCircle size={14} weight="fill" />
                    <span>This is you</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className={styles.statsRow}>
              <div className={styles.statItem}>
                <strong>{profile?.following_count || 0}</strong>
                <span>Following</span>
              </div>
              <div className={styles.statItem}>
                <strong>{profile?.followers_count || 0}</strong>
                <span>Followers</span>
              </div>
              <div className={styles.statItem}>
                <strong>{profile?.raises_count || 0}</strong>
                <span>Raises</span>
              </div>
              <div className={styles.statItem}>
                <strong>{profile?.resolved_count || 0}</strong>
                <span>Resolved</span>
              </div>
            </div>
          </div>

          {/* Section 2: Tabs (Timeline Only) */}
          <div className={styles.asideSection}>
            <nav className={styles.sideNav}>
              <button className={`${styles.navItem} ${styles.navItemActive}`}>
                <RowsPlusTop size={20} weight="fill" />
                <span>Timeline</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {profileLoading && (
          <div className={styles.skeletonStack} aria-label="Loading profile">
            {[0, 1, 2].map((item) => (
              <div key={item} className={styles.skeletonCard}>
                <span className={styles.skeletonDot} />
                <div className={styles.skeletonBody}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        )}

        {!profileLoading && (
          <>
            {postsLoading ? (
              <FeedCardSkeleton className={styles.profileFeedCard} />
            ) : (
              <>
                {!profile && (
                  <div className={styles.emptyState}>
                    <WarningCircle size={42} weight="duotone" color="var(--amber)" />
                    <p>User not found.</p>
                    <span>The citizen you are looking for does not exist.</span>
                  </div>
                )}

                {profile && postsError && (
                  <div className={styles.emptyState}>
                    <WarningCircle size={42} weight="duotone" color="var(--amber)" />
                    <p>Activity could not load.</p>
                    <span>Try refreshing the page in a moment.</span>
                  </div>
                )}

                {profile && !postsLoading && !postsError && posts.length === 0 ? (
                  <div className={styles.emptyState}>
                    <UserCircle size={44} weight="duotone" color="var(--text-3)" />
                    <p>No public activity yet.</p>
                    <span>This citizen hasn't shared any civic feedback yet.</span>
                  </div>
                ) : null}

                {profile && !postsLoading && !postsError && posts.length > 0 ? (
                  posts.map((post) => (
                    <FeedCard key={post.id} post={post} className={styles.profileFeedCard} />
                  ))
                ) : null}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

