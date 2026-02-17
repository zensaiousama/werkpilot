import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Werkpilot — Das Betriebssystem für Schweizer KMUs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 30%, #059669 70%, #10B981 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 80px',
          position: 'relative',
        }}
      >
        {/* Decorative orbs for depth */}
        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            top: '-150px',
            right: '-100px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.04)',
            bottom: '-120px',
            left: '-80px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            top: '80px',
            left: '120px',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '36px',
          }}
        >
          <span
            style={{
              fontSize: '40px',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
            }}
          >
            Werkpilot
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', gap: '3px' }}>
              <div style={{ width: '9px', height: '9px', background: '#F59E0B', borderRadius: '2px' }} />
              <div style={{ width: '9px', height: '9px', background: '#F59E0B', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              <div style={{ width: '9px', height: '9px', background: '#F59E0B', borderRadius: '2px' }} />
              <div style={{ width: '9px', height: '9px', background: '#F59E0B', borderRadius: '2px' }} />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: '24px',
            maxWidth: '900px',
          }}
        >
          Mehr Kunden. Weniger Admin.
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: '26px',
            color: 'rgba(255, 255, 255, 0.75)',
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: '700px',
            marginBottom: '44px',
          }}
        >
          Das virtuelle Backoffice für Schweizer KMUs — 43 Spezialisten, 24/7
        </p>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '56px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            paddingTop: '32px',
          }}
        >
          {[
            { value: '43', label: 'Spezialisten' },
            { value: '24/7', label: 'Im Einsatz' },
            { value: '78%', label: 'Günstiger' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '36px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontSize: '15px',
                  color: 'rgba(255, 255, 255, 0.55)',
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* URL */}
        <p
          style={{
            position: 'absolute',
            bottom: '28px',
            fontSize: '17px',
            color: 'rgba(255, 255, 255, 0.35)',
            letterSpacing: '0.08em',
          }}
        >
          werkpilot.ch
        </p>
      </div>
    ),
    { ...size }
  );
}
