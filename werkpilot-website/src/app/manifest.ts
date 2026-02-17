import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Werkpilot',
    short_name: 'Werkpilot',
    description:
      'Mehr Kunden. Weniger Admin. Das virtuelle Backoffice für Schweizer KMUs — Marketing, Sales und Administration aus einer Hand.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#2563EB',
    orientation: 'portrait-primary',
    lang: 'de-CH',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Digital-Fitness-Check',
        short_name: 'Fitness-Check',
        url: '/fitness-check',
        description: 'Gratis Digital-Fitness-Check für Ihr KMU starten',
      },
      {
        name: 'Blog',
        short_name: 'Blog',
        url: '/blog',
        description: 'Tipps und Insights für Schweizer KMUs',
      },
    ],
  };
}
