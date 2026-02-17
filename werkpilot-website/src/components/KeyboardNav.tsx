'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function KeyboardNav() {
  const router = useRouter();
  const lastKeyRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      // Two-key combos: g+h (home), g+p (preise), g+f (fitness-check), g+k (kontakt)
      if (timeDiff < 500 && lastKeyRef.current === 'g') {
        switch (e.key) {
          case 'h': router.push('/'); break;
          case 'p': router.push('/preise'); break;
          case 'f': router.push('/fitness-check'); break;
          case 'k': router.push('/kontakt'); break;
          case 'd': router.push('/dienstleistungen'); break;
          case 'b': router.push('/blog'); break;
        }
      }

      // ? to show keyboard shortcuts hint (scroll to FAQ)
      if (e.key === '?' && e.shiftKey) {
        const faq = document.getElementById('faq-question-0');
        if (faq) {
          faq.scrollIntoView({ behavior: 'smooth' });
          faq.focus();
        }
      }

      lastKeyRef.current = e.key;
      lastKeyTimeRef.current = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return null;
}
