/**
 * TrustBar — Server component
 * Thin bar above the hero showing trust signals:
 * trust count, star rating, and compliance badges.
 */

export default function TrustBar() {
  return (
    <div
      className="w-full py-2.5 relative z-50"
      style={{
        background: 'linear-gradient(90deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {/* Trust count + stars */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5" aria-label="5 von 5 Sternen">
              {[0, 1, 2, 3, 4].map((i) => (
                <svg
                  key={i}
                  width="12"
                  height="12"
                  viewBox="0 0 20 20"
                  fill="#FBBF24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z" />
                </svg>
              ))}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              Schweizer Qualit&auml;t &middot; Made in Switzerland
            </span>
          </div>

          {/* Divider */}
          <div
            className="hidden sm:block h-3 w-px"
            style={{ background: 'rgba(255, 255, 255, 0.15)' }}
            aria-hidden="true"
          />

          {/* Trust badges */}
          <div className="hidden sm:flex items-center gap-4">
            {/* SSL Secure badge */}
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34D399"
                strokeWidth={2}
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255, 255, 255, 0.55)' }}
              >
                SSL Secured
              </span>
            </div>

            {/* Swiss Made badge */}
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="3"
                  fill="#DC2626"
                />
                <path
                  d="M12 6v12M6 12h12"
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255, 255, 255, 0.55)' }}
              >
                Swiss Made
              </span>
            </div>

            {/* DSGVO badge */}
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60A5FA"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255, 255, 255, 0.55)' }}
              >
                DSGVO-konform
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
