import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Gratis Ressourcen f\u00fcr Schweizer KMUs \u2014 Werkpilot',
  description:
    'Kostenlose Checklisten, Guides und Tools f\u00fcr Schweizer KMUs. Lernen Sie, wie Sie online mehr Kunden gewinnen, effizienter arbeiten und Ihr Business skalieren.',
  openGraph: {
    title: 'Gratis Ressourcen \u2014 Werkpilot',
    description: 'Kostenlose Checklisten und Guides f\u00fcr Schweizer KMUs.',
    images: ['/og-image.png'],
  },
};

const resources = [
  {
    title: '7 Fehler, die Schweizer KMUs online Kunden kosten',
    description:
      'Die h\u00e4ufigsten Fehler auf KMU-Websites \u2014 und wie Sie sie vermeiden. Inkl. konkreter Checkliste zum Abhaken.',
    type: 'Checkliste',
    pages: '12 Seiten',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: 'var(--color-warm)',
  },
  {
    title: 'SEO-Guide f\u00fcr lokale Schweizer Unternehmen',
    description:
      'Schritt-f\u00fcr-Schritt Anleitung, wie Sie bei Google auf Seite 1 kommen \u2014 speziell f\u00fcr den Schweizer Markt. Von Keywords bis Google Business Profile.',
    type: 'Guide',
    pages: '24 Seiten',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: 'var(--color-accent)',
  },
  {
    title: 'ROI-Rechner: Lohnt sich digitales Marketing f\u00fcr mein KMU?',
    description:
      'Berechnen Sie in 5 Minuten, wie viel Umsatz Ihnen digitales Marketing zus\u00e4tzlich bringen k\u00f6nnte. Basierend auf echten Schweizer Branchendaten.',
    type: 'Tool',
    pages: 'Online-Rechner',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: 'var(--color-success)',
  },
  {
    title: 'Social Media Vorlagen f\u00fcr KMUs (30 Posts)',
    description:
      '30 fix-fertige Social Media Posts zum Anpassen: LinkedIn, Instagram, Facebook. Inkl. Hashtags und optimale Posting-Zeiten f\u00fcr die Schweiz.',
    type: 'Vorlagen',
    pages: '30 Posts',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: 'var(--color-primary)',
  },
];

export default function ResourcesPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://werkpilot.ch' },
      { '@type': 'ListItem', position: 2, name: 'Ressourcen', item: 'https://werkpilot.ch/resources' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Navigation />
      <main id="main-content">
        <Breadcrumbs items={[{ label: 'Ressourcen' }]} />

        {/* Hero */}
        <section className="pt-8 pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1
                className="text-5xl md:text-6xl font-bold mb-6"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                Gratis Ressourcen
              </h1>
              <p className="text-xl mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Praxiswissen f&uuml;r Schweizer KMUs &mdash; kostenlos und ohne Haken.
              </p>
              <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
                Alle Ressourcen basieren auf unserer Erfahrung mit Schweizer KMUs und aktuellen Marktdaten.
              </p>
            </div>
          </div>
        </section>

        {/* Resources Grid */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {resources.map((resource, idx) => (
                <div
                  key={idx}
                  className="card p-8 flex flex-col"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: resource.color, opacity: 0.12 }}
                    >
                      <div style={{ color: resource.color }}>
                        {resource.icon}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                        >
                          {resource.type}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {resource.pages}
                        </span>
                      </div>
                      <h2
                        className="text-lg font-bold"
                        style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                      >
                        {resource.title}
                      </h2>
                    </div>
                  </div>

                  <p className="text-sm mb-6 flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {resource.description}
                  </p>

                  <Link
                    href="/fitness-check"
                    className="btn btn-secondary w-full justify-center text-sm"
                    data-track={`resource-download-${idx}`}
                  >
                    Kostenlos herunterladen &rarr;
                  </Link>
                  <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Email-Adresse f&uuml;r den Download erforderlich
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2
                className="text-3xl font-bold mb-6"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                Lieber gleich wissen, wo Sie stehen?
              </h2>
              <p className="text-lg mb-8" style={{ color: 'var(--color-text-secondary)' }}>
                Unser Digital-Fitness-Check analysiert Ihre gesamte Online-Pr&auml;senz und
                liefert einen massgeschneiderten Report mit konkreten Handlungsempfehlungen.
              </p>
              <Link href="/fitness-check" className="btn btn-primary" data-track="cta-resources-bottom">
                Gratis Fitness-Check starten &rarr;
              </Link>
              <p className="text-xs mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                Kostenlos &middot; 2 Minuten &middot; Unverbindlich
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
