'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import TrackFeedbackPage from '../../src/views/TrackFeedbackPage/TrackFeedbackPage.jsx';

export default function TrackRoutePage() {
  return (
    <CitizenLayoutShell
      routeKey="track"
      plainShell
      hideAside
      topAlignContent
    >
      <TrackFeedbackPage />
    </CitizenLayoutShell>
  );
}
