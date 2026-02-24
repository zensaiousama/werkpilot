'use client';

import Link from 'next/link';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 mb-6"
      style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
    >
      <Link
        href="/"
        className="flex items-center gap-1.5 transition-colors duration-200"
        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--amber)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        <LayoutDashboard size={13} />
        <span>Dashboard</span>
      </Link>

      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={12} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          {item.href ? (
            <Link
              href={item.href}
              className="transition-colors duration-200"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--amber)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
