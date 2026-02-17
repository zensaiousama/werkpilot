'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

const quickActions = [
  { href: '/fitness-check', label: 'Gratis Fitness-Check', icon: '⚡' },
  { href: 'tel:+41445555000', label: 'Anrufen', icon: '📞' },
  { href: 'mailto:info@werkpilot.ch', label: 'Email senden', icon: '✉️' },
  { href: '/preise', label: 'Preise ansehen', icon: '💰' },
];

export default function MobileBottomSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  useEffect(() => {
    // Only show after scroll past hero
    const handleScroll = () => {
      setIsVisible(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 60) setIsOpen(false);
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Trigger pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 md:hidden rounded-full px-5 py-2.5 shadow-lg transition-transform active:scale-95"
          style={{
            backgroundColor: '#2563EB',
            color: 'white',
            fontSize: '0.8rem',
            fontWeight: 700,
            fontFamily: 'var(--font-jakarta)',
          }}
          aria-label="Schnellaktionen öffnen"
        >
          Schnellaktionen ↑
        </button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-label="Schnellaktionen"
      >
        <div
          className="rounded-t-2xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          }}
        >
          {/* Handle */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
          </div>

          <div className="px-6 pb-6">
            <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
              Schnellaktionen
            </p>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                  }}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
