'use client';
import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import LGUPage from '../../src/views/LGUPage/LGUPage.jsx';

export default function Page() {
  return (
    <CitizenLayoutShell routeKey="lgu" hideAside plainShell>
      <LGUPage />
    </CitizenLayoutShell>
  );
}
