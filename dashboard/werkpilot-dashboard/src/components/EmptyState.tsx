'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  color?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  color = 'var(--amber)',
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      style={{ minHeight: 320 }}
    >
      {/* Decorative background circles */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div
          style={{
            position: 'absolute',
            inset: -24,
            borderRadius: '50%',
            background: `radial-gradient(circle, color-mix(in srgb, ${color} 8%, transparent), transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 72,
            height: 72,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
            color,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text)',
          margin: '0 0 8px',
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-muted)',
          maxWidth: 360,
          lineHeight: 1.6,
          margin: '0 0 20px',
        }}
      >
        {description}
      </p>

      {/* CTA Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
          style={{
            backgroundColor: color,
            color: '#000',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px color-mix(in srgb, ${color} 40%, transparent)`;
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            (e.currentTarget as HTMLElement).style.transform = 'none';
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
