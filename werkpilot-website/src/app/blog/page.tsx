import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Blog \u2014 Werkpilot',
  description:
    'Tipps, Insights und Best Practices f\u00fcr Schweizer KMUs. Erfahren Sie, wie Sie Ihr Business mit intelligenten Automatisierungen auf das n\u00e4chste Level bringen.',
  openGraph: {
    title: 'Blog \u2014 Werkpilot',
    description: 'Insights f\u00fcr erfolgreiche KMUs in der Schweiz.',
    images: ['/og-image.png'],
  },
};

const blogPosts = [
  {
    title: 'Warum Schweizer KMUs jetzt auf Automatisierung setzen sollten',
    excerpt:
      'Die Digitalisierung ver\u00e4ndert den Schweizer Markt rasant. Wer heute nicht automatisiert, verliert morgen Kunden an agilere Mitbewerber. Ein \u00dcberblick \u00fcber die wichtigsten Trends und konkrete Schritte f\u00fcr den Einstieg.',
    category: 'Automatisierung',
    readTime: '6 Min. Lesezeit',
    date: '2025-02-10',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Lokales SEO f\u00fcr KMUs: So werden Sie in Ihrer Region gefunden',
    excerpt:
      'Google Business Profile, lokale Keywords, Bewertungen \u2014 lokales SEO ist der schnellste Weg, um in Ihrer Region online sichtbar zu werden. Wir zeigen die wichtigsten Hebel f\u00fcr den Schweizer Markt.',
    category: 'Marketing',
    readTime: '8 Min. Lesezeit',
    date: '2025-01-22',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'AI im Backoffice: Was heute schon m\u00f6glich ist',
    excerpt:
      'K\u00fcnstliche Intelligenz ist l\u00e4ngst kein Zukunftsthema mehr. Vom automatisierten E-Mail-Management bis zur intelligenten Dokumentenverarbeitung \u2014 ein realistischer Blick auf den aktuellen Stand der Technik.',
    category: 'AI & Technologie',
    readTime: '7 Min. Lesezeit',
    date: '2025-01-08',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Datenschutz in der Schweiz: Was KMUs beim DSG beachten m\u00fcssen',
    excerpt:
      'Das revidierte Datenschutzgesetz (DSG) stellt neue Anforderungen an Schweizer Unternehmen. Wir erkl\u00e4ren die wichtigsten Punkte und wie Sie compliant bleiben \u2014 ohne juristisches Studium.',
    category: 'Compliance',
    readTime: '5 Min. Lesezeit',
    date: '2024-12-15',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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
            description: 'Tipps und Strategien f\u00fcr Schweizer KMUs zu Marketing, Sales und Effizienz.',
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
                Insights, Tipps und Best Practices f&uuml;r erfolgreiche Schweizer KMUs.
                Lernen Sie, wie Sie Ihr Business durch intelligente Automatisierung
                voranbringen.
              </p>
            </div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {blogPosts.map((post, idx) => (
                <article
                  key={idx}
                  className="card p-8 flex flex-col hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  {/* Category & Meta */}
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      <span style={{ color: 'var(--color-accent)' }}>{post.icon}</span>
                      {post.category}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {post.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h2
                    className="text-xl font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {post.title}
                  </h2>

                  {/* Excerpt */}
                  <p
                    className="text-sm leading-relaxed mb-6 flex-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {post.excerpt}
                  </p>

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between pt-4 border-t"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <time
                      dateTime={post.date}
                      className="text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {formatDate(post.date)}
                    </time>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Weiterlesen &rarr;
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2
                className="text-3xl font-bold mb-4"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Keine Insights verpassen
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Erhalten Sie regelm&auml;ssig Tipps und Strategien f&uuml;r die Digitalisierung
                Ihres KMUs &mdash; direkt in Ihr Postfach.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/kontakt" className="btn btn-primary">
                  Newsletter abonnieren &rarr;
                </Link>
                <Link href="/resources" className="btn btn-secondary">
                  Gratis Ressourcen entdecken
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Themen
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div
                  className="card p-6 text-center"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <div className="text-4xl mb-4" role="img" aria-label="Marketing">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto" aria-hidden="true" style={{ color: 'var(--color-accent)' }}>
                      <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Marketing &amp; Sales
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Strategien und Taktiken f&uuml;r mehr Kunden und h&ouml;here Conversion-Rates.
                  </p>
                </div>

                <div
                  className="card p-6 text-center"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <div className="text-4xl mb-4" role="img" aria-label="Automatisierung">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto" aria-hidden="true" style={{ color: 'var(--color-accent)' }}>
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Automatisierung &amp; AI
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Best Practices f&uuml;r die Automatisierung Ihrer Gesch&auml;ftsprozesse.
                  </p>
                </div>

                <div
                  className="card p-6 text-center"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <div className="text-4xl mb-4" role="img" aria-label="Compliance">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto" aria-hidden="true" style={{ color: 'var(--color-accent)' }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Datenschutz &amp; Compliance
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Was Schweizer KMUs beim DSG und der Digitalisierung beachten m&uuml;ssen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-bg)' }}
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
                Statt nur zu lesen &mdash; erleben Sie selbst, wie Werkpilot Ihr Business
                voranbringt. Starten Sie mit unserem kostenlosen Fitness-Check.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/fitness-check" className="btn btn-primary">
                  Gratis Fitness-Check starten &rarr;
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
