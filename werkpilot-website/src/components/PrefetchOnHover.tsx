'use client';

/**
 * PrefetchOnHover.tsx
 *
 * Client component that wraps Next.js Link to prefetch the target page
 * on mouse enter / focus, creating near-instant navigation.
 *
 * Features:
 * - Prefetches route data on hover (mouseenter)
 * - Also prefetches on focus for keyboard navigation
 * - Handles both internal routes and anchor links
 * - Debounces rapid hover events to avoid excessive prefetching
 * - Falls back to regular Link behavior for external URLs
 */

import { useCallback, useRef, type ReactNode, type MouseEvent, type FocusEvent } from 'react';
import Link, { type LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';

interface PrefetchOnHoverProps extends Omit<LinkProps, 'prefetch'> {
  children: ReactNode;
  className?: string;
  /** Minimum hover time (ms) before triggering prefetch */
  delay?: number;
  /** Also inject a <link rel="prefetch"> for the page HTML */
  prefetchHtml?: boolean;
  /** Disable prefetch-on-hover behavior */
  disabled?: boolean;
  /** onClick handler */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** Pass-through HTML attributes */
  target?: string;
  rel?: string;
  'aria-label'?: string;
  id?: string;
}

export default function PrefetchOnHover({
  children,
  href,
  className,
  delay = 65,
  prefetchHtml = false,
  disabled = false,
  onClick,
  ...rest
}: PrefetchOnHoverProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef(false);

  const hrefString = typeof href === 'string' ? href : href.pathname ?? '';

  // Determine if this is an internal route (not external, not just an anchor)
  const isInternal =
    hrefString.startsWith('/') || hrefString.startsWith('#') || hrefString.startsWith('?');
  const isAnchor = hrefString.startsWith('#');
  const isExternal = !isInternal;

  const doPrefetch = useCallback(() => {
    if (prefetchedRef.current || disabled || isExternal) return;
    prefetchedRef.current = true;

    // Use Next.js router prefetch for internal routes
    if (!isAnchor) {
      router.prefetch(hrefString);
    }

    // Optionally inject a <link rel="prefetch"> for the raw HTML
    if (prefetchHtml && !isAnchor && typeof document !== 'undefined') {
      const existing = document.querySelector(`link[rel="prefetch"][href="${hrefString}"]`);
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = hrefString;
        link.as = 'document';
        document.head.appendChild(link);
      }
    }
  }, [hrefString, router, prefetchHtml, disabled, isExternal, isAnchor]);

  const handleMouseEnter = useCallback(
    (_e: MouseEvent<HTMLAnchorElement>) => {
      if (disabled || isExternal) return;

      timerRef.current = setTimeout(() => {
        doPrefetch();
      }, delay);
    },
    [delay, doPrefetch, disabled, isExternal]
  );

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleFocus = useCallback(
    (_e: FocusEvent<HTMLAnchorElement>) => {
      if (disabled || isExternal) return;
      doPrefetch();
    },
    [doPrefetch, disabled, isExternal]
  );

  // For external links, just render a plain <a>
  if (isExternal) {
    return (
      <a href={hrefString} className={className} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false} // We handle prefetch ourselves
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Link>
  );
}
