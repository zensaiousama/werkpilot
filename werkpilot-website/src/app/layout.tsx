import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import ClientOverlays from "@/components/ClientOverlays";
import SpeculationRules from '@/components/SpeculationRules';
import CriticalPreloads from '@/components/CriticalPreloads';

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "500", "700"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  title: {
    default: "Werkpilot — Das Betriebssystem für Schweizer KMUs",
    template: "%s | Werkpilot",
  },
  description: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice. Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf Ihr Kerngeschäft konzentrieren können.",
  metadataBase: new URL('https://werkpilot.ch'),
  applicationName: 'Werkpilot',
  generator: 'Next.js',
  keywords: [
    'KMU',
    'Schweiz',
    'Backoffice',
    'Marketing',
    'Sales',
    'Automation',
    'Werkpilot',
    'virtuelles Team',
    'KMU Digitalisierung',
    'Online Marketing Schweiz',
    'SEO Schweiz',
    'Lead Generierung',
    'Neukundengewinnung',
    'Backoffice Outsourcing',
    'Digital Marketing KMU',
    'Schweizer KMU Lösung',
  ],
  authors: [
    { name: 'Werkpilot', url: 'https://werkpilot.ch' },
  ],
  creator: 'Werkpilot',
  publisher: 'Werkpilot',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: "Werkpilot — Das Betriebssystem für Schweizer KMUs",
    description: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice. 43 Spezialisten arbeiten 24/7 für Ihr KMU — ab CHF 1'500/Monat.",
    url: "https://werkpilot.ch",
    siteName: "Werkpilot",
    locale: "de_CH",
    type: "website",
    countryName: "Switzerland",
    emails: ["info@werkpilot.ch"],
    phoneNumbers: ["+41445555000"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Werkpilot — Das Betriebssystem für Schweizer KMUs",
    description: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice.",
    creator: "@werkpilot",
    site: "@werkpilot",
  },
  category: 'business',
  classification: 'Business Services',
  alternates: {
    canonical: "https://werkpilot.ch",
    languages: {
      'de-CH': 'https://werkpilot.ch',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-placeholder',
    yandex: 'yandex-verification-placeholder',
    other: {
      'msvalidate.01': ['bing-verification-placeholder'],
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Werkpilot',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.svg" />
        <link rel="dns-prefetch" href="https://plausible.io" />
        <link rel="dns-prefetch" href="https://www.clarity.ms" />
        <meta name="apple-mobile-web-app-title" content="Werkpilot" />
        <CriticalPreloads />
        <SpeculationRules />
      </head>
      <body
        className={`${jakarta.variable} ${dmSans.variable} antialiased`}
      >
        <a href="#main-content" className="skip-to-content">
          Zum Hauptinhalt springen
        </a>
        {children}
        <ClientOverlays />
      </body>
    </html>
  );
}
