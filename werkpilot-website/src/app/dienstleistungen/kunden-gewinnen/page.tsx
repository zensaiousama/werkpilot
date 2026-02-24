import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Kunden gewinnen — Werkpilot',
  description:
    'Das perfekte Starter-Paket für KMUs: Google Ads, Lead-Generierung, Content Marketing, SEO und mehr. 10 AI-Agenten arbeiten 24/7 für Ihr Marketing. Ab CHF 1\'500/Monat.',
  openGraph: {
    title: 'Kunden gewinnen — Werkpilot',
    description: 'Ihr Marketing-Team auf Autopilot. 10 Spezialisten für CHF 1\'500/Monat.',
    images: ['/og-image.png'],
  },
};

const agents = [
  {
    name: 'Google Ads Manager',
    icon: '🎯',
    description: 'Erstellt, optimiert und verwaltet Ihre Google Ads Kampagnen. Automatisches Bid-Management und A/B-Testing.',
  },
  {
    name: 'Lead Generator',
    icon: '🔍',
    description: 'Findet und qualifiziert potenzielle Kunden basierend auf Ihrem Idealkunden-Profil. Automatische Outreach-Kampagnen.',
  },
  {
    name: 'Content Creator',
    icon: '✍️',
    description: 'Erstellt hochwertige Blog-Posts, Social Media Content und Newsletter. SEO-optimiert und markenkonform.',
  },
  {
    name: 'SEO Specialist',
    icon: '📈',
    description: 'Keyword-Recherche, On-Page-Optimierung und technisches SEO. Monatliche Rankings und Verbesserungsvorschläge.',
  },
  {
    name: 'Email Marketer',
    icon: '📧',
    description: 'Automatisierte Email-Kampagnen, Drip-Sequences und Newsletter. Personalisiert und performance-optimiert.',
  },
  {
    name: 'Social Media Manager',
    icon: '📱',
    description: 'Plant, erstellt und published Social Media Posts. Community Management und Engagement-Tracking.',
  },
  {
    name: 'Conversion Optimizer',
    icon: '⚡',
    description: 'Analysiert User-Verhalten und optimiert Ihre Conversion-Rates. A/B-Tests und Heatmap-Analysen.',
  },
  {
    name: 'Landing Page Builder',
    icon: '🎨',
    description: 'Erstellt conversion-optimierte Landing Pages. Responsiv, schnell und A/B-Test-fähig.',
  },
  {
    name: 'CRM Basic',
    icon: '👥',
    description: 'Verwaltet Ihre Kontakte und Lead-Pipeline. Automatische Follow-ups und Status-Updates.',
  },
  {
    name: 'Reporting Dashboard',
    icon: '📊',
    description: 'Echtzeit-Dashboard mit allen wichtigen KPIs. Wöchentliche Reports und Performance-Insights.',
  },
];

const results = [
  {
    metric: '+240%',
    label: 'Mehr qualifizierte Leads',
  },
  {
    metric: '-60%',
    label: 'Weniger Zeit für Marketing',
  },
  {
    metric: '+180%',
    label: 'ROI nach 6 Monaten',
  },
];

const testimonials = [
  {
    quote: 'Werkpilot hat uns geholfen, in 3 Monaten mehr Leads zu generieren als im ganzen letzten Jahr. Das System läuft komplett automatisch.',
    author: 'Stefan M.',
    company: 'Sanitärbetrieb, Zürich',
  },
  {
    quote: 'Ich habe endlich Zeit für mein Kerngeschäft. Das Marketing läuft von selbst und die Qualität der Leads ist deutlich besser.',
    author: 'Andrea K.',
    company: 'Coiffeur-Salon, Bern',
  },
];

export default function KundenGewinnenPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Kunden gewinnen Paket',
    description: 'Marketing-Automatisierung für Schweizer KMUs mit 10 AI-Agenten',
    brand: {
      '@type': 'Organization',
      name: 'Werkpilot',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CHF',
      price: '1500',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '1500',
        priceCurrency: 'CHF',
        unitText: 'MONTH',
      },
      availability: 'https://schema.org/InStock',
      url: 'https://werkpilot.ch/dienstleistungen/kunden-gewinnen',
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
        name: 'Kunden gewinnen',
        item: 'https://werkpilot.ch/dienstleistungen/kunden-gewinnen',
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
                  backgroundColor: 'var(--color-warm)',
                  color: 'white',
                }}
              >
                FÜR STARTUPS & EINZELUNTERNEHMEN
              </div>

              <h1
                className="text-5xl md:text-6xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Kunden gewinnen
              </h1>

              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Ihr komplettes Marketing-Team auf Autopilot. 10 spezialisierte
                AI-Agenten gewinnen rund um die Uhr Kunden für Sie — während Sie sich
                auf Ihr Kerngeschäft konzentrieren.
              </p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link href="/fitness-check" className="btn btn-primary">
                  Gratis Fitness-Check starten →
                </Link>
                <Link href="/preise" className="btn btn-secondary">
                  Preise ansehen
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
                    CHF 1&apos;500
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    pro Monat, keine Setup-Gebühr
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                      fill="var(--color-success)"
                    />
                  </svg>
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Monatlich kündbar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
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
                Messbare Resultate
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className="card p-8 text-center"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <div
                      className="text-5xl font-bold mb-2"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-success)',
                      }}
                    >
                      {result.metric}
                    </div>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {result.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Agents Section */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2
                className="text-3xl font-bold mb-4 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Ihre 10 Marketing-Spezialisten
              </h2>
              <p
                className="text-lg mb-12 text-center max-w-3xl mx-auto"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Jeder Agent ist auf eine spezifische Aufgabe spezialisiert und
                arbeitet 24/7 für Sie. Kein Urlaub, keine Krankheit, keine
                Überstunden.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agents.map((agent, idx) => (
                  <div
                    key={idx}
                    className="card p-6"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="text-4xl flex-shrink-0"
                        role="img"
                        aria-label={agent.name}
                      >
                        {agent.icon}
                      </div>
                      <div>
                        <h3
                          className="text-lg font-bold mb-2"
                          style={{
                            fontFamily: 'var(--font-jakarta)',
                            color: 'var(--color-primary)',
                          }}
                        >
                          {agent.name}
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {agent.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
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
                So funktioniert&apos;s
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                    className="text-xl font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Fitness-Check
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    5 Minuten Fragebogen zu Ihrer aktuellen Situation und Ihren
                    Zielen.
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
                    className="text-xl font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Setup
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Wir konfigurieren Ihre Agenten und verbinden sie mit Ihren
                    Systemen. Dauer: 2-3 Tage.
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
                    className="text-xl font-bold mb-3"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Autopilot
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Ihre Agenten arbeiten 24/7. Sie erhalten wöchentliche Reports
                    und können jederzeit eingreifen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
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
                Was unsere Kunden sagen
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {testimonials.map((testimonial, idx) => (
                  <div
                    key={idx}
                    className="card p-8"
                    style={{ backgroundColor: 'var(--color-surface)' }}
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

        {/* FAQ Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Häufige Fragen
              </h2>

              <div className="space-y-6">
                <div
                  className="card p-6"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Wie schnell sehe ich erste Resultate?
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Die meisten Kunden sehen erste Leads innerhalb von 2-4 Wochen.
                    Nachhaltige Ergebnisse entwickeln sich über 3-6 Monate.
                  </p>
                </div>

                <div
                  className="card p-6"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Kann ich später auf ein grösseres Paket upgraden?
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Ja, jederzeit. Sie können monatlich zwischen den Paketen
                    wechseln, je nach Ihren Bedürfnissen.
                  </p>
                </div>

                <div
                  className="card p-6"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h3
                    className="text-lg font-bold mb-2"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Funktioniert das auch für meine Branche?
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Werkpilot arbeitet erfolgreich mit Handwerkern, Beratern,
                    Dienstleistern, Shops und vielen weiteren Branchen. Im
                    Fitness-Check prüfen wir, ob wir die richtige Lösung für Sie
                    sind.
                  </p>
                </div>
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
                Bereit, mehr Kunden zu gewinnen?
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Starten Sie mit unserem kostenlosen Fitness-Check und erhalten Sie
                eine persönliche Empfehlung.
              </p>
              <Link href="/fitness-check" className="btn btn-primary">
                Gratis Fitness-Check starten →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
