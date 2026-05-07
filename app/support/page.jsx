'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { routes } from '@core/lib/navigation/routes.js';

export default function SupportRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace(routes.profileSettings);
  }, [router]);

  return null;
}
