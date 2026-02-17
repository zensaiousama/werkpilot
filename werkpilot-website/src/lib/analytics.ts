type TrackFn = (event: string, data: Record<string, string>) => void;

export function trackEvent(event: string, data?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  if (w.wpTrack) {
    (w.wpTrack as TrackFn)(event, data || {});
  }
}

export function trackPageView(path: string) {
  trackEvent('page_view', { path });
}

export function trackConversion(type: string, value?: string) {
  trackEvent('conversion', { type, value: value || '' });
}

export function trackError(error: Error, context?: string) {
  trackEvent('error', {
    message: error.message,
    stack: (error.stack || '').slice(0, 200),
    context: context || '',
  });
}
