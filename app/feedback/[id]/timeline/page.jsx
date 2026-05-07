'use client';

import CitizenLayoutShell from '@/components/shell/CitizenLayoutShell.jsx';
import StatusTimelinePage from '../../../../src/views/StatusTimelinePage/StatusTimelinePage.jsx';

export default function FeedbackTimelineRoute() {
  return (
    <CitizenLayoutShell routeKey="track" hideAside backgroundless hideMobileNav>
      <StatusTimelinePage />
    </CitizenLayoutShell>
  );
}
