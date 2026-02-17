'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>;
      type TrackFn = (event: string, data: Record<string, string>) => void;
      if (w.wpTrack) {
        (w.wpTrack as TrackFn)('section_error', {
          message: error.message,
          stack: (error.stack || '').slice(0, 200),
        });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
