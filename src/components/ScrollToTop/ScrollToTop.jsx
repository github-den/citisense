'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Disable automatic browser scroll restoration to take full control
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const performScroll = () => {
      // Force scroll on window
      window.scrollTo(0, 0);
      
      // Also try scrolling any common layout containers if they happen to be the ones scrolling
      const containers = document.querySelectorAll('[class*="content"], [class*="shell"], main');
      containers.forEach(el => {
        if (el.scrollTop !== 0) el.scrollTop = 0;
      });
    };

    // Stage 1: Immediate
    performScroll();

    // Stage 2: Short delay for Next.js router processing
    const timer = setTimeout(performScroll, 30);
    
    // Stage 3: Longer delay for heavy content loading (like maps or charts)
    const longTimer = setTimeout(performScroll, 150);

    return () => {
      clearTimeout(timer);
      clearTimeout(longTimer);
    };
  }, [pathname, searchParams]);

  return null;
}
