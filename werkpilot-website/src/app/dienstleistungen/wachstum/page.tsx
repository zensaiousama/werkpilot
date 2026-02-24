import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Wachstum — Werkpilot',
  description:
    'Das Enterprise-Paket für wachsende Unternehmen: Alle 43 AI-Agenten + persönlicher Account Manager + strategisches Consulting. Individuell konfigurierbar. Ab CHF 7\'500/Monat.',
  openGraph: {
    title: 'Wachstum — Werkpilot',
    description: 'Enterprise-Lösung mit allen 43 Agenten + persönlichem Support.',
    images: ['/og-image.png'],
  },
};

const enterpriseFeatures = [
  {
    icon: '🤝',
    title: 'Persönlicher Account Manager',
    description:
      'Ihr dedizierter Ansprechpartner kennt Ihr Geschäft und optimiert kontinuierlich Ihre Prozesse.',
  },
  {
    icon: '📊',
    title: 'Strategisches Business Consulting',
    description:
      'Vierteljährliche Business Reviews und strategische Beratung für nachhaltiges Wachstum.',
  },
  {
    icon: '🔧',
    title: 'Custom AI Agent Development',
    description:
      'Wir entwickeln massgeschneiderte Agenten für Ihre spezifischen Geschäftsprozesse.',
  },
  {
    icon: '🎨',
    title: 'White Label Optionen',
    description:
      'Nutzen Sie Werkpilot unter Ihrer eigenen Marke für Ihre Kunden.',
  },
  {
    icon: '🔌',
    title: 'API Zugang & Integrationen',
    description:
      'Vollständiger API-Zugang und erweiterte Integrationen mit Ihren bestehenden Systemen.',
  },
  {
    icon: '⚡',
    title: 'Prioritäts-Support',
    description:
      '24/7 Prioritäts-Support mit garantierten Reaktionszeiten unter 1 Stunde.',
  },
  {
    icon: '🏢',
    title: 'Multi-Team Management',
    description:
      'Verwalten Sie mehrere Teams, Abteilungen oder Standorte zentral.',
  },
  {
    icon: '🔒',
    title: 'Enterprise Security',
    description:
      'Erweiterte Sicherheitsfeatures, SSO, Audit Logs und Compliance-Unterstützung.',
  },
  {
    icon: '📝',
    title: 'Individuelle SLAs',
    description:
      'Massgeschneiderte Service Level Agreements für Ihre Anforderungen.',
  },
  {
    icon: '🎓',
    title: 'Training & Workshops',
    description:
      'Regelmässige Schulungen für Ihr Team zur optimalen Nutzung des Systems.',
  },
  {
    icon: '🖥️',
    title: 'On-Premise Option',
    description:
      'Hosting in Ihrer eigenen Infrastruktur für maximale Datenkontrolle.',
  },
  {
    icon: '📈',
    title: 'Advanced Analytics & BI',
    description:
      'Tiefgehende Business Intelligence und Custom Reports für datengetriebene Entscheidungen.',
  },
];

const comparisonPackages = [
  {
    name: 'Kunden gewinnen',
    price: 'CHF 1\'500',
    features: ['10 Marketing-Agenten', 'Basic CRM', 'Standard Support'],
  },
  {
    name: 'Effizienz',
    price: 'CHF 3\'500',
    features: [
      'Alle Marketing-Agenten',
      'Backoffice-Automatisierung',
      'Advanced CRM',
      'Priority Support',
    ],
  },
  {
    name: 'Wachstum',
    price: 'Ab CHF 7\'500',
    highlight: true,
    features: [
      'Alle 43 Agenten',
      'Custom Development',
      'Account Manager',
      'Strategic Consulting',
      'Enterprise Features',
      'API Zugang',
      '24/7 Priority Support',
      'Individuelle SLAs',
    ],
  },
];

const useCases = [
  {
    title: 'Skalierung ohne Limit',
    description:
      'Sie wachsen schnell und brauchen eine Infrastruktur, die mitwächst — ohne ständig neues Personal einzustellen.',
    icon: '🚀',
  },
  {
    title: 'Komplexe Prozesse',
    description:
      'Ihre Geschäftsprozesse sind einzigartig und Standard-Software reicht nicht aus. Sie brauchen individuelle Lösungen.',
    icon: '⚙️',
  },
  {
    title: 'Multi-Location',
    description:
      'Sie haben mehrere Standorte oder Teams und brauchen zentrale Kontrolle mit lokaler Flexibilität.',
    icon: '🌍',
  },
  {
    title: 'White Label',
    description:
      'Sie möchten Werkpilot als Service für Ihre eigenen Kunden anbieten — unter Ihrer Marke.',
    icon: '🏷️',
  },
];

const testimonials = [
  {
    quote: 'Als wir von 5 auf 25 Mitarbeiter wuchsen, war Werkpilot der Grund, warum wir die Kontrolle behielten. Der Account Manager versteht unser Business besser als manche unserer Mitarbeiter. Die Custom Agents, die sie für uns entwickelt haben, sind Gold wert.',
    author: 'Michael B.',
    company: 'IT-Dienstleister, Zürich',
  },
  {
    quote: 'Wir nutzen Werkpilot nicht nur intern, sondern bieten es als White Label unseren Kunden an. Das hat uns ein komplett neues Geschäftsfeld eröffnet. Der Support ist erstklassig.',
    author: 'Sandra L.',
    company: 'Business Consulting, Genf',
  },
];

export default function WachstumPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Wachstum Paket',
    description: 'Enterprise-Lösung mit allen 43 AI-Agenten und persönlichem Support',
    brand: {
      '@type': 'Organization',
      name: 'Werkpilot',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CHF',
      price: '7500',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '7500',
        priceCurrency: 'CHF',
        unitText: 'MONTH',
      },
      availability: 'https://schema.org/InStock',
      url: 'https://werkpilot.ch/dienstleistungen/wachstum',
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
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Wachstum',
        item: 'https://werkpilot.ch/dienstleistungen/wachstum',
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
            <div className="max-w-4xl mx-auto">
              <Link
                href="/dienstleistungen"
                className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-accent)' }}
              >
                ← Zurück zu allen Paketen
              </Link>

              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                }}
              >
                ENTERPRISE — FÜR WACHSENDE UNTERNEHMEN
              </div>

              <h1
                className="text-5xl md:text-6xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Wachstum
              </h1>

              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Die Enterprise-Lösung für Unternehmen, die Grosses vorhaben. Alle 43
                AI-Agenten, individuell angepasst auf Ihre Prozesse, mit persönlichem
                Account Manager und strategischem Consulting.
              </p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link href="/kontakt" className="btn btn-primary">
                  Persönliche Demo vereinbaren →
                </Link>
                <Link href="/fitness-check" className="btn btn-secondary">
                  Gratis Fitness-Check
                </Link>
              </div>

              <div className="flex items-center gap-8 flex-wrap">
                <div>
                  <div
                    className="text-4xl font-bold"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Ab CHF 7&apos;500
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    pro Monat, individuell konfigurierbar
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Enterprise Features */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2
                className="text-3xl font-bold mb-4 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Enterprise Features
              </h2>
              <p
                className="text-lg mb-12 text-center max-w-3xl mx-auto"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Alles aus den Paketen &ldquo;Kunden gewinnen&rdquo; und &ldquo;Effizienz&rdquo; plus
                erweiterte Enterprise-Features für maximale Flexibilität und Kontrolle.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enterpriseFeatures.map((feature, idx) => (
                  <div
                    key={idx}
                    className="card p-6"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <div
                      className="text-4xl mb-4"
                      role="img"
                      aria-label={feature.title}
                    >
                      {feature.icon}
                    </div>
                    <h3
                      className="text-lg font-bold mb-2"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Paket-Vergleich
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {comparisonPackages.map((pkg, idx) => (
                  <div
                    key={idx}
                    className={`card p-8 ${pkg.highlight ? 'ring-2' : ''}`}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: pkg.highlight
                        ? 'var(--color-primary)'
                        : 'transparent',
                    }}
                  >
                    {pkg.highlight && (
                      <div
                        className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'white',
                        }}
                      >
                        ENTERPRISE
                      </div>
                    )}

                    <h3
                      className="text-2xl font-bold mb-2"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {pkg.name}
                    </h3>

                    <div
                      className="text-3xl font-bold mb-6"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      {pkg.price}
                    </div>

                    <ul className="space-y-3">
                      {pkg.features.map((feature, featureIdx) => (
                        <li key={featureIdx} className="flex items-start gap-2">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="flex-shrink-0 mt-0.5"
                            aria-hidden="true"
                          >
                            <path
                              d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                              fill="var(--color-success)"
                            />
                          </svg>
                          <span
                            className="text-sm"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Perfekt für
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {useCases.map((useCase, idx) => (
                  <div
                    key={idx}
                    className="card p-8"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <div
                      className="text-4xl mb-4"
                      role="img"
                      aria-label={useCase.title}
                    >
                      {useCase.icon}
                    </div>
                    <h3
                      className="text-xl font-bold mb-3"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {useCase.title}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {useCase.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                So funktioniert der Onboarding-Prozess
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      fontFamily: 'var(--font-jakarta)',
                    }}
                  >
                    1
                  </div>
                  <h3
                    className="text-lg font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Discovery Call
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Persönliches Gespräch zur Analyse Ihrer Anforderungen und Ziele.
                  </p>
                </div>

                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      fontFamily: 'var(--font-jakarta)',
                    }}
                  >
                    2
                  </div>
                  <h3
                    className="text-lg font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Individuelles Angebot
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Wir erstellen ein massgeschneidertes Angebot basierend auf Ihren
                    Bedürfnissen.
                  </p>
                </div>

                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      fontFamily: 'var(--font-jakarta)',
                    }}
                  >
                    3
                  </div>
                  <h3
                    className="text-lg font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Setup & Integration
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Ihr Account Manager übernimmt die komplette Einrichtung. Dauer:
                    1-2 Wochen.
                  </p>
                </div>

                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      fontFamily: 'var(--font-jakarta)',
                    }}
                  >
                    4
                  </div>
                  <h3
                    className="text-lg font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Kontinuierliche Optimierung
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Regelmässige Reviews und Optimierungen für maximale Performance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Was Enterprise-Kunden sagen
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {testimonials.map((testimonial, idx) => (
                  <div
                    key={idx}
                    className="card p-8"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <div className="mb-4">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10C9.1 10 10 9.1 10 8ZM8 14C6.9 14 6 14.9 6 16C6 17.1 6.9 18 8 18C9.1 18 10 17.1 10 16C10 14.9 9.1 14 8 14ZM24 6C22.9 6 22 6.9 22 8C22 9.1 22.9 10 24 10C25.1 10 26 9.1 26 8C26 6.9 25.1 6 24 6ZM24 14C22.9 14 22 14.9 22 16C22 17.1 22.9 18 24 18C25.1 18 26 17.1 26 16C26 14.9 25.1 14 24 14Z"
                          fill="var(--color-accent)"
                          opacity="0.2"
                        />
                      </svg>
                    </div>
                    <p
                      className="text-base mb-6 italic"
                      style={{ color: 'var(--color-text)' }}
                    >
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div>
                      <div
                        className="font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {testimonial.author}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {testimonial.company}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2
                className="text-4xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Bereit für Enterprise-Wachstum?
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Vereinbaren Sie eine persönliche Demo und erfahren Sie, wie
                Werkpilot Ihr Unternehmen auf das nächste Level bringt.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/kontakt" className="btn btn-primary">
                  Persönliche Demo vereinbaren →
                </Link>
                <Link href="/fitness-check" className="btn btn-secondary">
                  Gratis Fitness-Check
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
