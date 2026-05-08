'use client';

import { useEffect, useState } from 'react';
import CitizenLayoutShell from '../src/components/shell/CitizenLayoutShell.jsx';
import FeedPage from '../src/views/FeedPage/FeedPage.jsx';
import AuthCallbackPage from '../src/views/AuthCallbackPage/AuthCallbackPage.jsx';

export default function HomePage() {
  const [hasOAuthCallbackParams, setHasOAuthCallbackParams] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    setHasOAuthCallbackParams(Boolean(
      searchParams.get('code')
      || searchParams.get('error')
      || searchParams.get('error_description')
      || hash.includes('access_token=')
      || hash.includes('error=')
    ));
  }, []);

  if (hasOAuthCallbackParams) {
    return <AuthCallbackPage />;
  }

  return (
    <CitizenLayoutShell
      routeKey="feed"
      backgroundless
      topAlignContent
      secondHeader={{ value: 'forYou', isUrlBased: true }}
    >
      <FeedPage />
    </CitizenLayoutShell>
  );
}
