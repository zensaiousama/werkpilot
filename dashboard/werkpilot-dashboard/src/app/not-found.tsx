import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <p
          className="text-8xl font-bold mb-4"
          style={{
            fontFamily: 'var(--font-mono)',
            background: 'linear-gradient(135deg, var(--amber) 0%, var(--orange) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </p>
        <h1
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Seite nicht gefunden
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Diese Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
            style={{ backgroundColor: 'var(--amber)', color: '#000' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
