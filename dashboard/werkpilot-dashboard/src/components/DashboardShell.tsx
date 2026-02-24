'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import { Search, Command, LayoutDashboard, Users, Mail, Receipt, RotateCcw } from 'lucide-react';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';

// ---------------------------------------------------------------------------
// Sidebar context
// ---------------------------------------------------------------------------

interface ShellContext {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<ShellContext>({
  collapsed: false,
  setCollapsed: () => {},
});

export function useSidebarState() {
  return useContext(SidebarContext);
}

// ---------------------------------------------------------------------------
// Clock component
// ---------------------------------------------------------------------------

function HeaderClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('de-CH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    }
    update();
    const interval = setInterval(update, 15000); // update every 15s
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <div
      className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg select-none"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--text-muted)',
        letterSpacing: '0.04em',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: 'var(--green)',
          boxShadow: '0 0 6px rgba(34,197,94,0.4)',
          animation: 'pulse-dot 2s ease-in-out infinite',
        }}
      />
      <span className="tabular-nums">{time}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick search button (triggers CommandPalette)
// ---------------------------------------------------------------------------

function QuickSearchButton() {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  return (
    <button
      onClick={handleClick}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all duration-200"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        minWidth: 180,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      <Search size={13} style={{ opacity: 0.6 }} />
      <span className="flex-1 text-left">Suche...</span>
      <kbd
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        <Command size={9} />K
      </kbd>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mobile search button (visible only on mobile, opens Cmd+K)
// ---------------------------------------------------------------------------

function MobileSearchButton() {
  const handleClick = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }, []);

  return (
    <button
      onClick={handleClick}
      className="flex md:hidden items-center justify-center rounded-xl transition-all duration-200"
      style={{
        width: 36,
        height: 36,
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
      }}
      aria-label="Suche"
    >
      <Search size={16} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom tab bar
// ---------------------------------------------------------------------------

const MOBILE_TABS = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/crm', label: 'CRM', icon: Users },
  { href: '/mailing', label: 'Mailing', icon: Mail },
  { href: '/finanzen', label: 'Finanzen', icon: Receipt },
  { href: '/follow-up', label: 'Follow-Up', icon: RotateCcw },
];

function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
      style={{
        background: 'rgba(10, 13, 20, 0.92)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {MOBILE_TABS.map((tab) => {
        const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-1 py-2 pt-2.5 transition-colors duration-200"
            style={{
              color: isActive ? 'var(--amber)' : 'var(--text-muted)',
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: 2,
                  borderRadius: '0 0 2px 2px',
                  background: 'var(--amber)',
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
                }}
              />
            )}
            <tab.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Shortcut help trigger button
// ---------------------------------------------------------------------------

function ShortcutHelpButton() {
  const handleClick = useCallback(() => {
    document.dispatchEvent(new CustomEvent('toggle-keyboard-help'));
  }, []);

  return (
    <button
      onClick={handleClick}
      className="hidden md:flex items-center justify-center rounded-xl transition-all duration-200"
      style={{
        width: 32,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        fontWeight: 600,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
      aria-label="Tastenkürzel anzeigen"
      title="Tastenkürzel (?)"
    >
      ?
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline keyframes for the header
// ---------------------------------------------------------------------------

const headerStyles = `
  @keyframes header-slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const marginLeft = isMobile ? '0px' : collapsed ? '64px' : '256px';

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <style dangerouslySetInnerHTML={{ __html: headerStyles }} />

      <Sidebar />

      {/* Ambient mesh gradient background */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse at 0% 0%, rgba(245,158,11,0.03) 0%, transparent 50%)',
            'radial-gradient(ellipse at 100% 100%, rgba(139,92,246,0.03) 0%, transparent 50%)',
            'radial-gradient(ellipse at 50% 50%, rgba(96,165,250,0.02) 0%, transparent 50%)',
          ].join(', '),
        }}
      />

      {/* Subtle grid pattern overlay */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ================================================================ */}
      {/* Top Header Bar                                                    */}
      {/* ================================================================ */}
      <header
        className="fixed top-0 right-0 z-30 flex items-center justify-between gap-3 px-4 md:px-6 h-14"
        style={{
          left: marginLeft,
          transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)',
          background: 'rgba(10,13,20,0.6)',
          backdropFilter: 'blur(16px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          animation: 'header-slide-down 300ms ease-out',
        }}
      >
        {/* Left: spacer on mobile for hamburger, search on desktop */}
        <div className="flex items-center gap-3">
          {/* On mobile, offset for the hamburger button in the sidebar */}
          <div className="w-10 md:hidden" />
          <QuickSearchButton />
        </div>

        {/* Right: help + clock + notifications + mobile search */}
        <div className="flex items-center gap-2">
          <MobileSearchButton />
          <ShortcutHelpButton />
          <HeaderClock />
          <NotificationCenter />
        </div>
      </header>

      {/* Main content — extra bottom padding on mobile for tab bar */}
      <main
        className="min-h-screen p-4 pt-20 pb-24 md:p-8 md:pt-20 md:pb-8 overflow-x-hidden transition-[margin-left] duration-300"
        style={{ marginLeft }}
      >
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <MobileTabBar />

      {/* Keyboard shortcut help overlay */}
      <KeyboardShortcutsHelp />
    </SidebarContext.Provider>
  );
}
