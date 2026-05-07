import { useEffect, useRef, useCallback } from 'react';
import { ChatCenteredText, WarningCircle } from '@phosphor-icons/react';
import PostPromptCard from '../../components/PostPromptCard/PostPromptCard.jsx';
import PostPromptCardSkeleton from '../../components/PostPromptCard/PostPromptCardSkeleton.jsx';
import FeedCard from '../../components/FeedCard/FeedCard.jsx';
import FeedCardSkeleton from '../../components/FeedCard/FeedCardSkeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import { useApp } from '@core/context/AppContext.jsx';
import { useFeed } from '@core/hooks/useFeed.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import { useProfile } from '@core/hooks/useProfile.js';
import styles from './FeedPage.module.css';

export default function FeedPage({ feedTab = 'forYou', onReady }) {
  const { isAuthenticated, openModal, session } = useAuth();
  const { profile } = useProfile(session?.user?.id);
  const { posts, loading, loadingMore, error, hasMore, loadMore } = useFeed({
    tab: feedTab,
    currentUserId: session?.user?.id,
    currentBarangay: profile?.barangay,
  });
  const { openWrite } = useApp() ?? {};

  // Pagination trigger logic
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

  const visiblePosts = isAuthenticated ? posts : posts.slice(0, 5);
  const showGuestLimit = !isAuthenticated && posts.length > 5;
  const username =
    profile?.username ||
    session?.user?.user_metadata?.username ||
    'citizen';
  const avatarBg =
    profile?.avatar ||
    session?.user?.user_metadata?.avatar ||
    '/avatars/avatar_1.png';
  const avatarIsImage = typeof avatarBg === 'string' && avatarBg.startsWith('/avatars/');
  const avatarInitials = username.slice(0, 1).toUpperCase();

  return (
    <div className={styles.page}>
      {/* INITIAL LOADING STATE */}
      {loading && posts.length === 0 && (
        <>
          {feedTab === 'forYou' && <PostPromptCardSkeleton />}
          <FeedCardSkeleton />
        </>
      )}

      {/* ACTUAL CONTENT */}
      {(posts.length > 0 || !loading) && (

        <>
          {isAuthenticated && feedTab === 'forYou' && (
            <PostPromptCard
              avatarBg={avatarBg}
              avatarInitials={avatarInitials}
              avatarIsImage={avatarIsImage}
              title="What civic concern do you want to raise?"
              subtitle="Start with the issue, exact location, and service involved so people can understand it quickly."
              placeholder="Share your experience with us"
              onWrite={openWrite}
              hideActions
            />
          )}

          {!error && posts.length === 0 && (
            <div className={styles.empty}>
              <ChatCenteredText size={44} weight="duotone" color="var(--text-3)" />
              <p>No feedback yet.</p>
              <span>Be the first to share what's happening in Urdaneta.</span>
            </div>
          )}

          {error && (
            <div className={styles.empty}>
              <WarningCircle size={44} weight="duotone" color="var(--amber)" />
              <p>Feed could not refresh.</p>
              <span>Check the database connection or try again in a moment.</span>
            </div>
          )}

          {visiblePosts.map((post, index) => {
            const isTrigger = index === visiblePosts.length - 10;
            return (
              <div key={post.id}>
                <FeedCard
                  post={post}
                  ref={isTrigger ? triggerRef : undefined}
                />
              </div>
            );
          })}

          {showGuestLimit && (
            <div className={styles.guestLimit}>
              <div className={styles.guestCopy}>
                <p>Join CitiSense now <span className={styles.accent}>!</span></p>
                <span className={styles.subtitle}>Raise reports, track updates, and join discussions for a better Urdaneta.</span>
              </div>
              <div className={styles.guestActions}>
                <Button variant="secondary" onClick={() => openModal('login')}>
                  Log In
                </Button>
                <Button variant="duotone" onClick={() => openModal('create')}>
                  Sign Up
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
