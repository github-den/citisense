'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import CharterPage from '../../src/views/CharterPage/CharterPage.jsx';

export default function Page() {
  return (
    <CitizenLayoutShell routeKey="charter" hideAside plainShell>
      <CharterPage />
    </CitizenLayoutShell>
  );
}
