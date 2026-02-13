'use client';

import { useSyncExternalStore, ReactNode } from 'react';

interface ABTestProps {
  testId: string;
  variantA: ReactNode;
  variantB: ReactNode;
}

function getVariant(testId: string): 'A' | 'B' {
  const storageKey = `ab-test-${testId}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'A' || stored === 'B') return stored;
    const chosen = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(storageKey, chosen);
    return chosen;
  } catch {
    return 'A';
  }
}

function subscribe() {
  // localStorage doesn't change within a session for our use case
  return () => {};
}

export default function ABTest({ testId, variantA, variantB }: ABTestProps) {
  const variant = useSyncExternalStore(
    subscribe,
    () => getVariant(testId),
    () => 'A' as const, // server snapshot
  );

  return <>{variant === 'A' ? variantA : variantB}</>;
}
