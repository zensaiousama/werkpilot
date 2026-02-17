'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useSidebarState } from './DashboardShell';
import {
  LayoutDashboard,
  Users,
  Search,
  Bot,
  Moon,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Command,
  Activity,
  Zap,
  AlertTriangle,
} from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D' },
  { href: '/crm', label: 'CRM', icon: Users, shortcut: 'G C' },
  { href: '/scraper', label: 'Lead Scraper', icon: Search, shortcut: 'G S' },
  { href: '/agents', label: 'AI Agents', icon: Bot, shortcut: 'G A' },
  { href: '/nightshift', label: 'Night Shift', icon: Moon, shortcut: 'G N' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, shortcut: 'G L' },
  { href: '/settings', label: 'Settings', icon: Settings, shortcut: 'G T' },
];

// Inline keyframes as a style tag for sidebar-specific animations
const sidebarStyles = `
  @keyframes sidebar-logo-gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes sidebar-logo-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(245, 158, 11, 0.3); }
    50% { transform: scale(1.05); box-shadow: 0 0 16px rgba(245, 158, 11, 0.5), 0 0 32px rgba(245, 158, 11, 0.2); }
  }
  @keyframes sidebar-glow-border {
    0%, 100% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.4), 0 0 8px rgba(245, 158, 11, 0.2); }
    50% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.6), 0 0 16px rgba(245, 158, 11, 0.3); }
  }
  @keyframes sidebar-cmdk-border {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes sidebar-health-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes sidebar-dot-ping {
    0% { transform: scale(1); opacity: 1; }
    75% { transform: scale(2.2); opacity: 0; }
    100% { transform: scale(2.2); opacity: 0; }
  }
`;

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cmdkHovered, setCmdkHovered] = useState(false);
  const { collapsed, setCollapsed } = useSidebarState();
  const [agentHealth, setAgentHealth] = useState({
    total: 43,
    running: 38,
    idle: 3,
    errored: 2,
    healthPct: 88,
  });

  // Fetch real agent health
  useEffect(() => {
    fetch('/api/agents/health')
      .then((r) => r.json())
      .then((data) => {
        if (data.total) setAgentHealth(data);
      })
      .catch(() => {});
  }, []);

  const handleCmdK = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  // Health bar gradient color based on percentage
  const healthGradient =
    agentHealth.healthPct >= 90
      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
      : agentHealth.healthPct >= 70
        ? 'linear-gradient(90deg, #22c55e, #f59e0b)'
        : 'linear-gradient(90deg, #f59e0b, #ef4444)';

  const healthColor =
    agentHealth.healthPct >= 90
      ? 'var(--green)'
      : agentHealth.healthPct >= 70
        ? 'var(--amber)'
        : 'var(--red)';

  return (
    <>
      {/* Inject sidebar-specific keyframes */}
      <style dangerouslySetInnerHTML={{ __html: sidebarStyles }} />

      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 p-2.5 rounded-xl md:hidden"
        style={{
          backgroundColor: 'var(--surface-glass)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: 'var(--text)',
        }}
        aria-label="Toggle menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          ${collapsed ? 'w-16' : 'w-64'}`}
        style={{
          background: `
            linear-gradient(
              135deg,
              rgba(245, 158, 11, 0.03) 0%,
              transparent 40%,
              rgba(139, 92, 246, 0.03) 100%
            ),
            rgba(12, 15, 23, 0.85)
          `,
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          borderRight: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Noise texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
            pointerEvents: 'none',
            opacity: 0.4,
            zIndex: 0,
            borderRadius: 'inherit',
          }}
        />

        {/* Right edge gradient border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '1px',
            background:
              'linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(139, 92, 246, 0.08) 30%, var(--border) 50%, rgba(96, 165, 250, 0.08) 70%, rgba(245, 158, 11, 0.1) 100%)',
            zIndex: 2,
          }}
        />

        {/* ============================================ */}
        {/* Logo Area                                    */}
        {/* ============================================ */}
        <div
          className="flex items-center gap-3 px-4 h-16 shrink-0 relative"
          style={{ zIndex: 1 }}
        >
          {/* W Badge with animated gradient + glow */}
          <div
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              flexShrink: 0,
            }}
          >
            {/* Glow layer behind the badge */}
            <div
              style={{
                position: 'absolute',
                inset: -3,
                borderRadius: 12,
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)',
                filter: 'blur(6px)',
                animation: collapsed ? 'sidebar-logo-pulse 3s ease-in-out infinite' : 'none',
              }}
            />
            {/* The badge itself */}
            <div
              style={{
                position: 'relative',
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 15,
                color: '#000',
                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #f59e0b 100%)',
                backgroundSize: '200% 200%',
                animation: 'sidebar-logo-gradient 3s ease infinite',
                boxShadow: '0 0 12px rgba(245, 158, 11, 0.35), 0 2px 8px rgba(0, 0, 0, 0.3)',
                letterSpacing: '-0.02em',
              }}
            >
              W
            </div>
          </div>

          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <span
                className="font-bold text-sm tracking-tight"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                  letterSpacing: '-0.01em',
                }}
              >
                Werkpilot
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                }}
              >
                Dashboard
              </span>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden md:flex items-center justify-center rounded-lg transition-all duration-200"
            style={{
              color: 'var(--text-muted)',
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.05)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft
              size={14}
              className="transition-transform duration-300"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}
            />
          </button>
        </div>

        {/* Divider under logo */}
        <div
          style={{
            height: 1,
            margin: '0 16px',
            background: 'linear-gradient(90deg, transparent, var(--border), transparent)',
            position: 'relative',
            zIndex: 1,
          }}
        />

        {/* ============================================ */}
        {/* Cmd+K Search Button                          */}
        {/* ============================================ */}
        {!collapsed && (
          <div className="px-3 pt-4 pb-1" style={{ position: 'relative', zIndex: 1 }}>
            {/* Outer wrapper for animated gradient border on hover */}
            <div
              style={{
                position: 'relative',
                borderRadius: 10,
                padding: 1,
                background: cmdkHovered
                  ? 'linear-gradient(135deg, var(--amber), var(--purple), var(--blue), var(--amber))'
                  : 'var(--border)',
                backgroundSize: '300% 300%',
                animation: cmdkHovered ? 'sidebar-cmdk-border 3s ease infinite' : 'none',
                transition: 'background 0.3s ease',
              }}
            >
              <button
                onClick={handleCmdK}
                onMouseEnter={() => setCmdkHovered(true)}
                onMouseLeave={() => setCmdkHovered(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-xs transition-all duration-200"
                style={{
                  backgroundColor: cmdkHovered
                    ? 'rgba(18, 21, 31, 0.95)'
                    : 'rgba(10, 13, 20, 0.6)',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Command size={13} style={{ opacity: 0.6 }} />
                <span className="flex-1 text-left" style={{ color: 'var(--text-muted)' }}>
                  Suche...
                </span>
                <kbd
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    borderRadius: 4,
                  }}
                >
                  {'\u2318'}K
                </kbd>
              </button>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Navigation                                    */}
        {/* ============================================ */}
        <nav
          className="flex-1 py-3 overflow-y-auto"
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="group relative flex items-center gap-3 mx-2 py-2.5 rounded-xl text-sm transition-all duration-200"
                  style={{
                    paddingLeft: collapsed ? 12 : 14,
                    paddingRight: collapsed ? 12 : 12,
                    background: isActive
                      ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.03) 100%)'
                      : 'transparent',
                    color: isActive ? 'var(--amber)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background =
                        'rgba(255, 255, 255, 0.03)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Glowing left border for active */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 3,
                        borderRadius: '0 3px 3px 0',
                        background: 'var(--amber)',
                        boxShadow:
                          '0 0 8px rgba(245, 158, 11, 0.5), 0 0 16px rgba(245, 158, 11, 0.25)',
                        animation: 'sidebar-glow-border 3s ease-in-out infinite',
                      }}
                    />
                  )}

                  {/* Icon with container when active */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      flexShrink: 0,
                      background: isActive
                        ? 'rgba(245, 158, 11, 0.12)'
                        : 'transparent',
                      transition: 'background 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: isActive
                        ? '0 0 8px rgba(245, 158, 11, 0.1)'
                        : 'none',
                    }}
                  >
                    <item.icon size={18} />
                  </div>

                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <span
                        className="text-xs hide-mobile"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: isActive
                            ? 'rgba(245, 158, 11, 0.4)'
                            : 'var(--text-muted)',
                          fontSize: 10,
                          opacity: 0.7,
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        {item.shortcut}
                      </span>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ============================================ */}
        {/* Agent Health Section                          */}
        {/* ============================================ */}
        {!collapsed && (
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '16px',
            }}
          >
            {/* Separator */}
            <div
              style={{
                height: 1,
                marginBottom: 16,
                background: 'linear-gradient(90deg, transparent, var(--border), transparent)',
              }}
            />

            {/* Header: "Agents" with pulsing dot + health % */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {/* Pulsing dot */}
                <div style={{ position: 'relative', width: 8, height: 8 }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: healthColor,
                      animation: 'sidebar-health-pulse 2s ease-in-out infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: -2,
                      borderRadius: '50%',
                      background: healthColor,
                      opacity: 0.3,
                      animation: 'sidebar-dot-ping 2s ease-in-out infinite',
                    }}
                  />
                </div>
                <p
                  className="text-xs font-semibold"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {agentHealth.total} Agents
                </p>
              </div>
              <span
                className="text-xs font-bold tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: healthColor,
                  fontSize: 13,
                }}
              >
                {agentHealth.healthPct}%
              </span>
            </div>

            {/* Thicker health bar with gradient fill */}
            <div
              style={{
                width: '100%',
                height: 8,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(10, 13, 20, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 999,
                  width: `${agentHealth.healthPct}%`,
                  background: healthGradient,
                  transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow:
                    agentHealth.healthPct >= 90
                      ? '0 0 8px rgba(34, 197, 94, 0.3)'
                      : agentHealth.healthPct >= 70
                        ? '0 0 8px rgba(245, 158, 11, 0.3)'
                        : '0 0 8px rgba(239, 68, 68, 0.3)',
                }}
              />
            </div>

            {/* Agent status grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: agentHealth.errored > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: 8,
              }}
            >
              {/* Running */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 4px',
                  borderRadius: 8,
                  background: 'rgba(34, 197, 94, 0.06)',
                  border: '1px solid rgba(34, 197, 94, 0.1)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Zap size={11} style={{ color: 'var(--green)' }} />
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}
                  >
                    {agentHealth.running}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Active
                </span>
              </div>

              {/* Idle */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 4px',
                  borderRadius: 8,
                  background: 'rgba(139, 143, 163, 0.04)',
                  border: '1px solid rgba(139, 143, 163, 0.08)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Activity size={11} style={{ color: 'var(--text-muted)' }} />
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                  >
                    {agentHealth.idle}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Idle
                </span>
              </div>

              {/* Errored */}
              {agentHealth.errored > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '8px 4px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.12)',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={11} style={{ color: 'var(--red)' }} />
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}
                    >
                      {agentHealth.errored}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Error
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Version footer                                */}
        {/* ============================================ */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: collapsed ? '12px 0' : '8px 16px 14px',
            textAlign: 'center',
          }}
        >
          {!collapsed && (
            <p
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                opacity: 0.5,
                letterSpacing: '0.02em',
              }}
            >
              v2.0.0 — Night Shift
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
