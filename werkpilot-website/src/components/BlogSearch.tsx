'use client';

import { useState } from 'react';

export default function BlogSearch() {
  const [query, setQuery] = useState('');

  return (
    <div className="max-w-lg mx-auto">
      <div className="relative">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" stroke="var(--color-text-secondary)" strokeWidth="2" />
          <path d="M21 21l-4.35-4.35" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Artikel durchsuchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border rounded-xl text-base"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
          aria-label="Blog durchsuchen"
        />
      </div>
      {query.length > 0 && (
        <p
          className="text-sm mt-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Noch keine Artikel vorhanden. Neue Inhalte erscheinen bald.
        </p>
      )}
    </div>
  );
}
