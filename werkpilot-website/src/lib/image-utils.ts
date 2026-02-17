/**
 * image-utils.ts
 *
 * Image optimization helpers for responsive loading,
 * placeholder generation, and lazy-load strategy decisions.
 */

// ──────────────────────────────────────────────
// Optimal Image Size
// ──────────────────────────────────────────────

/**
 * Calculate optimal image dimensions for a given container width
 * and device pixel ratio. Rounds up to the nearest standard breakpoint
 * to maximize CDN cache hits.
 */
export function getOptimalImageSize(
  width: number,
  dpr: number = typeof window !== 'undefined' ? window.devicePixelRatio : 1
): { width: number; height: undefined } {
  const physicalWidth = Math.ceil(width * dpr);

  // Standard image widths that maximize CDN/Next.js image cache hits
  const standardWidths = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

  const optimalWidth = standardWidths.find((w) => w >= physicalWidth) ?? standardWidths[standardWidths.length - 1];

  return {
    width: optimalWidth,
    height: undefined, // Let aspect ratio be preserved
  };
}

// ──────────────────────────────────────────────
// Responsive srcSet Generation
// ──────────────────────────────────────────────

/**
 * Generate a responsive srcSet string for an image source.
 * Supports Next.js image loader paths and external URLs.
 *
 * @param src - Base image URL
 * @param widths - Array of widths to include (defaults to common breakpoints)
 * @returns srcSet string for use in <img> or <source> tags
 */
export function generateSrcSet(
  src: string,
  widths: number[] = [640, 750, 828, 1080, 1200, 1920]
): string {
  // If it's a Next.js optimized image path
  if (src.startsWith('/') || src.startsWith('/_next')) {
    return widths
      .map((w) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75 ${w}w`)
      .join(', ');
  }

  // For external URLs, attempt width parameter substitution
  // Support common CDN patterns: width=, w=, resize=
  if (src.includes('{width}')) {
    return widths.map((w) => `${src.replace('{width}', String(w))} ${w}w`).join(', ');
  }

  // Fallback: append width query parameter
  const separator = src.includes('?') ? '&' : '?';
  return widths.map((w) => `${src}${separator}w=${w} ${w}w`).join(', ');
}

// ──────────────────────────────────────────────
// Placeholder Data URL
// ──────────────────────────────────────────────

/**
 * Generate a tiny base64-encoded SVG placeholder with a solid color.
 * Useful as a blurDataURL or immediate placeholder before the real
 * image loads — avoids layout shift without any network requests.
 *
 * @param width - Placeholder width (default 4)
 * @param height - Placeholder height (default 3)
 * @param color - CSS color string (default light gray)
 * @returns Base64 data URL
 */
export function getPlaceholderDataUrl(
  width: number = 4,
  height: number = 3,
  color: string = '#e2e8f0'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`;

  if (typeof Buffer !== 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  // Browser fallback
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ──────────────────────────────────────────────
// BlurHash Placeholder
// ──────────────────────────────────────────────

/**
 * Generate a lightweight blur-hash style placeholder.
 * This creates a tiny canvas-based blurred preview using
 * a CSS gradient approximation (no external library needed).
 *
 * For a true BlurHash, you would decode a BlurHash string from
 * your image pipeline. This function provides a simulated blur
 * placeholder using a low-res SVG with gaussian blur.
 *
 * @param src - Source image URL (used to derive a deterministic color)
 * @param width - Placeholder width (default 32)
 * @param height - Placeholder height (default 32)
 * @returns Base64 data URL of a blurred SVG placeholder
 */
export function generateBlurHash(
  src: string,
  width: number = 32,
  height: number = 32
): string {
  // Generate a deterministic color from the source string
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const char = src.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  const r = (hash & 0xff0000) >> 16;
  const g = (hash & 0x00ff00) >> 8;
  const b = hash & 0x0000ff;

  // Slight variation for gradient effect
  const r2 = Math.min(255, r + 40);
  const g2 = Math.min(255, g + 40);
  const b2 = Math.min(255, b + 40);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(${r},${g},${b})"/>
        <stop offset="100%" style="stop-color:rgb(${r2},${g2},${b2})"/>
      </linearGradient>
      <filter id="b"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)" filter="url(#b)"/>
  </svg>`;

  const cleaned = svg.replace(/\n\s*/g, '');

  if (typeof Buffer !== 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(cleaned).toString('base64')}`;
  }

  return `data:image/svg+xml;base64,${btoa(cleaned)}`;
}

// ──────────────────────────────────────────────
// Lazy Load Strategy
// ──────────────────────────────────────────────

/**
 * Determine whether an image should be lazy-loaded based on its
 * position in the page and priority flag.
 *
 * Rules:
 * - Priority images (e.g. hero) are never lazy-loaded
 * - First 2 images above the fold are eager-loaded
 * - Everything else is lazy-loaded
 *
 * @param index - The image's position index on the page (0-based)
 * @param priority - Explicit priority override
 * @returns true if the image should use loading="lazy"
 */
export function shouldLazyLoad(index: number, priority: boolean = false): boolean {
  // Priority images are always eagerly loaded
  if (priority) return false;

  // First 2 images are assumed above the fold
  if (index < 2) return false;

  // Everything else is lazy-loaded
  return true;
}

// ──────────────────────────────────────────────
// Convenience: full image props helper
// ──────────────────────────────────────────────

export interface OptimizedImageProps {
  loading: 'lazy' | 'eager';
  decoding: 'async' | 'sync';
  fetchPriority: 'high' | 'low' | 'auto';
  placeholder: string;
}

/**
 * Get a complete set of optimized image attributes for an <img> tag.
 */
export function getOptimizedImageProps(
  src: string,
  index: number,
  priority: boolean = false
): OptimizedImageProps {
  const lazy = shouldLazyLoad(index, priority);

  return {
    loading: lazy ? 'lazy' : 'eager',
    decoding: lazy ? 'async' : 'sync',
    fetchPriority: priority ? 'high' : lazy ? 'low' : 'auto',
    placeholder: generateBlurHash(src),
  };
}
