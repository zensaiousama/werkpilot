'use client';

/**
 * OptimizedScript.tsx
 *
 * Smart third-party script loader that defers script execution
 * until after user interaction to prevent render-blocking.
 *
 * Strategies:
 * - 'afterInteractive': Load after hydration (Next.js default behavior)
 * - 'lazyOnload':       Load after the page is fully idle
 * - 'worker':           Load only after first user interaction (click/scroll/touch)
 */

import { useEffect, useRef, useCallback } from 'react';

export type ScriptStrategy = 'afterInteractive' | 'lazyOnload' | 'worker';

interface OptimizedScriptProps {
  /** The script source URL */
  src: string;
  /** Loading strategy */
  strategy?: ScriptStrategy;
  /** Script id attribute for deduplication */
  id?: string;
  /** Whether to load the script asynchronously */
  async?: boolean;
  /** Whether to defer the script */
  defer?: boolean;
  /** Callback fired after the script has loaded */
  onLoad?: () => void;
  /** Callback fired if the script fails to load */
  onError?: (error: Error) => void;
  /** Additional attributes to set on the script element */
  attrs?: Record<string, string>;
}

function injectScript(
  src: string,
  options: {
    id?: string;
    async?: boolean;
    defer?: boolean;
    onLoad?: () => void;
    onError?: (error: Error) => void;
    attrs?: Record<string, string>;
  }
): void {
  // Avoid duplicate injection
  if (options.id && document.getElementById(options.id)) {
    options.onLoad?.();
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.type = 'text/javascript';

  if (options.id) script.id = options.id;
  if (options.async !== false) script.async = true;
  if (options.defer) script.defer = true;

  // Apply custom attributes
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      script.setAttribute(key, value);
    }
  }

  script.addEventListener('load', () => {
    options.onLoad?.();
  });

  script.addEventListener('error', () => {
    options.onError?.(new Error(`Failed to load script: ${src}`));
  });

  document.head.appendChild(script);
}

export default function OptimizedScript({
  src,
  strategy = 'afterInteractive',
  id,
  async: asyncProp,
  defer: deferProp,
  onLoad,
  onError,
  attrs,
}: OptimizedScriptProps) {
  const loadedRef = useRef(false);

  const loadScript = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    injectScript(src, {
      id,
      async: asyncProp,
      defer: deferProp,
      onLoad,
      onError,
      attrs,
    });
  }, [src, id, asyncProp, deferProp, onLoad, onError, attrs]);

  useEffect(() => {
    // Skip SSR
    if (typeof window === 'undefined') return;

    // ── afterInteractive: load immediately after mount (hydration complete) ──
    if (strategy === 'afterInteractive') {
      loadScript();
      return;
    }

    // ── lazyOnload: load when browser is idle ──
    if (strategy === 'lazyOnload') {
      const load = () => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => loadScript(), { timeout: 5000 });
        } else {
          setTimeout(loadScript, 3000);
        }
      };

      if (document.readyState === 'complete') {
        load();
      } else {
        window.addEventListener('load', load, { once: true });
        return () => window.removeEventListener('load', load);
      }
      return;
    }

    // ── worker: load only after first user interaction ──
    if (strategy === 'worker') {
      const interactionEvents = ['click', 'scroll', 'touchstart', 'mousemove', 'keydown'] as const;

      const onInteraction = () => {
        loadScript();
        // Clean up all listeners after first interaction
        interactionEvents.forEach((event) => {
          window.removeEventListener(event, onInteraction, { capture: true } as EventListenerOptions);
        });
      };

      interactionEvents.forEach((event) => {
        window.addEventListener(event, onInteraction, {
          capture: true,
          once: false,
          passive: true,
        });
      });

      return () => {
        interactionEvents.forEach((event) => {
          window.removeEventListener(event, onInteraction, { capture: true } as EventListenerOptions);
        });
      };
    }
  }, [strategy, loadScript]);

  // This component renders nothing — it only manages script injection
  return null;
}
