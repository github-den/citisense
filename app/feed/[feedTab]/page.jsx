'use client';

import { useParams } from 'next/navigation';
import CitizenLayoutShell from '@/components/shell/CitizenLayoutShell.jsx';
import FeedPage from '../../../src/views/FeedPage/FeedPage.jsx';

const FEED_TABS = {
  'for-you': 'forYou',
  following: 'following',
  barangay: 'barangay',
  neighbor: 'barangay', // legacy alias
};

export default function FeedTabRoute() {
  const { feedTab: routeFeedTab } = useParams();
  const feedTab = FEED_TABS[routeFeedTab] ?? 'forYou';

  return (
    <CitizenLayoutShell
      routeKey="feed"
      backgroundless
      secondHeader={{ value: feedTab, isUrlBased: true }}
    >
      <FeedPage feedTab={feedTab} />
    </CitizenLayoutShell>
  );
}
