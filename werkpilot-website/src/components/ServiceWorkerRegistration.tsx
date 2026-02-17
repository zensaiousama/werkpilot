/**
 * ServiceWorkerRegistration.tsx
 *
 * Server component that injects a script to register /sw.js
 * with proper scope, update handling, and lifecycle management.
 */

export default function ServiceWorkerRegistration() {
  const swScript = `
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function(registration) {
          // Check for updates on initial load
          registration.update();

          // Listen for new service worker installing
          registration.addEventListener('updatefound', function() {
            var newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available; notify user if needed
                console.log('[SW] New content available. Refresh to update.');

                // Dispatch custom event for UI notification
                window.dispatchEvent(new CustomEvent('sw-update-available', {
                  detail: { registration: registration }
                }));
              }

              if (newWorker.state === 'activated') {
                console.log('[SW] Service worker activated.');
              }
            });
          });

          // Periodic update check every 60 minutes
          setInterval(function() {
            registration.update();
          }, 60 * 60 * 1000);

          console.log('[SW] Registered with scope:', registration.scope);
        })
        .catch(function(error) {
          console.warn('[SW] Registration failed:', error.message);
        });

      // Handle controller change (new SW took over)
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (refreshing) return;
        refreshing = true;
        // Optional: auto-reload on SW update
        // window.location.reload();
      });
    });
  }
})();
`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: swScript }}
      suppressHydrationWarning
    />
  );
}
