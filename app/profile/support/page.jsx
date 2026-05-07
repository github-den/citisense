'use client';

import { Suspense } from 'react';
import CitizenLayoutShell from '@/components/shell/CitizenLayoutShell.jsx';
import ProfilePage from '../../../src/views/ProfilePage/ProfilePage.jsx';

export default function ProfileSupportRoute() {
  return (
    <CitizenLayoutShell routeKey="profile" hideAside backgroundless plainShell>
      {({ navigate }) => (
        <Suspense fallback={null}>
          <ProfilePage setPage={navigate} tab="support" />
        </Suspense>
      )}
    </CitizenLayoutShell>
  );
}
