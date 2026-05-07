'use client';

import { Suspense } from 'react';
import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import WriteFeedbackPage from '../../src/views/WriteFeedbackPage/WriteFeedbackPage.jsx';

export default function WriteRoute() {
  return (
    <CitizenLayoutShell routeKey="write" hideAside backgroundless plainShell>
      <Suspense fallback={null}>
        <WriteFeedbackPage />
      </Suspense>
    </CitizenLayoutShell>
  );
}
