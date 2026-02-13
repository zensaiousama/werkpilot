import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Preise — Werkpilot',
  description:
    'Transparente Preise für Ihr virtuelles Backoffice. Ab CHF 1\'500/Monat. Keine Setup-Gebühren, monatlich kündbar. Vergleichen Sie unsere Pakete und finden Sie die passende Lösung.',
  openGraph: {
    title: 'Preise — Werkpilot',
    description: 'Transparente Preise ab CHF 1\'500/Monat. Monatlich kündbar.',
    images: ['/og-image.png'],
  },
};

const packages = [
  {
    name: 'Kunden gewinnen',
    slug: 'kunden-gewinnen',
    tagline: 'Für Startups & Einzelunternehmen',
    price: '1\'500',
    period: 'pro Monat',
    description: 'Ihr Marketing-Team auf Autopilot',
    features: [
      '10 Marketing-Agenten',
      'Google Ads Management',
      'Lead-Generierung',
      'Content Marketing',
      'SEO & Social Media',
      'Basic CRM',
      'Email Marketing',
      'Reporting Dashboard',
      'Standard Support',
    ],
    cta: 'Paket wählen',
    ctaLink: '/dienstleistungen/kunden-gewinnen',
    highlight: false,
  },
  {
    name: 'Effizienz',
    slug: 'effizienz',
    tagline: 'Für etablierte KMUs',
    price: '3\'500',
    period: 'pro Monat',
    description: 'Komplettes Backoffice automatisiert',
    features: [
      'Alle Features aus "Kunden gewinnen"',
      '20+ Agenten insgesamt',
      '24/7 Customer Support',
      'Automatische Rechnungen',
      'Dokumentenmanagement',
      'Advanced CRM',
      'Team Koordination',
      'Business Analytics',
      'Priority Support',
    ],
    cta: 'Paket wählen',
    ctaLink: '/dienstleistungen/effizienz',
    highlight: true,
  },
  {
    name: 'Wachstum',
    slug: 'wachstum',
    tagline: 'Für wachsende Unternehmen',
    price: 'Ab 7\'500',
    period: 'pro Monat',
    description: 'Enterprise mit persönlichem Support',
    features: [
      'Alle 43 Agenten',
      'Custom AI Development',
      'Persönlicher Account Manager',
      'Strategisches Consulting',
      'White Label Optionen',
      'API Zugang',
      '24/7 Priority Support',
      'Enterprise Security',
      'Individuelle SLAs',
    ],
    cta: 'Kontakt aufnehmen',
    ctaLink: '/kontakt',
    highlight: false,
  },
];

const faqs = [
  {
    question: 'Gibt es Setup-Gebühren oder versteckte Kosten?',
    answer:
      'Nein. Der angezeigte Preis ist alles, was Sie bezahlen. Keine Setup-Gebühren, keine versteckten Kosten, keine Überraschungen.',
  },
  {
    question: 'Wie lange ist die Vertragslaufzeit?',
    answer:
      'Alle Pakete sind monatlich kündbar. Wir glauben an unsere Qualität und möchten Sie mit Ergebnissen überzeugen, nicht mit langen Vertragsbindungen.',
  },
  {
    question: 'Kann ich zwischen Paketen wechseln?',
    answer:
      'Ja, jederzeit. Sie können monatlich upgraden oder downgraden, je nach Ihren aktuellen Bedürfnissen.',
  },
  {
    question: 'Was passiert, wenn ich kündige?',
    answer:
      'Sie können mit einer Frist von 30 Tagen kündigen. Ihre Daten können Sie exportieren und behalten. Wir löschen alles nach 90 Tagen.',
  },
  {
    question: 'Gibt es Rabatte bei jährlicher Zahlung?',
    answer:
      'Ja, bei jährlicher Vorauszahlung erhalten Sie 10% Rabatt. Kontaktieren Sie uns für Details.',
  },
  {
    question: 'Ist eine kostenlose Testphase verfügbar?',
    answer:
      'Wir bieten keine Testphase, aber eine 30-Tage-Geld-zurück-Garantie. Wenn Sie nach dem ersten Monat nicht zufrieden sind, erstatten wir Ihnen die volle Summe.',
  },
];

const comparison = [
  { feature: 'Marketing-Agenten', basic: '10', effizienz: '10+', wachstum: 'Alle 43' },
  { feature: 'Google Ads Management', basic: true, effizienz: true, wachstum: true },
  { feature: 'Lead-Generierung', basic: true, effizienz: true, wachstum: true },
  { feature: 'Content & SEO', basic: true, effizienz: true, wachstum: true },
  { feature: 'Basic CRM', basic: true, effizienz: false, wachstum: false },
  { feature: 'Advanced CRM', basic: false, effizienz: true, wachstum: true },
  { feature: '24/7 Support Agent', basic: false, effizienz: true, wachstum: true },
  { feature: 'Automatische Rechnungen', basic: false, effizienz: true, wachstum: true },
  { feature: 'Dokumentenmanagement', basic: false, effizienz: true, wachstum: true },
  { feature: 'Team Koordination', basic: false, effizienz: true, wachstum: true },
  { feature: 'Business Analytics', basic: false, effizienz: true, wachstum: true },
  { feature: 'Custom AI Development', basic: false, effizienz: false, wachstum: true },
  { feature: 'Account Manager', basic: false, effizienz: false, wachstum: true },
  { feature: 'Strategic Consulting', basic: false, effizienz: false, wachstum: true },
  { feature: 'White Label', basic: false, effizienz: false, wachstum: true },
  { feature: 'API Zugang', basic: false, effizienz: false, wachstum: true },
  { feature: 'Enterprise Security', basic: false, effizienz: false, wachstum: true },
];

export default function PreisePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Business Automation',
    provider: {
      '@type': 'Organization',
      name: 'Werkpilot',
    },
    offers: packages.map((pkg) => ({
      '@type': 'Offer',
      name: pkg.name,
      description: pkg.description,
      price: pkg.price.replace('\'', '').replace('Ab ', ''),
      priceCurrency: 'CHF',
      url: `https://werkpilot.ch${pkg.ctaLink}`,
    })),
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
        name: 'Preise',
        item: 'https://werkpilot.ch/preise',
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
        <Breadcrumbs items={[{ label: 'Preise' }]} />

        {/* Hero Section */}
        <section
          className="pt-8 pb-20"
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
                Transparente Preise
              </h1>
              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Keine Setup-Gebühren. Keine versteckten Kosten. Monatlich kündbar.
                Wählen Sie das Paket, das zu Ihrem Unternehmen passt.
              </p>
              <div className="flex flex-wrap gap-6 justify-center items-center">
                <div className="flex items-center gap-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-1.2 18L3.6 10.8l1.692-1.692L10.8 14.604 18.708 6.696 20.4 8.4 10.8 18z"
                      fill="var(--color-success)"
                    />
                  </svg>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    Monatlich kündbar
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-1.2 18L3.6 10.8l1.692-1.692L10.8 14.604 18.708 6.696 20.4 8.4 10.8 18z"
                      fill="var(--color-success)"
                    />
                  </svg>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    30 Tage Geld-zurück
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm-1.2 18L3.6 10.8l1.692-1.692L10.8 14.604 18.708 6.696 20.4 8.4 10.8 18z"
                      fill="var(--color-success)"
                    />
                  </svg>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    Keine Setup-Gebühren
                  </span>
                </div>
              </div>

              {/* Scarcity Badge */}
              <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'var(--color-success)', opacity: 0.9 }}>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
                <span className="text-white text-sm font-bold">Aktuell 2 Pl&auml;tze frei</span>
                <span className="text-white/80 text-xs">&mdash; Wir nehmen nur 5 neue Kunden pro Monat auf</span>
              </div>
            </div>
          </div>
        </section>

        {/* Cost Comparison (Anchoring) */}
        <section className="py-12" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="card p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
                <h2
                  className="text-2xl font-bold mb-8 text-center"
                  style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                >
                  Werkpilot vs. traditionelle L&ouml;sungen
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Marketing-Mitarbeiter</p>
                    <p className="text-3xl font-bold line-through" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-warm)' }}>
                      CHF 7&apos;000
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>pro Monat + Sozialabgaben</p>
                  </div>
                  <div className="p-6 rounded-xl" style={{ backgroundColor: 'var(--color-surface)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Marketing-Agentur</p>
                    <p className="text-3xl font-bold line-through" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-warm)' }}>
                      CHF 5&apos;000
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>pro Monat + lange Vertr&auml;ge</p>
                  </div>
                  <div className="p-6 rounded-xl ring-2" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-success)' }}>
                    <p className="text-sm font-bold mb-2" style={{ color: 'var(--color-success)' }}>Werkpilot</p>
                    <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-success)' }}>
                      ab CHF 1&apos;500
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>pro Monat, monatlich k&uuml;ndbar</p>
                  </div>
                </div>
                <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-secondary)' }}>
                  43 AI-Spezialisten arbeiten 24/7 f&uuml;r Sie &mdash; f&uuml;r einen Bruchteil der Kosten eines einzelnen Mitarbeiters.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
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
                      : 'transparent',
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
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-2xl font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        CHF
                      </span>
                      <span
                        className="text-5xl font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {pkg.price}
                      </span>
                    </div>
                    <div
                      className="text-sm mt-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {pkg.period}
                    </div>
                  </div>

                  <p
                    className="text-sm mb-6 font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {pkg.description}
                  </p>

                  <Link
                    href={pkg.ctaLink}
                    className={`btn ${
                      pkg.highlight ? 'btn-primary' : 'btn-secondary'
                    } w-full text-center justify-center mb-3`}
                    data-track={`cta-pricing-${pkg.slug}`}
                  >
                    {pkg.cta}
                  </Link>
                  <p className="text-xs text-center mb-8" style={{ color: 'var(--color-text-secondary)' }}>
                    Keine Kreditkarte erforderlich
                  </p>

                  <div className="border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
                    <h3
                      className="font-bold text-sm mb-4"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Inkludiert:
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Detailed Comparison */}
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
                Detaillierter Vergleich
              </h2>

              <div
                className="card overflow-x-auto"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <th
                        className="text-left p-4 font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Feature
                      </th>
                      <th
                        className="text-center p-4 font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Kunden gewinnen
                      </th>
                      <th
                        className="text-center p-4 font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        Effizienz
                      </th>
                      <th
                        className="text-center p-4 font-bold"
                        style={{
                          fontFamily: 'var(--font-jakarta)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        Wachstum
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <td
                          className="p-4 text-sm"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {row.feature}
                        </td>
                        <td className="p-4 text-center">
                          {typeof row.basic === 'boolean' ? (
                            row.basic ? (
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="mx-auto"
                                aria-label="Inkludiert"
                              >
                                <path
                                  d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                                  fill="var(--color-success)"
                                />
                              </svg>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>
                                —
                              </span>
                            )
                          ) : (
                            <span
                              className="text-sm font-medium"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {row.basic}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof row.effizienz === 'boolean' ? (
                            row.effizienz ? (
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="mx-auto"
                                aria-label="Inkludiert"
                              >
                                <path
                                  d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                                  fill="var(--color-success)"
                                />
                              </svg>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>
                                —
                              </span>
                            )
                          ) : (
                            <span
                              className="text-sm font-medium"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {row.effizienz}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof row.wachstum === 'boolean' ? (
                            row.wachstum ? (
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="mx-auto"
                                aria-label="Inkludiert"
                              >
                                <path
                                  d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                                  fill="var(--color-success)"
                                />
                              </svg>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>
                                —
                              </span>
                            )
                          ) : (
                            <span
                              className="text-sm font-medium"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {row.wachstum}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                Häufige Fragen zu Preisen
              </h2>

              <div className="space-y-6">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
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
                      {faq.question}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
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
                Noch nicht sicher?
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Machen Sie unseren kostenlosen Fitness-Check und erhalten Sie eine
                persönliche Empfehlung — ohne Verpflichtung.
              </p>
              <Link href="/fitness-check" className="btn btn-primary" data-track="cta-pricing-bottom">
                Gratis Fitness-Check starten &rarr;
              </Link>
              <p className="text-xs mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                Kostenlos &middot; 2 Minuten &middot; Keine Kreditkarte erforderlich
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
