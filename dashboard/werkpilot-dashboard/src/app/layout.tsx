import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, DM_Sans } from 'next/font/google';
import './globals.css';
import AuthLayoutWrapper from '@/components/AuthLayoutWrapper';
import { ToastProvider } from '@/components/Toast';

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '600', '700'],
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Werkpilot Dashboard',
    template: '%s | Werkpilot',
  },
  description: 'AI-powered Management Dashboard & CRM for Swiss SMEs — 43 autonomous agents working for your business.',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  themeColor: '#0a0d14',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${mono.variable} ${dmSans.variable} antialiased`}>
        <ToastProvider>
          <AuthLayoutWrapper>
            {children}
          </AuthLayoutWrapper>
        </ToastProvider>
      </body>
    </html>
  );
}
