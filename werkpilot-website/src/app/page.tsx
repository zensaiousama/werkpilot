import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import HeroSection from '@/components/sections/HeroSection';

// Dynamically import below-the-fold sections to improve LCP
const ProblemSection = dynamic(() => import('@/components/sections/ProblemSection'), {
  loading: () => <div style={{ minHeight: '400px' }} />,
});
const SolutionSection = dynamic(() => import('@/components/sections/SolutionSection'), {
  loading: () => <div style={{ minHeight: '400px' }} />,
});
const HowItWorksSection = dynamic(() => import('@/components/sections/HowItWorksSection'), {
  loading: () => <div style={{ minHeight: '400px' }} />,
});
const ResultsSection = dynamic(() => import('@/components/sections/ResultsSection'), {
  loading: () => <div style={{ minHeight: '400px' }} />,
});
const ServicesOverviewSection = dynamic(
  () => import('@/components/sections/ServicesOverviewSection'),
  {
    loading: () => <div style={{ minHeight: '400px' }} />,
  }
);
const TrustSection = dynamic(() => import('@/components/sections/TrustSection'), {
  loading: () => <div style={{ minHeight: '300px' }} />,
});
const FAQSection = dynamic(() => import('@/components/sections/FAQSection'), {
  loading: () => <div style={{ minHeight: '400px' }} />,
});
const FinalCTASection = dynamic(() => import('@/components/sections/FinalCTASection'), {
  loading: () => <div style={{ minHeight: '300px' }} />,
});

export const metadata: Metadata = {
  title: 'Werkpilot — Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice.',
  description:
    'Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf Ihr Kerngeschäft konzentrieren können. 43 Spezialisten arbeiten 24/7 für Sie. Ab CHF 1\'500/Monat.',
  openGraph: {
    title: 'Werkpilot — Mehr Kunden. Weniger Admin.',
    description: 'Ihr komplettes Backoffice — ohne die Kosten eines Teams.',
    images: ['/og-image.png'],
  },
};

export default function HomePage() {
  const jsonLd = {
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
      addressCountry: 'CH',
    },
    sameAs: ['https://linkedin.com/company/werkpilot'],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navigation />
      <main id="main-content">
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <ResultsSection />
        <ServicesOverviewSection />
        <TrustSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  );
}
