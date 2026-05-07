'use client';

import CitizenLayoutShell from '../../src/components/shell/CitizenLayoutShell.jsx';
import NotificationsPage from '../../src/views/NotificationsPage/NotificationsPage.jsx';

export default function NotificationsRoute() {
  return (
    <CitizenLayoutShell routeKey="notifications" hideAside backgroundless plainShell>
      <NotificationsPage />
    </CitizenLayoutShell>
  );
}
