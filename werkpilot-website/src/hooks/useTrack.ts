'use client';

import { useCallback } from 'react';

type TrackFn = (event: string, data: Record<string, string>) => void;

export function useTrack() {
  return useCallback((event: string, data?: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    if (w.wpTrack) {
      (w.wpTrack as TrackFn)(event, data || {});
    }
  }, []);
}

export function trackEvent(event: string, data?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  if (w.wpTrack) {
    (w.wpTrack as TrackFn)(event, data || {});
  }
}
