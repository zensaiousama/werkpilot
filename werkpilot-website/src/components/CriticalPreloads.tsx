export default function CriticalPreloads() {
  return (
    <>
      {/* Preload critical above-the-fold font weights */}
      <link
        rel="preload"
        href="/_next/static/media/plus-jakarta-sans-latin-800-normal.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      {/* Prefetch high-priority pages */}
      <link rel="prefetch" href="/fitness-check" />
      <link rel="prefetch" href="/dienstleistungen" />
      {/* Preconnect to analytics */}
      <link rel="preconnect" href="https://plausible.io" crossOrigin="anonymous" />
    </>
  );
}
