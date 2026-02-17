import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';

const packages = [
  {
    name: 'Kunden gewinnen',
    price: "1'500",
    period: '/Monat',
    description: 'Marketing auf Autopilot',
    features: [
      '10 Marketing-Agenten',
      'Google Ads & SEO',
      'Lead-Generierung',
      'Content & Social Media',
      'Reporting Dashboard',
    ],
    cta: 'Paket waehlen',
    ctaLink: '/dienstleistungen/kunden-gewinnen',
    highlight: false,
  },
  {
    name: 'Effizienz',
    price: "3'500",
    period: '/Monat',
    description: 'Komplettes Backoffice',
    features: [
      'Alles aus "Kunden gewinnen"',
      '20+ Agenten',
      'Automatische Rechnungen',
      'Advanced CRM',
      'Priority Support',
    ],
    cta: 'Paket waehlen',
    ctaLink: '/dienstleistungen/effizienz',
    highlight: true,
    badge: 'Beliebteste Wahl',
  },
  {
    name: 'Wachstum',
    price: "7'500",
    period: '/Monat',
    description: 'Enterprise mit Strategie',
    features: [
      'Alle 43 Agenten',
      'Custom AI Development',
      'Account Manager',
      'Strategisches Consulting',
      'Enterprise Security',
    ],
    cta: 'Kontakt aufnehmen',
    ctaLink: '/kontakt',
    highlight: false,
  },
];

export default function PricingSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Transparente Preise</h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Keine Setup-Gebuehren. Keine versteckten Kosten. Monatlich kuendbar.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {packages.map((pkg, index) => (
            <AnimatedSection
              key={index}
              delay={index * 150}
              className={`rounded-2xl p-8 flex flex-col relative ${pkg.highlight ? 'card-featured' : ''}`}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: pkg.highlight ? 'none' : '1px solid var(--color-border)',
                boxShadow: pkg.highlight
                  ? '0 8px 30px rgba(37, 99, 235, 0.12)'
                  : 'var(--shadow-sm)',
              }}
            >
              {pkg.badge && (
                <div
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap text-white"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  {pkg.badge}
                </div>
              )}

              <p
                className="text-sm font-semibold uppercase tracking-wider mb-2"
                style={{ color: pkg.highlight ? '#2563EB' : 'var(--color-text-secondary)' }}
              >
                {pkg.name}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                {pkg.description}
              </p>

              <div className="mb-6">
                <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                  CHF{' '}
                </span>
                <span
                  style={{
                    fontSize: '2.5rem',
                    fontFamily: 'var(--font-jakarta)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: pkg.highlight ? '#2563EB' : 'var(--color-primary)',
                  }}
                >
                  {pkg.price}
                </span>
                <span className="text-sm ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {pkg.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {pkg.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm">
                    <svg
                      className="flex-shrink-0 mt-0.5"
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill="#059669"
                      />
                    </svg>
                    <span style={{ color: 'var(--color-text)' }}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={pkg.ctaLink}
                className={`btn ${pkg.highlight ? 'btn-primary' : 'btn-secondary'} w-full justify-center`}
                data-track={`cta-pricing-home-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {pkg.cta}
              </Link>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mt-10" delay={500}>
          <Link
            href="/preise"
            className="text-sm font-semibold hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Alle Pakete im Detail vergleichen &rarr;
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
