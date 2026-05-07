'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import SettingsPage from '../../src/views/SettingsPage/SettingsPage.jsx';

export default function SettingsRoute() {
  return (
    <CitizenLayoutShell routeKey="settings" hideAside>
      {({ navigate }) => <SettingsPage setPage={navigate} />}
    </CitizenLayoutShell>
  );
}
