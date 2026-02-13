'use client';

import { useEffect, useState } from 'react';

export default function DeferredAnalytics() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => {
      if (loaded) return;
      setLoaded(true);
    };

    // Load after first user interaction or after 5 seconds
    const events = ['mousedown', 'touchstart', 'scroll', 'keydown'];
    events.forEach((event) => document.addEventListener(event, load, { once: true, passive: true }));
    const timeout = setTimeout(load, 5000);

    return () => {
      events.forEach((event) => document.removeEventListener(event, load));
      clearTimeout(timeout);
    };
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      {/* Plausible Analytics — privacy-friendly, no cookies, GDPR/DSG compliant */}
      {/* Uncomment and add your domain when ready:
      <script
        defer
        data-domain="werkpilot.ch"
        src="https://plausible.io/js/script.js"
      />
      */}

      {/* Microsoft Clarity — free heatmaps */}
      {/* Uncomment and add your project ID when ready:
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/YOUR_PROJECT_ID";
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script");
          `,
        }}
      />
      */}

      {/* Custom event tracking utility */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.wpTrack = function(event, data) {
              if (window.plausible) {
                window.plausible(event, { props: data });
              }
              if (window.clarity) {
                window.clarity('set', event, JSON.stringify(data || {}));
              }
            };

            // Track CTA clicks via data-track attributes
            document.addEventListener('click', function(e) {
              var el = e.target.closest('[data-track]');
              if (el) {
                var trackId = el.getAttribute('data-track');
                if (window.wpTrack) window.wpTrack('cta_click', { id: trackId });
              }
            });

            // Track scroll depth
            var maxScroll = 0;
            window.addEventListener('scroll', function() {
              var pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
              if (pct > maxScroll) {
                maxScroll = pct;
                if ([25, 50, 75, 100].indexOf(maxScroll) !== -1) {
                  if (window.wpTrack) window.wpTrack('scroll_depth', { depth: maxScroll + '%' });
                }
              }
            }, { passive: true });
          `,
        }}
      />
    </>
  );
}
