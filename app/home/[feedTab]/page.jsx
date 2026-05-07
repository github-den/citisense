import { redirect } from 'next/navigation';

const LEGACY_FEED_ROUTES = {
  forYou: '/feed',
  following: '/feed/following',
  nearby: '/feed/nearby',
};

export default async function LegacyHomeFeedRoute({ params }) {
  const { feedTab } = await params;
  redirect(LEGACY_FEED_ROUTES[feedTab] ?? '/feed');
}
