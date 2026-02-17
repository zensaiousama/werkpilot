import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Dienstleistungen — Werkpilot',
  description:
    'Wählen Sie das passende Paket für Ihr KMU: Kunden gewinnen, Effizienz steigern oder Wachstum skalieren. Unsere AI-gestützten Lösungen arbeiten 24/7 für Sie.',
  openGraph: {
    title: 'Dienstleistungen — Werkpilot',
    description: 'Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://werkpilot.ch/dienstleistungen',
  },
};

const packages = [
  {
    name: 'Kunden gewinnen',
    slug: 'kunden-gewinnen',
    tagline: 'Für Startups & Einzelunternehmen',
    price: 'CHF 1\'500',
    period: 'pro Monat',
    description: 'Alles, was Sie brauchen, um Ihre ersten Kunden zu gewinnen und Ihr Marketing zu automatisieren.',
    features: [
      { name: 'Google Ads Manager', included: true },
      { name: 'Lead Generator', included: true },
      { name: 'Content Creator', included: true },
      { name: 'SEO Specialist', included: true },
      { name: 'Email Marketer', included: true },
      { name: 'Social Media Manager', included: true },
      { name: 'Conversion Optimizer', included: true },
      { name: 'Landing Page Builder', included: true },
      { name: 'CRM Basic', included: true },
      { name: 'Reporting Dashboard', included: true },
      { name: 'Customer Support Agent', included: false },
      { name: 'Document Manager', included: false },
      { name: 'Invoice Automation', included: false },
      { name: 'Team Coordinator', included: false },
      { name: 'Advanced Analytics', included: false },
    ],
    highlight: false,
  },
  {
    name: 'Effizienz',
    slug: 'effizienz',
    tagline: 'Für etablierte KMUs',
    price: 'CHF 3\'500',
    period: 'pro Monat',
    description: 'Alles aus "Kunden gewinnen" + vollständige Backoffice-Automatisierung für maximale Effizienz.',
    features: [
      { name: 'Google Ads Manager', included: true },
      { name: 'Lead Generator', included: true },
      { name: 'Content Creator', included: true },
      { name: 'SEO Specialist', included: true },
      { name: 'Email Marketer', included: true },
      { name: 'Social Media Manager', included: true },
      { name: 'Conversion Optimizer', included: true },
      { name: 'Landing Page Builder', included: true },
      { name: 'CRM Advanced', included: true },
      { name: 'Reporting Dashboard', included: true },
      { name: 'Customer Support Agent', included: true },
      { name: 'Document Manager', included: true },
      { name: 'Invoice Automation', included: true },
      { name: 'Team Coordinator', included: true },
      { name: 'Advanced Analytics', included: true },
    ],
    highlight: true,
  },
  {
    name: 'Wachstum',
    slug: 'wachstum',
    tagline: 'Für wachsende Unternehmen',
    price: 'Ab CHF 7\'500',
    period: 'pro Monat',
    description: 'Alle 43 Agenten + maßgeschneiderte Strategien, Consulting und persönlicher Account Manager.',
    features: [
      { name: 'Alle Agenten aus "Effizienz"', included: true },
      { name: 'Custom AI Agent Development', included: true },
      { name: 'Persönlicher Account Manager', included: true },
      { name: 'Strategisches Business Consulting', included: true },
      { name: 'White Label Optionen', included: true },
      { name: 'API Zugang', included: true },
      { name: 'Prioritäts-Support', included: true },
      { name: 'Erweiterte Integrationen', included: true },
      { name: 'Multi-Team Management', included: true },
      { name: 'Enterprise Security', included: true },
      { name: 'Individuelle SLAs', included: true },
      { name: 'Quarterly Business Reviews', included: true },
      { name: 'Dedizierte Infrastruktur', included: true },
      { name: 'On-Premise Option', included: true },
      { name: 'Training & Workshops', included: true },
    ],
    highlight: false,
  },
];

export default function DienstleistungenPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Business Automation and Marketing Services',
    provider: {
      '@type': 'Organization',
      name: 'Werkpilot',
      url: 'https://werkpilot.ch',
    },
    areaServed: 'CH',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://werkpilot.ch/fitness-check',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://werkpilot.ch',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Dienstleistungen',
        item: 'https://werkpilot.ch/dienstleistungen',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Navigation />
      <main id="main-content">
        {/* Hero Section */}
        <section
          className="pt-32 pb-20"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1
                className="text-5xl md:text-6xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Wählen Sie Ihr Paket
              </h1>
              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Ob Sie Ihre ersten Kunden gewinnen, Prozesse automatisieren oder
                skalieren möchten — wir haben die passende Lösung für Ihr KMU.
              </p>
            </div>
          </div>
        </section>

        {/* Packages Comparison */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {packages.map((pkg) => (
                <div
                  key={pkg.slug}
                  className={`card p-8 flex flex-col ${
                    pkg.highlight ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: pkg.highlight
                      ? 'var(--color-accent)'
                      : 'var(--color-border)',
                  }}
                >
                  {pkg.highlight && (
                    <div
                      className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 self-start"
                      style={{
                        backgroundColor: 'var(--color-accent)',
                        color: 'white',
                      }}
                    >
                      BELIEBTESTE WAHL
                    </div>
                  )}

                  <h2
                    className="text-2xl font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {pkg.name}
                  </h2>

                  <p
                    className="text-sm mb-4"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {pkg.tagline}
                  </p>

                  <div className="mb-6">
                    <div
                      className="text-4xl font-bold mb-1"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {pkg.price}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {pkg.period}
                    </div>
                  </div>

                  <p
                    className="text-sm mb-6"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {pkg.description}
                  </p>

                  <div className="mb-8 flex-grow">
                    <h3
                      className="font-bold text-sm mb-4"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Inkludierte Features:
                    </h3>
                    <ul className="space-y-3">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="flex-shrink-0 mt-0.5"
                            aria-hidden="true"
                          >
                            {feature.included ? (
                              <path
                                d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                                fill="var(--color-success)"
                              />
                            ) : (
                              <path
                                d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm5 13.59L13.59 15 10 11.41 6.41 15 5 13.59 8.59 10 5 6.41 6.41 5 10 8.59 13.59 5 15 6.41 11.41 10 15 13.59z"
                                fill="var(--color-text-secondary)"
                                opacity="0.3"
                              />
                            )}
                          </svg>
                          <span
                            className="text-sm"
                            style={{
                              color: feature.included
                                ? 'var(--color-text)'
                                : 'var(--color-text-secondary)',
                              opacity: feature.included ? 1 : 0.5,
                            }}
                          >
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href={`/dienstleistungen/${pkg.slug}`}
                    className="btn btn-primary w-full text-center justify-center"
                  >
                    Mehr erfahren
                  </Link>
                </div>
              ))}
            </div>

            {/* Additional Info */}
            <div className="max-w-4xl mx-auto mt-16 text-center">
              <h2
                className="text-2xl font-bold mb-4"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Nicht sicher, welches Paket das richtige ist?
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Machen Sie unseren kostenlosen Fitness-Check und erhalten Sie eine
                persönliche Empfehlung basierend auf Ihren Zielen und Ihrer aktuellen
                Situation.
              </p>
              <Link href="/fitness-check" className="btn btn-primary">
                Gratis Fitness-Check starten →
              </Link>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Warum Schweizer KMUs Werkpilot vertrauen
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div
                    className="text-4xl font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-success)',
                    }}
                  >
                    100%
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Schweizer Unternehmen
                  </p>
                </div>
                <div className="text-center">
                  <div
                    className="text-4xl font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-success)',
                    }}
                  >
                    24/7
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Verfügbar, ohne Pause
                  </p>
                </div>
                <div className="text-center">
                  <div
                    className="text-4xl font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-success)',
                    }}
                  >
                    43
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Spezialisierte Agenten
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
