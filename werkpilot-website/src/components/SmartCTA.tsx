'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const ctaVariants = [
  { threshold: 0, text: 'Gratis Fitness-Check starten', subtext: '2 Minuten • Unverbindlich' },
  { threshold: 30, text: 'Jetzt Potenzial entdecken', subtext: 'Sie sind fast da — noch 2 Minuten' },
  { threshold: 60, text: 'Report jetzt sichern', subtext: 'Diesen Monat noch 2 Plätze frei' },
  { threshold: 80, text: 'Letzter Schritt: Gratis Check', subtext: 'Ihr personalisierter Report wartet' },
];

export default function SmartCTA() {
  const [variant, setVariant] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) { ticking.current = false; return; }
        const pct = (window.scrollY / docHeight) * 100;

        let newVariant = 0;
        for (let i = ctaVariants.length - 1; i >= 0; i--) {
          if (pct >= ctaVariants[i].threshold) {
            newVariant = i;
            break;
          }
        }
        setVariant(newVariant);
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const current = ctaVariants[variant];

  return (
    <div className="text-center">
      <Link
        href="/fitness-check"
        className="btn btn-primary btn-glow text-lg"
        data-track="cta-smart"
      >
        {current.text} &rarr;
      </Link>
      <p className="text-xs mt-3" style={{ color: 'var(--color-text-secondary)' }}>
        {current.subtext}
      </p>
    </div>
  );
}
