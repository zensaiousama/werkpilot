'use client';

import { useEffect, useRef } from 'react';

export default function DeferredAnalytics() {
  const loadedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const load = () => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      injectScripts();
    };

    const events = ['mousedown', 'touchstart', 'scroll', 'keydown'] as const;
    events.forEach((event) => document.addEventListener(event, load, { once: true, passive: true }));
    const timeout = setTimeout(load, 5000);

    return () => {
      events.forEach((event) => document.removeEventListener(event, load));
      clearTimeout(timeout);
    };
  }, []);

  return null;
}

function injectScripts() {
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Custom event tracking utility
  const w = window as unknown as Record<string, unknown>;
  w.wpTrack = function(event: string, data?: Record<string, string>) {
    const plausible = w.plausible as ((event: string, opts: { props: Record<string, string> | undefined }) => void) | undefined;
    const clarity = w.clarity as ((cmd: string, key: string, value: string) => void) | undefined;
    if (plausible) plausible(event, { props: data });
    if (clarity) clarity('set', event, JSON.stringify(data || {}));
  };

  type TrackFn = (event: string, data: Record<string, string>) => void;

  // Track CTA clicks via data-track attributes (event delegation)
  document.addEventListener('click', function(e) {
    const el = (e.target as HTMLElement).closest('[data-track]');
    if (el) {
      const trackId = el.getAttribute('data-track');
      if (trackId && w.wpTrack) (w.wpTrack as TrackFn)('cta_click', { id: trackId });
    }
  });

  // Track scroll depth (throttled with rAF)
  let maxScroll = 0;
  let scrollTicking = false;
  const milestones = [25, 50, 75, 100];

  window.addEventListener('scroll', function() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((window.scrollY / docHeight) * 100);
        if (pct > maxScroll) {
          maxScroll = pct;
          for (const milestone of milestones) {
            if (maxScroll >= milestone) {
              if (w.wpTrack) (w.wpTrack as TrackFn)('scroll_depth', { depth: milestone + '%' });
            }
          }
        }
      }
      scrollTicking = false;
    });
  }, { passive: true });
}
