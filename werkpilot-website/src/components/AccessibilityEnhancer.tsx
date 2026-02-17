'use client';

import { useEffect, useRef } from 'react';

export default function AccessibilityEnhancer() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Add keyboard-only focus styles
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.documentElement.classList.add('keyboard-nav');
      }
    };
    const handleMouseDown = () => {
      document.documentElement.classList.remove('keyboard-nav');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    // Announce page load to screen readers
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0';
    document.body.appendChild(announcer);

    // Announce current page
    requestAnimationFrame(() => {
      announcer.textContent = `Seite geladen: ${document.title}`;
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      announcer.remove();
    };
  }, []);

  return null;
}
