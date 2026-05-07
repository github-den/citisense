'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FeedRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/feed/for-you');
  }, [router]);
  return null;
}
