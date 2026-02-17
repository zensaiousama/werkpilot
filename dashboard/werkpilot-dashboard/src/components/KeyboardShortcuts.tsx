'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Global keyboard shortcuts:
 * - G then D: Go to Dashboard
 * - G then C: Go to CRM
 * - G then S: Go to Scraper
 * - G then A: Go to Agents
 * - G then N: Go to Night Shift
 * - G then L: Go to Analytics
 * - G then T: Go to Settings
 * - ?: Show shortcuts help (future)
 */
export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        if (!gPressed) {
          gPressed = true;
          gTimeout = setTimeout(() => { gPressed = false; }, 1000);
          return;
        }
      }

      if (gPressed) {
        gPressed = false;
        if (gTimeout) clearTimeout(gTimeout);

        const routes: Record<string, string> = {
          d: '/',
          c: '/crm',
          s: '/scraper',
          a: '/agents',
          n: '/nightshift',
          l: '/analytics',
          t: '/settings',
        };

        if (routes[e.key]) {
          e.preventDefault();
          router.push(routes[e.key]);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [router]);

  return null;
}
