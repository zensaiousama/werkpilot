const CACHE_VERSION = 'werkpilot-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

const NAVIGATION_ROUTES = [
  '/dienstleistungen',
  '/preise',
  '/ueber-uns',
  '/fitness-check',
  '/kontakt',
  '/blog',
];

// Install — pre-cache critical assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-same-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets (JS, CSS, fonts) — cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests — stale-while-revalidate
  if (request.mode === 'navigate' || NAVIGATION_ROUTES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // Return cached version on network error
            if (cached) return cached;
            // Return offline fallback for navigation requests
            return caches.match('/');
          });

        // Return cached immediately if available, refresh in background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else — network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
