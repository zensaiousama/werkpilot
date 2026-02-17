import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';
import GuaranteeBadge from '@/components/GuaranteeBadge';

export default function FinalCTASection() {
  return (
    <section
      className="hero-gradient relative overflow-hidden"
      style={{ padding: '120px 0' }}
    >
      {/* Reuse hero orbs for visual consistency */}
      <div className="hero-orb hero-orb-1" aria-hidden="true" />
      <div className="hero-orb hero-orb-2" aria-hidden="true" />

      <div className="container mx-auto px-4 relative z-10">
        <AnimatedSection className="max-w-3xl mx-auto text-center">
          {/* Scarcity badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 mb-8"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#34D399' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#10B981' }} />
            </span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', fontWeight: 500 }}>
              Aktuell 2 Plätze frei diesen Monat
            </span>
          </div>

          <h2 style={{ color: '#FFFFFF' }}>
            Bereit für mehr Kunden und weniger Stress?
          </h2>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.25rem', lineHeight: 1.6, marginBottom: '1rem', maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}>
            Starten Sie mit einem gratis Digital-Fitness-Check und erfahren Sie,
            wie viele Kunden Sie online verpassen.
          </p>

          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.875rem', marginBottom: '2rem' }}>
            Ein Marketing-Team kostet CHF 7&apos;000/Monat. Werkpilot ab CHF 1&apos;500.
          </p>

          <Link
            href="/fitness-check"
            className="btn btn-primary btn-glow text-lg mb-6 inline-flex"
            data-track="cta-final"
          >
            Jetzt kostenlos starten &rarr;
          </Link>

          {/* Trust micro-badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6">
            {['Keine Kreditkarte', '2 Minuten', '100% kostenlos', 'Unverbindlich'].map((label) => (
              <span key={label} className="inline-flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem' }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#34D399" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {label}
              </span>
            ))}
          </div>

          <div className="mt-8">
            <GuaranteeBadge />
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
