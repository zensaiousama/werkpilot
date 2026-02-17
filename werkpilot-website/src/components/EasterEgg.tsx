'use client';

import { useState, useEffect, useCallback } from 'react';

// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default function EasterEgg() {
  const [index, setIndex] = useState(0);
  const [triggered, setTriggered] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === KONAMI[index]) {
      const next = index + 1;
      if (next === KONAMI.length) {
        setTriggered(true);
        setIndex(0);
        setTimeout(() => setTriggered(false), 4000);
      } else {
        setIndex(next);
      }
    } else {
      setIndex(0);
    }
  }, [index]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!triggered) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
      style={{ animation: 'fadeIn 0.3s ease' }}
    >
      <div
        className="text-center p-8 rounded-2xl"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          animation: 'fadeInUp 0.5s ease',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🚀</div>
        <p style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-jakarta)' }}>
          Werkpilot Power Mode!
        </p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
          Sie haben das Easter Egg gefunden.
        </p>
      </div>
    </div>
  );
}
