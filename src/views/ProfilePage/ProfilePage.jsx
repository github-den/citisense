import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import {
  PencilSimpleLine,
  FileDashed,
  BookmarkSimple,
  ClockCountdown,
  RowsPlusTop,
  GearSix,
  SignOut,
  WarningCircle,
  UserPlus,
  Prohibit,
  CheckCircle,
} from '@phosphor-icons/react';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import PostPromptCard from '../../components/PostPromptCard/PostPromptCard.jsx';
import PostPromptCardSkeleton from '../../components/PostPromptCard/PostPromptCardSkeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import DraftsPage from '../DraftsPage/DraftsPage.jsx';
import SavedPage from '../SavedPage/SavedPage.jsx';
import ActivityLogPage from '../ActivityLogPage/ActivityLogPage.jsx';
import EditProfilePage from '../EditProfilePage/EditProfilePage.jsx';
import SettingsPage from '../SettingsPage/SettingsPage.jsx';
import { useApp } from '@core/context/AppContext.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { useFeed } from '@core/hooks/useFeed.js';
import { useProfile } from '@core/hooks/useProfile.js';
import { supabase } from '@core/lib/supabase.js';
import { followUser, unfollowUser } from '@core/services/posts.js';
import styles from './ProfilePage.module.css';

const PROFILE_TABS = [
  { key: 'timeline', label: 'Timeline', icon: RowsPlusTop },
  { key: 'activity-log', label: 'Activity history', icon: ClockCountdown },
  { key: 'drafts', label: 'Drafts', icon: FileDashed },
  { key: 'saved', label: 'Saved', icon: BookmarkSimple },
  { key: 'settings', label: 'Settings and support', icon: GearSix },
];

export default function ProfilePage({ setPage, tab: propTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const { session, requireAuth } = useAuth();
  const { openWrite } = useApp() ?? {};

  // Contextual identification
  const urlUsername = params?.username ? String(params.username).replace(/^@/, '').toLowerCase() : null;
  const isOwnProfile = !urlUsername || urlUsername === session?.user?.user_metadata?.username?.toLowerCase();

  // Fetching data
  const { profile, loading: profileLoading, error: profileError } = useProfile(
    isOwnProfile ? session?.user?.id : null,
    !isOwnProfile ? { username: urlUsername } : {}
  );

  const { posts, loading: postsLoading, error: postsError, refresh } = useFeed({ 
    tab: 'activity',
    userId: isOwnProfile ? null : profile?.id, // Hook uses session.user.id if userId is null
    currentUserId: session?.user?.id,
    currentBarangay: profile?.barangay
  });

  // Visitor State
  const [following, setFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isHoveringFollowing, setIsHoveringFollowing] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (isOwnProfile || !profile?.id || !session?.user?.id) return;

    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', session.user.id)
      .eq('following_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setFollowing(!!data);
      });

    return () => { mounted = false; };
  }, [isOwnProfile, profile?.id, session?.user?.id]);

  // Derived Values
  const username = profile?.username || 'citizen';
  const avatarBg = profile?.avatar || '/avatars/avatar_1.png';
  const avatarIsImage = typeof avatarBg === 'string' && avatarBg.startsWith('/avatars/');
  const avatarInitials = username.slice(0, 1).toUpperCase();

  const availableTabs = useMemo(() => (isOwnProfile ? PROFILE_TABS : [PROFILE_TABS[0]]), [isOwnProfile]);
  const requestedTab = propTab || searchParams.get('tab') || 'timeline';
  
  const [activeTab, setActiveTab] = useState(() => {
    const isValidTab = availableTabs.some((tab) => tab.key === requestedTab);
    return isValidTab ? requestedTab : 'timeline';
  });

  useEffect(() => {
    const isValidTab = availableTabs.some((tab) => tab.key === requestedTab);
    setActiveTab(isValidTab ? requestedTab : 'timeline');
  }, [requestedTab, availableTabs]);

  function switchTab(tab) {
    if (!isOwnProfile && tab !== 'timeline') return;
    
    // If clicking the same tab, trigger a refresh for dynamic views
    if (tab === activeTab) {
      if (tab === 'timeline') refresh();
      return;
    }

    setActiveTab(tab);
    const basePath = isOwnProfile ? '/profile' : `/profile/${username}`;
    const path = tab === 'timeline' ? basePath : `${basePath}/${tab}`;
    router.push(path, { scroll: false });
  }

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
      setIsBlocked(!isBlocked);
    }, 'Sign in to block this citizen.');
  }

  const { handleSignOut } = useAuth();

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
              <h1 className={styles.userName}>{username}</h1>
              <div className={styles.userActionRow}>
                {isOwnProfile ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="md" 
                      className={styles.profileActionBtn}
                      onClick={() => switchTab('edit')}
                    >
                      <PencilSimpleLine size={18} weight="bold" />
                      <span>Edit Profile</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="md" 
                      className={styles.profileActionBtn}
                      onClick={() => switchTab('activity-log')}
                    >
                      <ClockCountdown size={18} weight="bold" />
                      <span>Activity Log</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant={following ? "outline" : "duotone"} 
                      className={[
                        styles.profileActionBtn,
                        following && isHoveringFollowing ? styles.dangerBtn : ''
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
                <strong>{profile?.raisesCount || 0}</strong>
                <span>Raises</span>
              </div>
              <div className={styles.statItem}>
                <strong>{profile?.resolvedCount || 0}</strong>
                <span>Resolved</span>
              </div>
            </div>
          </div>

          {/* Section 2: Tabs */}
          <div className={styles.asideSection}>
            <nav className={styles.sideNav}>
              {availableTabs
                .filter((t) => t.key !== 'activity-log')
                .map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                      onClick={() => switchTab(tab.key)}
                    >
                      <tab.icon size={20} weight={isActive ? "fill" : "regular"} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              {isOwnProfile && (
                <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleSignOut}>
                  <SignOut size={20} weight="regular" />
                  <span>Logout</span>
                </button>
              )}
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

        {!profileLoading && activeTab === 'timeline' && (
          <>
            {postsLoading ? (
              <>
                {isOwnProfile && <PostPromptCardSkeleton className={styles.profilePostPrompt} />}
                <FeedCardSkeleton className={styles.profileFeedCard} />
              </>
            ) : (
              <>
                {isOwnProfile && (
                  <PostPromptCard
                    className={styles.profilePostPrompt}
                    avatarBg={avatarBg}
                    avatarInitials={avatarInitials}
                    avatarIsImage={avatarIsImage}
                    placeholder="Share your experience with us"
                    onWrite={openWrite ?? (() => setPage?.('writefb'))}
                    hideActions
                  />
                )}

                {profileError && (
                  <div className={styles.emptyState}>
                    <WarningCircle size={42} weight="duotone" color="var(--amber)" />
                    <p>Profile details could not load.</p>
                    <span>Try refreshing the page in a moment.</span>
                  </div>
                )}

                {!postsLoading && postsError && (
                  <div className={styles.emptyState}>
                    <WarningCircle size={42} weight="duotone" color="var(--amber)" />
                    <p>Profile activity could not load.</p>
                    <span>Try refreshing the page in a moment.</span>
                  </div>
                )}

                {!postsLoading && !postsError && posts.length === 0 ? (
                  <div className={styles.zeroState}>
                    <p className={styles.zeroTitle}>{isOwnProfile ? "No activity in this section yet." : "No public activity yet."}</p>
                    <span className={styles.zeroText}>{isOwnProfile ? "Use the prompt above to submit your first feedback." : "This citizen hasn't shared any civic feedback yet."}</span>
                  </div>
                ) : null}

                {!postsLoading && !postsError && posts.length > 0 ? (
                  posts.map((post) => (
                    <FeedCard key={post.id} post={post} className={styles.profileFeedCard} />
                  ))
                ) : null}
              </>
            )}
          </>
        )}

        {!profileLoading && activeTab === 'activity-log' && isOwnProfile && (
          <ActivityLogPage embedded />
        )}

        {!profileLoading && activeTab === 'edit' && isOwnProfile && (
          <EditProfilePage setPage={setPage} embedded />
        )}

        {!profileLoading && activeTab === 'settings' && isOwnProfile && (
          <SettingsPage setPage={setPage} embedded />
        )}


        {!profileLoading && activeTab === 'drafts' && isOwnProfile && (
          <DraftsPage setPage={setPage} embedded />
        )}

        {!profileLoading && activeTab === 'saved' && isOwnProfile && (
          <SavedPage setPage={setPage} embedded />
        )}
      </main>
    </div>
  );
}
