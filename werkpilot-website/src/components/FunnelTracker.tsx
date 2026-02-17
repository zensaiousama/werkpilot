'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const FUNNEL_KEY = 'wp-funnel';

interface FunnelData {
  firstVisit: string;
  visits: number;
  pagesViewed: string[];
  scrollDepth: number;
  timeOnSite: number;
  ctaClicks: number;
  stage: 'awareness' | 'consideration' | 'decision';
}

function getFunnel(): FunnelData {
  try {
    const stored = localStorage.getItem(FUNNEL_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    firstVisit: new Date().toISOString(),
    visits: 0,
    pagesViewed: [],
    scrollDepth: 0,
    timeOnSite: 0,
    ctaClicks: 0,
    stage: 'awareness',
  };
}

function saveFunnel(data: FunnelData) {
  try {
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(data));
  } catch {}
}

function calculateStage(data: FunnelData): FunnelData['stage'] {
  if (data.ctaClicks > 0 || data.pagesViewed.includes('/fitness-check') || data.pagesViewed.includes('/preise')) {
    return 'decision';
  }
  if (data.visits > 1 || data.pagesViewed.length > 3 || data.scrollDepth > 70) {
    return 'consideration';
  }
  return 'awareness';
}

export default function FunnelTracker() {
  const pathname = usePathname();
  const mountedRef = useRef(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const funnel = getFunnel();
    funnel.visits++;

    // Track CTA clicks
    const handleClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('[data-track]');
      if (el) {
        funnel.ctaClicks++;
        funnel.stage = calculateStage(funnel);
        saveFunnel(funnel);
      }
    };

    // Track scroll depth
    let maxScroll = funnel.scrollDepth;
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((window.scrollY / docHeight) * 100);
        if (pct > maxScroll) {
          maxScroll = pct;
          funnel.scrollDepth = maxScroll;
        }
      }
    };

    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Save on page hide
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        funnel.timeOnSite += (Date.now() - startTime.current) / 1000;
        funnel.stage = calculateStage(funnel);
        saveFunnel(funnel);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Track page views
  useEffect(() => {
    const funnel = getFunnel();
    if (!funnel.pagesViewed.includes(pathname)) {
      funnel.pagesViewed.push(pathname);
      funnel.stage = calculateStage(funnel);
      saveFunnel(funnel);
    }
  }, [pathname]);

  return null;
}
