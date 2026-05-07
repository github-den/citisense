'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import CreatePasswordPage from '../../src/views/CreatePasswordPage/CreatePasswordPage.jsx';

export default function CreatePasswordRoute() {
  return (
    <CitizenLayoutShell routeKey="create-password" hideAside hideMobileNav plainShell backgroundless>
      <CreatePasswordPage />
    </CitizenLayoutShell>
  );
}
