'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import AgreementPage from '../../src/views/AgreementPage/AgreementPage.jsx';

export default function AgreementRoute() {
  return (
    <CitizenLayoutShell routeKey="setup" hideAside hideMobileNav backgroundless>
      <AgreementPage />
    </CitizenLayoutShell>
  );
}
