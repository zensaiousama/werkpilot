import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';
import ROICalculator from '@/components/ROICalculator';

const comparisons = [
  {
    label: 'Mitarbeiter einstellen',
    price: "CHF 7'000",
    period: '/Monat',
    features: ['Gehalt, Sozialleistungen, Büro', 'Rekrutierung dauert 3-6 Monate', 'Einarbeitung & Management nötig', 'Krankheit & Urlaub'],
    highlight: false,
    strikethrough: true,
  },
  {
    label: 'Agentur beauftragen',
    price: "CHF 5'000",
    period: '/Monat',
    features: ['Monatliche Retainer-Gebühr', 'Oft langfristige Verträge', 'Begrenzte Flexibilität', 'Ein Spezialgebiet'],
    highlight: false,
    strikethrough: true,
  },
  {
    label: 'Werkpilot',
    price: "CHF 1'500",
    period: '/Monat',
    features: ['AI-Automatisierung, 24/7 im Einsatz', 'Keine Mindestlaufzeit', 'Sofort einsatzbereit (48h)', 'Marketing + Sales + Admin'],
    highlight: true,
    strikethrough: false,
    badge: 'Die smarte Alternative',
  },
];

export default function ComparisonSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Warum Werkpilot die klügere Wahl ist</h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Vergleichen Sie selbst — und entscheiden Sie sich für die effizienteste Lösung
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {comparisons.map((item, index) => (
            <AnimatedSection
              key={index}
              delay={index * 150}
              className={`rounded-2xl p-8 relative ${item.highlight ? 'card-featured' : ''}`}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: item.highlight ? 'none' : '1px solid var(--color-border)',
                boxShadow: item.highlight ? '0 8px 30px rgba(37, 99, 235, 0.12)' : 'var(--shadow-sm)',
              }}
            >
              {item.badge && (
                <div
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap text-white"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  {item.badge}
                </div>
              )}

              <p
                className="text-sm font-semibold uppercase tracking-wider mb-6"
                style={{ color: item.highlight ? '#2563EB' : 'var(--color-text-secondary)' }}
              >
                {item.label}
              </p>

              <div className="mb-8">
                <span
                  className={item.strikethrough ? 'line-through opacity-40' : ''}
                  style={{
                    fontSize: item.highlight ? '2.75rem' : '2.25rem',
                    fontFamily: 'var(--font-jakarta)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: item.highlight ? '#2563EB' : 'var(--color-text)',
                  }}
                >
                  {item.price}
                </span>
                <span className="text-sm ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.period}
                </span>
              </div>

              <ul className="space-y-3">
                {item.features.map((feature, idx) => (
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
                      {item.highlight ? (
                        <path
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          fill="#059669"
                        />
                      ) : (
                        <path
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          fill="#9CA3AF"
                        />
                      )}
                    </svg>
                    <span style={{ color: item.highlight ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {item.highlight && (
                <Link
                  href="/fitness-check"
                  className="btn btn-primary w-full justify-center mt-8"
                  data-track="cta-comparison"
                >
                  Jetzt starten &rarr;
                </Link>
              )}
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="mt-16 max-w-lg mx-auto" delay={400}>
          <ROICalculator />
        </AnimatedSection>
      </div>
    </section>
  );
}
