'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CitizenLayoutShell from '@/components/shell/CitizenLayoutShell.jsx';
import InsideboxPage from '../../../src/views/InsideboxPage/InsideboxPage.jsx';
import { useFeedboxes } from '@core/hooks/useFeedboxes.js';
import { slugifySegment } from '@core/lib/navigation/routes.js';

export default function FeedboxDetailRoute() {
  const { slug } = useParams();
  const router = useRouter();
  const { feedboxes } = useFeedboxes();
  const [activeFeedbox, setActiveFeedbox] = useState(null);

  const feedbox = useMemo(
    () => feedboxes.find((item) => slugifySegment(item.slug ?? item.topic) === String(slug ?? '')),
    [feedboxes, slug],
  );

  return (
    <CitizenLayoutShell routeKey="insidebox" activeFeedbox={activeFeedbox}>
      <InsideboxPage
        feedbox={feedbox ?? null}
        setActiveFeedbox={setActiveFeedbox}
        onBack={() => router.back()}
      />
    </CitizenLayoutShell>
  );
}
