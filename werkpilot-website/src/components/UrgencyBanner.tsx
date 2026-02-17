'use client';

import { useState, useEffect, useRef } from 'react';

function getEndOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}

function formatTimeLeft(diff: number): string {
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} Tage, ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} Minuten`;
}

export default function UrgencyBanner() {
  const [timeLeft, setTimeLeft] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const update = () => {
      const diff = getEndOfMonth().getTime() - Date.now();
      if (diff > 0) setTimeLeft(formatTimeLeft(diff));
    };

    update();
    intervalRef.current = setInterval(update, 60000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!timeLeft) return null;

  return (
    <div
      className="text-center py-2 px-4"
      style={{
        background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.08), rgba(5, 150, 105, 0.08))',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>Gratis Setup</span>
        {' '}— Angebot endet in {timeLeft}
      </p>
    </div>
  );
}
