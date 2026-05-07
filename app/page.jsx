'use client';

import CitizenLayoutShell from '../src/components/shell/CitizenLayoutShell.jsx';
import FeedPage from '../src/views/FeedPage/FeedPage.jsx';

export default function HomePage() {
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
