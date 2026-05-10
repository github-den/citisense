'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppContext } from '@core/context/AppContext.jsx';
import CitizenSubheader from './CitizenSubheader.jsx';
import RightAside from '../RightAside/RightAside.jsx';
import TopHeader from '../TopHeader/TopHeader.jsx';
import DiscussionModal from '../DiscussionModal/DiscussionModal.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { routes } from '@core/lib/navigation/routes.js';
import { OUTSIDE_URDANETA } from '@/constants/index.js';
import styles from '../../App.module.css';

function buildSearchHref(query) {
  const trimmed = String(query ?? '').trim();
  return trimmed ? `${routes.search}?q=${encodeURIComponent(trimmed)}` : routes.search;
}

export default function CitizenLayoutShell({
  routeKey,
  secondHeader,
  hideAside = false,
  hideMobileNav = false,
  plainShell = false,
  backgroundless = false,
  customAside,
  children,
  ...asideProps
}) {
  const router = useRouter();
  const { isAuthenticated, session } = useAuth();
  const searchQueryRef = useRef('');
  const [setupDraft, setSetupDraft] = useState(null);
  const [discussionPost, setDiscussionPost] = useState(null);

  const useBlankShell = routeKey === 'create-password' || routeKey === 'write';
  // Pages that show a second-row tab strip in MobileHeader
  const hasMobileTabs = ['feed', 'feedbox', 'notifications', 'search'].includes(routeKey);
  const shellClassName = useMemo(
    () => `${styles.shell} ${secondHeader ? styles.headerStackWithSubheader : styles.headerStackSingle} ${plainShell ? styles.shellPlain : ''} ${useBlankShell ? styles.shellBlank : ''}`,
    [plainShell, secondHeader, useBlankShell],
  );

  const subheaderItems = useMemo(() => {
    if (!secondHeader) return [];

    if (routeKey === 'feed') {
      const items = [
        { value: 'forYou', label: 'For You', onClick: () => { window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader')); router.push(routes.feed); } },
      ];
      
      const userBarangay = session?.user?.user_metadata?.barangay;
      const showBarangayTab = isAuthenticated && userBarangay && userBarangay !== OUTSIDE_URDANETA;

      if (isAuthenticated) {
        items.push(
          { value: 'following', label: 'Following', onClick: () => { window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader')); router.push(routes.homeFollowing); } },
          ...(showBarangayTab
            ? [{ value: 'barangay', label: 'Your barangay', onClick: () => { window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader')); router.push(routes.homeBarangay); } }]
            : [])
        );
      }
      
      return items;
    }


    return [];
  }, [routeKey, router, secondHeader, isAuthenticated, session?.user?.user_metadata?.barangay]);

  function setSearchQuery(next) {
    searchQueryRef.current = String(next ?? '');
  }

  function navigate(nextPage) {
    // Trigger loader immediately on navigation start
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

    switch (nextPage) {
      case 'feed':
        router.push(routes.homeForYou);
        break;
      case 'feedForYou':
        router.push(routes.homeForYou);
        break;
      case 'feedFollowing':
        router.push(routes.homeFollowing);
        break;
      case 'feedBarangay':
      case 'feedNeighbor':
        router.push(routes.homeBarangay);
        break;
      case 'feedbox':
        router.push(routes.feedbox);
        break;
      case 'lgu':
      case 'citimood':
      case 'cityPerformance':
      case 'lgu-performance':
        router.push(routes.lgu);
        break;
      case 'profile':
        router.push(routes.profile);
        break;
      case 'editProfile':
        router.push(routes.editProfile);
        break;
      case 'notifications':
        router.push(routes.notifications);
        break;
      case 'saved':
        router.push(routes.profileSaved);
        break;
      case 'drafts':
        router.push(routes.profileDrafts);
        break;
      case 'settings':
      case 'help':
        router.push(routes.profileSettings);
        break;
      case 'search':
        router.push(buildSearchHref(searchQueryRef.current));
        break;
      case 'track':
        router.push(routes.track);
        break;
      case 'writefb':
        router.push(routes.write);
        break;
      default:
        break;
    }
  }

  const appContextValue = useMemo(() => ({
    openDiscuss: (post) => {
      if (!post?.id) return;
      setDiscussionPost(post);
    },
    openSearch: (query) => {
      searchQueryRef.current = String(query ?? '');
      router.push(buildSearchHref(searchQueryRef.current));
    },
    openWrite: (shortcut) => {
      window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
      const url = shortcut ? `${routes.write}?shortcut=${shortcut}` : routes.write;
      router.push(url);
    },
    setSetupDraft,
    setupDraft,
  }), [router, setupDraft]);

  const mainContent = typeof children === 'function'
    ? children({ navigate, setSearchQuery })
    : children;

  return (
    <Suspense fallback={null}>
    <AppContext.Provider value={appContextValue}>
      <div className={shellClassName} data-has-tabs={hasMobileTabs ? 'true' : undefined}>

        <div className={styles.headerStack}>
          <TopHeader page={routeKey} secondHeader={secondHeader} setPage={navigate} setSearchQuery={setSearchQuery} />
          {subheaderItems.length > 0 ? (
            <CitizenSubheader
              items={subheaderItems}
              value={secondHeader?.value}
              onChange={(nextValue) => subheaderItems.find((item) => item.value === nextValue)?.onClick?.()}
            />
          ) : null}
        </div>

        <div className={`${styles.content} ${hideAside ? styles.contentWide : ''} ${plainShell ? styles.contentPlain : ''}`}>
          <div className={`${styles.mainFrame} ${hideAside ? styles.mainFrameWide : ''} ${backgroundless ? styles.mainFrameNoSurface : ''}`}>
            <main className={`${styles.mainCol} ${hideAside ? styles.mainColWide : ''} ${plainShell ? styles.mainColPlain : ''} ${backgroundless ? styles.mainColNoSurface : ''}`}>
              {mainContent}
            </main>
          </div>

          {!hideAside ? (
            <div className={styles.asideFrame}>
              {customAside ? customAside : (
                <RightAside page={routeKey} setPage={navigate} setSearchQuery={setSearchQuery} {...asideProps} />
              )}
            </div>
          ) : null}
        </div>

        <DiscussionModal 
          post={discussionPost} 
          onClose={() => setDiscussionPost(null)} 
        />
      </div>
    </AppContext.Provider>
    </Suspense>
  );
}
