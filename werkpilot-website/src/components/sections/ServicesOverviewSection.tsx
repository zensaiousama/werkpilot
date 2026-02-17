import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';

const services = [
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Kunden gewinnen',
    price: 'CHF 2\'000/Mo',
    features: ['SEO & Content Marketing', 'Social Media Management', 'Email Marketing', 'Lead Generation'],
    link: '/dienstleistungen/kunden-gewinnen',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M13 10V3L4 14h7v7l9-11h-7z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Effizienz',
    price: 'CHF 1\'500/Mo',
    features: ['Prozess-Automation', 'Kommunikation', 'Reporting & Analytics', 'Workflow-Optimierung'],
    link: '/dienstleistungen/effizienz',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M7 21h10M12 3v18m0 0l-5-5m5 5l5-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Wachstum',
    price: 'CHF 5\'000/Mo',
    features: ['Alles aus Kunden + Effizienz', 'Strategie & Beratung', 'Advanced Analytics', 'Expansion Support'],
    link: '/dienstleistungen/wachstum',
    featured: true,
  },
];

export default function ServicesOverviewSection() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Werkpilot Dienstleistungen',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                item: {
                  '@type': 'Service',
                  name: 'Kunden gewinnen',
                  description: 'SEO, Content Marketing, Social Media Management, Email Marketing und Lead Generation für Schweizer KMUs',
                  provider: { '@type': 'Organization', name: 'Werkpilot' },
                  areaServed: { '@type': 'Country', name: 'Switzerland' },
                  offers: {
                    '@type': 'Offer',
                    price: '2000',
                    priceCurrency: 'CHF',
                    priceSpecification: {
                      '@type': 'UnitPriceSpecification',
                      price: '2000',
                      priceCurrency: 'CHF',
                      unitText: 'MONTH',
                    },
                  },
                },
              },
              {
                '@type': 'ListItem',
                position: 2,
                item: {
                  '@type': 'Service',
                  name: 'Effizienz',
                  description: 'Prozess-Automation, Kommunikation, Reporting und Workflow-Optimierung für Schweizer KMUs',
                  provider: { '@type': 'Organization', name: 'Werkpilot' },
                  areaServed: { '@type': 'Country', name: 'Switzerland' },
                  offers: {
                    '@type': 'Offer',
                    price: '1500',
                    priceCurrency: 'CHF',
                    priceSpecification: {
                      '@type': 'UnitPriceSpecification',
                      price: '1500',
                      priceCurrency: 'CHF',
                      unitText: 'MONTH',
                    },
                  },
                },
              },
              {
                '@type': 'ListItem',
                position: 3,
                item: {
                  '@type': 'Service',
                  name: 'Wachstum',
                  description: 'Alles aus Kunden + Effizienz plus Strategie, Advanced Analytics und Expansion Support',
                  provider: { '@type': 'Organization', name: 'Werkpilot' },
                  areaServed: { '@type': 'Country', name: 'Switzerland' },
                  offers: {
                    '@type': 'Offer',
                    price: '5000',
                    priceCurrency: 'CHF',
                    priceSpecification: {
                      '@type': 'UnitPriceSpecification',
                      price: '5000',
                      priceCurrency: 'CHF',
                      unitText: 'MONTH',
                    },
                  },
                },
              },
            ],
          }),
        }}
      />
      <section className="section" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Unsere Dienstleistungen</h2>
          <p
            className="text-xl mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Wählen Sie das Paket, das zu Ihren Zielen passt
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {services.map((service, index) => (
            <AnimatedSection
              key={index}
              delay={index * 100}
              className="card p-8 relative"
              style={service.featured ? { borderColor: '#2563EB', borderWidth: '2px' } : {}}
            >
              {service.featured && (
                <div
                  className="absolute top-0 right-8 transform -translate-y-1/2 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                >
                  BELIEBT
                </div>
              )}
              <div style={{ color: 'var(--color-accent)' }} className="mb-6">
                {service.icon}
              </div>
              <h3
                className="mb-2"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {service.title}
              </h3>
              <div
                className="text-2xl font-bold mb-6"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-accent)' }}
              >
                {service.price}
              </div>
              <ul className="space-y-3 mb-8">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <svg
                      className="flex-shrink-0 mt-1"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fill="var(--color-success)"
                      />
                    </svg>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href={service.link} className="btn btn-secondary w-full justify-center">
                Mehr erfahren &rarr;
              </Link>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center" delay={400}>
          <Link
            href="/dienstleistungen"
            className="btn btn-primary text-lg"
          >
            Alle Pakete vergleichen &rarr;
          </Link>
        </AnimatedSection>
      </div>
    </section>
    </>
  );
}
