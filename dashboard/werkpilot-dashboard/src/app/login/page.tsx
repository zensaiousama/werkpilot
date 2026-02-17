'use client';

import { Suspense, useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Login page animation keyframes
// ---------------------------------------------------------------------------
const loginStyles = `
  @keyframes login-mesh-shift {
    0% { background-position: 0% 50%; }
    25% { background-position: 50% 100%; }
    50% { background-position: 100% 50%; }
    75% { background-position: 50% 0%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes login-float-orb-1 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
    33% { transform: translate(80px, -60px) scale(1.2); opacity: 0.5; }
    66% { transform: translate(-40px, 40px) scale(0.9); opacity: 0.25; }
  }
  @keyframes login-float-orb-2 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
    33% { transform: translate(-60px, 80px) scale(1.1); opacity: 0.4; }
    66% { transform: translate(50px, -30px) scale(0.85); opacity: 0.15; }
  }
  @keyframes login-float-orb-3 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.25; }
    50% { transform: translate(40px, 60px) scale(1.15); opacity: 0.35; }
  }
  @keyframes login-card-enter {
    from { opacity: 0; transform: translateY(24px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes login-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes login-shake {
    0%, 100% { transform: translateX(0); }
    10%, 50%, 90% { transform: translateX(-4px); }
    30%, 70% { transform: translateX(4px); }
  }
  @keyframes login-error-enter {
    from { opacity: 0; transform: translateY(-8px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login fehlgeschlagen');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setLoading(false);
        return;
      }

      // Successful login - redirect
      router.push(redirect);
      router.refresh();
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          overflow: 'hidden',
          zIndex: 9999,
        }}
      >
        {/* ─── Animated Mesh Gradient Background ──────────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 80% 80% at 20% 30%, rgba(245, 158, 11, 0.08) 0%, transparent 60%),
              radial-gradient(ellipse 60% 60% at 80% 70%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
              radial-gradient(ellipse 70% 70% at 50% 50%, rgba(96, 165, 250, 0.05) 0%, transparent 70%),
              radial-gradient(ellipse 50% 50% at 70% 20%, rgba(34, 197, 94, 0.04) 0%, transparent 60%)
            `,
            backgroundSize: '200% 200%',
            animation: 'login-mesh-shift 20s ease infinite',
          }}
        />

        {/* Floating orbs */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '10%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'login-float-orb-1 15s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '15%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'login-float-orb-2 18s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '60%',
            width: 250,
            height: 250,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.05) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'login-float-orb-3 12s ease-in-out infinite',
          }}
        />

        {/* Grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        {/* ─── Login Card ─────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 420,
            margin: '0 16px',
            animation: mounted ? 'login-card-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' : 'none',
          }}
        >
          {/* Card with glassmorphism */}
          <div
            style={{
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(18, 21, 31, 0.92) 0%, rgba(24, 28, 42, 0.88) 50%, rgba(18, 21, 31, 0.92) 100%)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 20,
              padding: '40px 32px 32px',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
              overflow: 'hidden',
            }}
          >
            {/* Top shine line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '-50%',
                width: '200%',
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
                pointerEvents: 'none',
              }}
            />

            {/* Animated gradient border overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                padding: 1,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(139, 92, 246, 0.1), rgba(96, 165, 250, 0.2), rgba(245, 158, 11, 0.2))',
                backgroundSize: '300% 300%',
                animation: 'login-mesh-shift 8s ease infinite',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                pointerEvents: 'none',
                opacity: 0.5,
              }}
            />

            {/* ─── Logo ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
              {/* W Badge */}
              <div
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  marginBottom: 16,
                }}
              >
                {/* Glow behind badge */}
                <div
                  style={{
                    position: 'absolute',
                    inset: -6,
                    borderRadius: 18,
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 22,
                    color: '#000',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #f59e0b 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'login-mesh-shift 4s ease infinite',
                    boxShadow: '0 0 20px rgba(245, 158, 11, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  W
                </div>
              </div>

              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.02em',
                  marginBottom: 4,
                }}
              >
                Werkpilot Dashboard
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Melde dich an, um fortzufahren
              </p>
            </div>

            {/* ─── Error Message ─────────────────────────────── */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  marginBottom: 20,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  animation: 'login-error-enter 0.3s ease-out',
                }}
              >
                <AlertCircle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.4 }}>
                  {error}
                </p>
              </div>
            )}

            {/* ─── Form ─────────────────────────────────────── */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                animation: shake ? 'login-shake 0.4s ease' : 'none',
              }}
            >
              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  E-Mail
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@werkpilot.ch"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    style={{
                      width: '100%',
                      height: 48,
                      paddingLeft: 42,
                      paddingRight: 14,
                      fontSize: 14,
                      color: 'var(--text)',
                      background: 'rgba(10, 13, 20, 0.6)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Passwort
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Passwort eingeben"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      height: 48,
                      paddingLeft: 42,
                      paddingRight: 48,
                      fontSize: 14,
                      color: 'var(--text)',
                      background: 'rgba(10, 13, 20, 0.6)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      transition: 'color 0.15s ease, background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe(!rememberMe)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: `1.5px solid ${rememberMe ? 'var(--amber)' : 'var(--border)'}`,
                    background: rememberMe ? 'var(--amber)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="#000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  Angemeldet bleiben
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 48,
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#000',
                  background: loading
                    ? 'linear-gradient(90deg, #d97706, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                  backgroundSize: loading ? '200% 100%' : '100% 100%',
                  animation: loading ? 'login-shimmer 1.5s ease-in-out infinite' : 'none',
                  border: 'none',
                  borderRadius: 12,
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.2), 0 4px 12px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                  opacity: (!email || !password) && !loading ? 0.6 : 1,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow =
                      '0 0 30px rgba(245, 158, 11, 0.35), 0 6px 16px rgba(0, 0, 0, 0.25)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    '0 0 20px rgba(245, 158, 11, 0.2), 0 4px 12px rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onMouseDown={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                  }
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px) scale(1)';
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                    Wird angemeldet...
                  </>
                ) : (
                  'Anmelden'
                )}
              </button>
            </form>

            {/* ─── Footer ───────────────────────────────────── */}
            <div
              style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  opacity: 0.6,
                }}
              >
                Powered by{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, var(--amber), var(--orange))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontWeight: 700,
                  }}
                >
                  Werkpilot AI
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
