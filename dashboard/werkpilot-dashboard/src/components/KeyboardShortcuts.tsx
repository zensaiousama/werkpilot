'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Mail,
  Receipt,
  RotateCcw,
  Search,
  Bot,
  Moon,
  BarChart3,
  Settings,
  Command,
  X,
} from 'lucide-react';

const SHORTCUTS = [
  { keys: ['G', 'D'], label: 'Dashboard', icon: LayoutDashboard, route: '/' },
  { keys: ['G', 'C'], label: 'CRM', icon: Users, route: '/crm' },
  { keys: ['G', 'M'], label: 'Mailing', icon: Mail, route: '/mailing' },
  { keys: ['G', 'F'], label: 'Finanzen', icon: Receipt, route: '/finanzen' },
  { keys: ['G', 'U'], label: 'Follow-Up', icon: RotateCcw, route: '/follow-up' },
  { keys: ['G', 'S'], label: 'Lead Scraper', icon: Search, route: '/scraper' },
  { keys: ['G', 'A'], label: 'AI Agents', icon: Bot, route: '/agents' },
  { keys: ['G', 'N'], label: 'Night Shift', icon: Moon, route: '/nightshift' },
  { keys: ['G', 'L'], label: 'Analytics', icon: BarChart3, route: '/analytics' },
  { keys: ['G', 'T'], label: 'Settings', icon: Settings, route: '/settings' },
];

const GLOBAL_SHORTCUTS = [
  { keys: ['\u2318', 'K'], label: 'Suche / Command Palette' },
  { keys: ['?'], label: 'Tastenkürzel anzeigen' },
  { keys: ['Esc'], label: 'Schliessen' },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // ? key to show help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Escape to close help
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        if (!gPressed) {
          gPressed = true;
          gTimeout = setTimeout(() => { gPressed = false; }, 1000);
          return;
        }
      }

      if (gPressed) {
        gPressed = false;
        if (gTimeout) clearTimeout(gTimeout);

        const routes: Record<string, string> = {
          d: '/',
          c: '/crm',
          m: '/mailing',
          f: '/finanzen',
          u: '/follow-up',
          s: '/scraper',
          a: '/agents',
          n: '/nightshift',
          l: '/analytics',
          t: '/settings',
        };

        if (routes[e.key]) {
          e.preventDefault();
          router.push(routes[e.key]);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [router, showHelp]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          animation: 'scale-in 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Command size={16} style={{ color: 'var(--amber)' }} />
            <h2
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              Tastenkürzel
            </h2>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation shortcuts */}
        <div className="p-4 space-y-1">
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
          >
            Navigation
          </p>
          {SHORTCUTS.map((s) => (
            <div
              key={s.route}
              className="flex items-center justify-between py-2 px-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <div className="flex items-center gap-3">
                <s.icon size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm">{s.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={i}>
                    <kbd
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: 'var(--bg)',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {k}
                    </kbd>
                    {i < s.keys.length - 1 && (
                      <span className="text-xs mx-0.5" style={{ color: 'var(--text-muted)' }}>+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Global shortcuts */}
        <div className="px-4 pb-4 pt-1 space-y-1">
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
          >
            Global
          </p>
          {GLOBAL_SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between py-2 px-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="text-sm">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={i}>
                    <kbd
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: 'var(--bg)',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {k}
                    </kbd>
                    {i < s.keys.length - 1 && (
                      <span className="text-xs mx-0.5" style={{ color: 'var(--text-muted)' }}>+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Drücke ? um diese Übersicht ein-/auszublenden
          </p>
        </div>
      </div>
    </div>
  );
}
