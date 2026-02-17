import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import BlogSearch from '@/components/BlogSearch';

export const metadata: Metadata = {
  title: 'Blog — Werkpilot',
  description:
    'Tipps, Insights und Best Practices für Schweizer KMUs. Erfahren Sie, wie Sie Ihr Business mit intelligenten Automatisierungen auf das nächste Level bringen.',
  openGraph: {
    title: 'Blog — Werkpilot',
    description: 'Insights für erfolgreiche KMUs in der Schweiz.',
    images: ['/og-image.png'],
  },
};

export default function BlogPage() {
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
        name: 'Blog',
        item: 'https://werkpilot.ch/blog',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Werkpilot Blog',
            description: 'Tipps und Strategien für Schweizer KMUs zu Marketing, Sales und Effizienz.',
            url: 'https://werkpilot.ch/blog',
            publisher: {
              '@type': 'Organization',
              name: 'Werkpilot',
              url: 'https://werkpilot.ch',
            },
            inLanguage: 'de-CH',
          }),
        }}
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
                Blog
              </h1>
              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Insights, Tipps und Best Practices für erfolgreiche Schweizer KMUs.
                Lernen Sie, wie Sie Ihr Business durch intelligente Automatisierung
                voranbringen.
              </p>
              <BlogSearch />
            </div>
          </div>
        </section>

        {/* Empty State */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M8 8h48v40H8V8z"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 16h32M16 24h32M16 32h24"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20 56l12-8 12 8"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h2
                className="text-3xl font-bold mb-4"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Bald verfügbar
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Wir arbeiten gerade an spannenden Inhalten für Sie. Melden Sie sich
                für unseren Newsletter an und erfahren Sie als Erster, wenn neue
                Artikel erscheinen.
              </p>

              <div
                className="card p-8 max-w-md mx-auto"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <h3
                  className="text-xl font-bold mb-4"
                  style={{
                    fontFamily: 'var(--font-jakarta)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Kommende Themen
                </h3>
                <ul className="space-y-3 text-left">
                  <li className="flex items-start gap-3">
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
                        fill="var(--color-accent)"
                      />
                    </svg>
                    <span
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      5 Wege, wie AI Ihr Marketing automatisiert
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
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
                        fill="var(--color-accent)"
                      />
                    </svg>
                    <span
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      So sparen Schweizer KMUs 10h pro Woche
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
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
                        fill="var(--color-accent)"
                      />
                    </svg>
                    <span
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Lead-Generierung: Von 10 zu 100 Anfragen
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
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
                        fill="var(--color-accent)"
                      />
                    </svg>
                    <span
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Backoffice-Automatisierung: Die komplette Anleitung
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
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
                        fill="var(--color-accent)"
                      />
                    </svg>
                    <span
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Case Studies: Erfolgsgeschichten unserer Kunden
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Preview */}
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
                Geplante Kategorien
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div
                  className="card p-6 text-center"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="text-4xl mb-4" role="img" aria-label="Marketing">
                    📈
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Marketing & Sales
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Strategien und Taktiken für mehr Kunden und höhere Conversion-Rates.
                  </p>
                </div>

                <div
                  className="card p-6 text-center"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="text-4xl mb-4" role="img" aria-label="Automatisierung">
                    ⚡
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Automatisierung
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Best Practices für die Automatisierung Ihrer Geschäftsprozesse.
                  </p>
                </div>

                <div
                  className="card p-6 text-center"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="text-4xl mb-4" role="img" aria-label="Wachstum">
                    🚀
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Wachstum & Skalierung
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Wie Sie Ihr KMU nachhaltig und profitabel skalieren.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2
                className="text-4xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Lieber direkt durchstarten?
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Statt nur zu lesen — erleben Sie selbst, wie Werkpilot Ihr Business
                transformiert. Starten Sie mit unserem kostenlosen Fitness-Check.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/fitness-check" className="btn btn-primary">
                  Gratis Fitness-Check starten →
                </Link>
                <Link href="/dienstleistungen" className="btn btn-secondary">
                  Unsere Dienstleistungen
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
