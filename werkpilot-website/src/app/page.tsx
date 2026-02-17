import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import HeroSection from '@/components/sections/HeroSection';
import ScrollProgress from '@/components/ScrollProgress';
import ProblemSection from '@/components/sections/ProblemSection';
import { SectionSkeleton } from '@/components/Skeleton';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

// Dynamically import below-the-fold sections with skeleton loaders
const SolutionSection = dynamic(() => import('@/components/sections/SolutionSection'), {
  loading: () => <SectionSkeleton />,
});
const ComparisonSection = dynamic(() => import('@/components/sections/ComparisonSection'), {
  loading: () => <SectionSkeleton />,
});
const PricingSection = dynamic(() => import('@/components/sections/PricingSection'), {
  loading: () => <SectionSkeleton />,
});
const HowItWorksSection = dynamic(() => import('@/components/sections/HowItWorksSection'), {
  loading: () => <SectionSkeleton />,
});
const ResultsSection = dynamic(() => import('@/components/sections/ResultsSection'), {
  loading: () => <SectionSkeleton />,
});
const ServicesOverviewSection = dynamic(
  () => import('@/components/sections/ServicesOverviewSection'),
  {
    loading: () => <SectionSkeleton />,
  }
);
const TrustSection = dynamic(() => import('@/components/sections/TrustSection'), {
  loading: () => <SectionSkeleton />,
});
const TestimonialsSection = dynamic(
  () => import('@/components/sections/TestimonialsSection'),
  {
    loading: () => <SectionSkeleton />,
  }
);
const FAQSection = dynamic(() => import('@/components/sections/FAQSection'), {
  loading: () => <SectionSkeleton />,
});
const FinalCTASection = dynamic(() => import('@/components/sections/FinalCTASection'), {
  loading: () => <SectionSkeleton />,
});

export const metadata: Metadata = {
  title: 'Werkpilot — Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice.',
  description:
    'Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf Ihr Kerngeschäft konzentrieren können. 43 Spezialisten arbeiten 24/7 für Sie. Ab CHF 1\'500/Monat.',
  openGraph: {
    title: 'Werkpilot — Mehr Kunden. Weniger Admin.',
    description: 'Ihr komplettes Backoffice — ohne die Kosten eines Teams.',
  },
  alternates: {
    canonical: 'https://werkpilot.ch',
  },
};

export default function HomePage() {
  const jsonLd = [
    // WebSite with SearchAction
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Werkpilot',
      url: 'https://werkpilot.ch',
      description: 'Das Betriebssystem für Schweizer KMUs — Marketing, Sales und Admin aus einer Hand.',
      inLanguage: 'de-CH',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://werkpilot.ch/blog?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    // Organization
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Werkpilot',
      description: 'Das Betriebssystem für Schweizer KMUs',
      url: 'https://werkpilot.ch',
      logo: 'https://werkpilot.ch/logo.png',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+41-44-555-50-00',
        contactType: 'customer service',
        areaServed: 'CH',
        availableLanguage: ['de', 'fr', 'it', 'en'],
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Bahnhofstrasse 10',
        addressLocality: 'Zürich',
        postalCode: '8001',
        addressRegion: 'ZH',
        addressCountry: 'CH',
      },
      sameAs: ['https://linkedin.com/company/werkpilot'],
      areaServed: {
        '@type': 'Country',
        name: 'Switzerland',
      },
      knowsLanguage: ['de', 'fr', 'it', 'en'],
    },
    // LocalBusiness
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Werkpilot',
      description: 'Virtuelles Backoffice für Schweizer KMUs — Marketing, Sales und Admin aus einer Hand.',
      url: 'https://werkpilot.ch',
      telephone: '+41445555000',
      email: 'info@werkpilot.ch',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Bahnhofstrasse 10',
        addressLocality: 'Zürich',
        postalCode: '8001',
        addressRegion: 'ZH',
        addressCountry: 'CH',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 47.3769,
        longitude: 8.5417,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '18:00',
        },
      ],
      priceRange: 'CHF 1500-7500',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        bestRating: '5',
        ratingCount: '47',
        reviewCount: '47',
      },
    },
    // SoftwareApplication
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Werkpilot',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: [
        {
          '@type': 'Offer',
          name: 'Effizienz',
          price: '1500',
          priceCurrency: 'CHF',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Kunden gewinnen',
          price: '2000',
          priceCurrency: 'CHF',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Wachstum',
          price: '5000',
          priceCurrency: 'CHF',
          priceValidUntil: '2026-12-31',
          availability: 'https://schema.org/InStock',
        },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        bestRating: '5',
        ratingCount: '47',
      },
    },
    // BreadcrumbList
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://werkpilot.ch',
        },
      ],
    },
    // Individual Reviews
    {
      '@context': 'https://schema.org',
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Thomas Müller' },
      reviewBody: 'Seit Werkpilot haben wir endlich Zeit für das, was wir am besten können: Unsere Kunden beraten.',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      itemReviewed: { '@type': 'Organization', name: 'Werkpilot' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Sandra Weber' },
      reviewBody: 'Unser Online-Marketing läuft jetzt komplett automatisiert. Die Anfragen kommen — ohne dass wir uns darum kümmern müssen.',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      itemReviewed: { '@type': 'Organization', name: 'Werkpilot' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Michael Schneider' },
      reviewBody: 'ROI nach 2 Monaten. Das Team ist professionell, schnell und liefert messbare Resultate.',
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      itemReviewed: { '@type': 'Organization', name: 'Werkpilot' },
    },
    // ProfessionalService
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'Werkpilot',
      description: 'Virtuelles Backoffice für Schweizer KMUs — Marketing, Sales, und Administration aus einer Hand.',
      url: 'https://werkpilot.ch',
      telephone: '+41445555000',
      priceRange: 'CHF 1500-7500',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Bahnhofstrasse 10',
        addressLocality: 'Zürich',
        postalCode: '8001',
        addressRegion: 'ZH',
        addressCountry: 'CH',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 47.3769,
        longitude: 8.5417,
      },
      areaServed: [
        { '@type': 'State', name: 'Zürich' },
        { '@type': 'State', name: 'Bern' },
        { '@type': 'State', name: 'Basel' },
        { '@type': 'State', name: 'Luzern' },
        { '@type': 'Country', name: 'Switzerland' },
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Werkpilot Dienstleistungen',
        itemListElement: [
          {
            '@type': 'OfferCatalog',
            name: 'Kunden gewinnen',
            itemListElement: [
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'SEO & Content Marketing' } },
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Social Media Management' } },
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Email Marketing' } },
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Lead Generation' } },
            ],
          },
          {
            '@type': 'OfferCatalog',
            name: 'Effizienz',
            itemListElement: [
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Prozess-Automation' } },
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Reporting & Analytics' } },
              { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Workflow-Optimierung' } },
            ],
          },
        ],
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        bestRating: '5',
        ratingCount: '47',
      },
    },
    // Speakable (for voice search / Google Assistant)
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Werkpilot — Das Betriebssystem für Schweizer KMUs',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '.hero-fade-in p'],
      },
      url: 'https://werkpilot.ch',
    },
    // Event (upcoming webinar / consultation)
    {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Gratis KMU Digital-Strategie Webinar',
      description: 'Lernen Sie, wie Schweizer KMUs mit automatisiertem Marketing mehr Kunden gewinnen.',
      startDate: '2026-03-15T10:00:00+01:00',
      endDate: '2026-03-15T11:00:00+01:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: {
        '@type': 'VirtualLocation',
        url: 'https://werkpilot.ch/kontakt',
      },
      organizer: {
        '@type': 'Organization',
        name: 'Werkpilot',
        url: 'https://werkpilot.ch',
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'CHF',
        availability: 'https://schema.org/InStock',
        url: 'https://werkpilot.ch/kontakt',
      },
      performer: {
        '@type': 'Organization',
        name: 'Werkpilot',
      },
    },
    // Product (for Google Merchant/Shopping)
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Werkpilot Virtuelles Backoffice',
      description: 'Komplettes virtuelles Backoffice für Schweizer KMUs — Marketing, Sales und Admin aus einer Hand.',
      brand: {
        '@type': 'Brand',
        name: 'Werkpilot',
      },
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '1500',
        highPrice: '5000',
        priceCurrency: 'CHF',
        offerCount: '3',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        bestRating: '5',
        ratingCount: '47',
      },
      review: [
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Thomas Müller' },
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          reviewBody: 'Seit Werkpilot haben wir endlich Zeit für unser Kerngeschäft.',
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScrollProgress />
      <Navigation />
      <main id="main-content">
        <HeroSection />
        <SectionErrorBoundary>
          <div className="content-auto">
            <ProblemSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <SolutionSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <ComparisonSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <PricingSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <HowItWorksSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <ResultsSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <ServicesOverviewSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <TrustSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <TestimonialsSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <div className="content-auto">
            <FAQSection />
          </div>
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <FinalCTASection />
        </SectionErrorBoundary>
      </main>
      <Footer />
    </>
  );
}
