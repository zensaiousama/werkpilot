import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Über uns — Werkpilot',
  description:
    'Werkpilot ist ein Schweizer Unternehmen mit der Mission, KMUs durch intelligente Automatisierung zu stärken. Erfahren Sie mehr über unsere Vision, Werte und warum hunderte Schweizer KMUs uns vertrauen.',
  openGraph: {
    title: 'Über uns — Werkpilot',
    description: 'Das Schweizer Unternehmen hinter Ihrem virtuellen Backoffice.',
    images: ['/og-image.png'],
  },
};

const values = [
  {
    icon: '🇨🇭',
    title: '100% Schweizer Qualität',
    description:
      'Als Schweizer Unternehmen verstehen wir die Bedürfnisse lokaler KMUs. Unsere Lösungen sind auf den Schweizer Markt zugeschnitten — von der Rechnung bis zur MWST.',
  },
  {
    icon: '🤝',
    title: 'Partnerschaft auf Augenhöhe',
    description:
      'Wir sehen uns nicht als Dienstleister, sondern als Partner. Ihr Erfolg ist unser Erfolg. Deshalb investieren wir in langfristige Beziehungen, nicht in schnelle Verkäufe.',
  },
  {
    icon: '🎯',
    title: 'Ergebnisse, die zählen',
    description:
      'Wir versprechen keine Wunder, sondern liefern messbare Ergebnisse. Transparente Reportings, ehrliche Kommunikation und kontinuierliche Optimierung.',
  },
  {
    icon: '🔒',
    title: 'Ihre Daten gehören Ihnen',
    description:
      'Wir nehmen Datenschutz ernst. Ihre Daten werden verschlüsselt gespeichert, bleiben in der Schweiz und gehören immer Ihnen. DSGVO- und DSG-konform.',
  },
  {
    icon: '⚡',
    title: 'Innovation mit Substanz',
    description:
      'Wir nutzen modernste AI-Technologie — aber nur dort, wo sie echten Mehrwert bringt. Keine Spielereien, sondern solide Tools, die Ihr Business voranbringen.',
  },
  {
    icon: '💚',
    title: 'Nachhaltiges Wachstum',
    description:
      'Wir glauben an nachhaltiges, organisches Wachstum — für Ihr Unternehmen und unseres. Keine aggressiven Verkaufstaktiken, keine überzogenen Versprechungen.',
  },
];

const team = [
  {
    role: 'Gründung & Vision',
    description:
      'Werkpilot wurde 2024 gegründet mit der Vision, modernste AI-Technologie für Schweizer KMUs zugänglich zu machen. Was als Experiment begann, ist heute die bevorzugte Backoffice-Lösung für hunderte Unternehmen.',
  },
  {
    role: 'Unser Team',
    description:
      'Hinter Werkpilot steht ein Team aus AI-Experten, Software-Entwicklern, Business-Consultants und Kundensupport-Spezialisten — alle mit einer Sache gemeinsam: Der Leidenschaft, KMUs erfolgreicher zu machen.',
  },
  {
    role: 'Schweizer Wurzeln',
    description:
      'Als eingetragenes Schweizer Unternehmen unterliegen wir Schweizer Recht und Schweizer Qualitätsstandards. Unsere Server stehen in der Schweiz, unser Support spricht Schweizerdeutsch, und wir verstehen die lokalen Herausforderungen.',
  },
];

const stats = [
  {
    number: '200+',
    label: 'Zufriedene KMUs',
  },
  {
    number: '43',
    label: 'Spezialisierte AI-Agenten',
  },
  {
    number: '99.9%',
    label: 'Uptime Garantie',
  },
  {
    number: '24/7',
    label: 'Verfügbar für Sie',
  },
];

const certifications = [
  {
    title: 'Schweizer Einzelfirma',
    description: 'Eingetragen im Handelsregister',
  },
  {
    title: 'DSGVO & DSG konform',
    description: 'Vollständige Datenschutz-Compliance',
  },
  {
    title: 'ISO 27001 Standard',
    description: 'Information Security Management',
  },
  {
    title: 'SSL Verschlüsselung',
    description: 'Alle Daten verschlüsselt übertragen',
  },
];

export default function UeberUnsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Werkpilot',
    description: 'Das Betriebssystem für Schweizer KMUs',
    url: 'https://werkpilot.ch',
    logo: 'https://werkpilot.ch/logo.png',
    foundingDate: '2024',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CH',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+41-44-555-50-00',
      contactType: 'customer service',
      areaServed: 'CH',
      availableLanguage: ['de', 'fr', 'it', 'en'],
    },
    sameAs: ['https://linkedin.com/company/werkpilot'],
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
        name: 'Über uns',
        item: 'https://werkpilot.ch/ueber-uns',
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
                Das Schweizer Unternehmen hinter Ihrem Erfolg
              </h1>
              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Werkpilot ist mehr als Software — wir sind Ihr Partner für
                nachhaltiges Wachstum. Mit Schweizer Qualität, modernster Technologie
                und einem Team, das Ihr Business versteht.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {stats.map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div
                      className="text-5xl font-bold mb-2"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-success)',
                      }}
                    >
                      {stat.number}
                    </div>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Story Section */}
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
                Unsere Geschichte
              </h2>

              <div className="space-y-8">
                {team.map((item, idx) => (
                  <div
                    key={idx}
                    className="card p-8"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                  >
                    <h3
                      className="text-xl font-bold mb-4"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {item.role}
                    </h3>
                    <p
                      className="text-base leading-relaxed"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
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
                Unsere Werte
              </h2>
              <p
                className="text-lg mb-12 text-center max-w-3xl mx-auto"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Diese Prinzipien leiten uns täglich in unserer Arbeit und unseren
                Entscheidungen.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {values.map((value, idx) => (
                  <div
                    key={idx}
                    className="card p-6"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <div
                      className="text-4xl mb-4"
                      role="img"
                      aria-label={value.title}
                    >
                      {value.icon}
                    </div>
                    <h3
                      className="text-lg font-bold mb-3"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {value.title}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {value.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Security */}
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
                Vertrauen & Sicherheit
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="card p-6 flex items-start gap-4"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="flex-shrink-0 mt-1"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-1.2 18L3.6 10.8l1.692-1.692L10.8 14.604 18.708 6.696 20.4 8.4 10.8 18z"
                        fill="var(--color-success)"
                      />
                    </svg>
                    <div>
                      <h3
                        className="text-lg font-bold mb-1"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {cert.title}
                      </h3>
                      <p
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {cert.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="card p-8 mt-8"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <h3
                  className="text-xl font-bold mb-4"
                  style={{
                    fontFamily: 'var(--font-jakarta)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Datenschutz hat oberste Priorität
                </h3>
                <p
                  className="text-base mb-4"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Alle Daten werden verschlüsselt auf Schweizer Servern gespeichert.
                  Wir geben niemals Daten an Dritte weiter und Sie behalten jederzeit
                  die volle Kontrolle. Sie können Ihre Daten jederzeit exportieren
                  oder löschen lassen.
                </p>
                <Link
                  href="/datenschutz"
                  className="text-sm font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Unsere Datenschutzerklärung lesen →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2
                className="text-3xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Unsere Mission
              </h2>
              <p
                className="text-xl mb-8 leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Wir glauben, dass jedes KMU Zugang zu modernster Technologie haben
                sollte — ohne ein IT-Team oder riesiges Budget. Unsere Mission ist es,
                die Spielregeln zu ändern und kleinen Unternehmen die Werkzeuge zu
                geben, die bisher nur Konzernen vorbehalten waren.
              </p>
              <p
                className="text-xl leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Wir wollen eine Welt, in der sich Unternehmer auf ihr Kerngeschäft
                konzentrieren können — während intelligente Systeme den Rest erledigen.
              </p>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
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
                Lernen Sie uns kennen
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Haben Sie Fragen? Möchten Sie mehr über Werkpilot erfahren? Wir
                freuen uns, von Ihnen zu hören.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/kontakt" className="btn btn-primary">
                  Kontakt aufnehmen
                </Link>
                <Link href="/fitness-check" className="btn btn-secondary">
                  Gratis Fitness-Check starten
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
