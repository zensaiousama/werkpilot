import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Werkpilot — Das Betriebssystem für Schweizer KMUs",
  description: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice. Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf Ihr Kerngeschäft konzentrieren können.",
  metadataBase: new URL('https://werkpilot.ch'),
  openGraph: {
    title: "Werkpilot — Das Betriebssystem für Schweizer KMUs",
    description: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice.",
    url: "https://werkpilot.ch",
    siteName: "Werkpilot",
    locale: "de_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Werkpilot — Das Betriebssystem für Schweizer KMUs",
    description: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice.",
  },
  alternates: {
    canonical: "https://werkpilot.ch",
    languages: {
      'de-CH': 'https://werkpilot.ch',
      'fr-CH': 'https://werkpilot.ch/fr',
      'it-CH': 'https://werkpilot.ch/it',
      'en': 'https://werkpilot.ch/en',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head />
      <body
        className={`${jakarta.variable} ${dmSans.variable} antialiased`}
      >
        <a href="#main-content" className="skip-to-content">
          Zum Hauptinhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
