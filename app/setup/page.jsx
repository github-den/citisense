'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import SetupAccountPage from '../../src/views/SetupAccountPage/SetupAccountPage.jsx';

export default function SetupRoute() {
  return (
    <CitizenLayoutShell routeKey="setup" hideAside hideMobileNav plainShell backgroundless>
      <SetupAccountPage />
    </CitizenLayoutShell>
  );
}
