'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransitionProgress() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;

      const bar = barRef.current;
      if (!bar) return;

      // Show and animate via DOM directly (avoids setState in effect)
      bar.style.display = 'block';
      bar.style.width = '30%';

      const timer1 = setTimeout(() => { bar.style.width = '60%'; }, 100);
      const timer2 = setTimeout(() => { bar.style.width = '100%'; }, 200);
      const timer3 = setTimeout(() => {
        bar.style.display = 'none';
        bar.style.width = '0%';
      }, 500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [pathname]);

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 h-[2px] z-[100] transition-all duration-200 ease-out"
      style={{
        display: 'none',
        width: '0%',
        background: 'linear-gradient(90deg, #2563EB, #059669)',
        boxShadow: '0 0 10px rgba(37, 99, 235, 0.5)',
      }}
    />
  );
}
