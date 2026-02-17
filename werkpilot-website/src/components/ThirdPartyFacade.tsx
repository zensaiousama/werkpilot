'use client';

import { useEffect, useRef, useState } from 'react';

interface ThirdPartyFacadeProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
}

export default function ThirdPartyFacade({ children, placeholder }: ThirdPartyFacadeProps) {
  const [activated, setActivated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActivated(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [activated]);

  return (
    <div ref={containerRef}>
      {activated ? children : (placeholder || null)}
    </div>
  );
}
