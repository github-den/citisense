'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import FeedboxPage from '../../src/views/FeedboxPage/FeedboxPage.jsx';

export default function FeedboxRoute() {
  return (
    <CitizenLayoutShell routeKey="feedbox" hideAside backgroundless plainShell>
      <FeedboxPage />
    </CitizenLayoutShell>
  );
}
