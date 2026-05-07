'use client';

import CitizenLayoutShell from '@/components/shell/CitizenLayoutShell.jsx';
import ProfilePage from '../../../src/views/ProfilePage/ProfilePage.jsx';

export default function PublicProfileRoute() {
  return (
    <CitizenLayoutShell routeKey="profile" hideAside backgroundless plainShell>
      {({ navigate }) => (
        <ProfilePage setPage={navigate} />
      )}
    </CitizenLayoutShell>
  );
}
