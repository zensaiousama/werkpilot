'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';
import PricingAnchor from '@/components/PricingAnchor';

export default function SolutionSection() {
  const [specialists, setSpecialists] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  // Only start counting when the counter is visible
  useEffect(() => {
    if (!counterRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const end = 43;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic for satisfying deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            start = Math.round(eased * end);
            setSpecialists(start);
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(counterRef.current);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section className="section gradient-mesh" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>
            Ihr komplettes Backoffice — ohne die Kosten eines Teams
          </h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Zum Vergleich: Ein Marketing-Mitarbeiter kostet CHF 7&apos;000/Monat
          </p>
        </AnimatedSection>

        <AnimatedSection className="mb-16" delay={100}>
          <PricingAnchor />
        </AnimatedSection>

        {/* Stats */}
        <AnimatedSection
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 max-w-4xl mx-auto"
          delay={200}
        >
          <div className="text-center p-8" ref={counterRef}>
            <div
              className="mb-3"
              style={{
                fontSize: '4.5rem',
                fontFamily: 'var(--font-jakarta)',
                color: 'var(--color-primary)',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                minHeight: '4.5rem',
              }}
            >
              {specialists}
            </div>
            <p className="text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Spezialisten arbeiten für Sie
            </p>
          </div>
          <div className="text-center p-8">
            <div
              className="mb-3"
              style={{
                fontSize: '4.5rem',
                fontFamily: 'var(--font-jakarta)',
                color: 'var(--color-primary)',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              24/7
            </div>
            <p className="text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Im Einsatz für Ihr KMU
            </p>
          </div>
          <div className="text-center p-8">
            <div
              className="mb-3"
              style={{
                fontSize: '4.5rem',
                fontFamily: 'var(--font-jakarta)',
                color: 'var(--color-accent)',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              CHF 1&apos;500
            </div>
            <p className="text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Ab /Monat &middot; Keine Kreditkarte
            </p>
          </div>
        </AnimatedSection>

        {/* Package Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              title: 'Kunden gewinnen',
              price: "CHF 2'000",
              description: 'SEO, Content, Social Media, Email Marketing',
              link: '/dienstleistungen/kunden-gewinnen',
              dataTrack: 'cta-package-kunden',
            },
            {
              title: 'Effizienz',
              price: "CHF 1'500",
              description: 'Prozess-Automation, Kommunikation, Reporting',
              link: '/dienstleistungen/effizienz',
              featured: true,
              badge: 'Beliebteste Wahl',
              dataTrack: 'cta-package-effizienz',
            },
            {
              title: 'Wachstum',
              price: "CHF 5'000",
              description: 'Alles + Strategie, Analytics, Expansion',
              link: '/dienstleistungen/wachstum',
              dataTrack: 'cta-package-wachstum',
            },
          ].map((pkg, index) => (
            <AnimatedSection
              key={index}
              delay={300 + index * 100}
              className="card p-8"
              style={pkg.featured ? { borderColor: '#2563EB', borderWidth: '2px' } : {}}
            >
              {pkg.featured && pkg.badge && (
                <div
                  className="text-xs font-bold mb-4 inline-block px-3 py-1 rounded-full text-white"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  {pkg.badge}
                </div>
              )}
              <h3
                className="mb-2"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {pkg.title}
              </h3>
              <div className="mb-4">
                <span
                  style={{
                    fontSize: '2rem',
                    fontFamily: 'var(--font-jakarta)',
                    color: 'var(--color-primary)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {pkg.price}
                </span>
                <span className="text-base ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                  /Monat
                </span>
              </div>
              <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                {pkg.description}
              </p>
              <Link
                href={pkg.link}
                className={pkg.featured ? 'btn btn-primary w-full justify-center' : 'btn btn-secondary w-full justify-center'}
                data-track={pkg.dataTrack}
              >
                {pkg.featured ? 'Jetzt starten' : 'Mehr erfahren'} &rarr;
              </Link>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mt-12" delay={800}>
          <Link
            href="/dienstleistungen"
            className="text-base font-semibold hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Alle Pakete vergleichen &rarr;
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
