'use client';

import { useState, useEffect, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

interface Shortcut {
  keys: string[];
  separator?: string; // defaults to ' + ', use 'then' for sequential combos
  description: string;
}

interface ShortcutCategory {
  title: string;
  color: string;
  shortcuts: Shortcut[];
}

const CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    color: 'var(--blue)',
    shortcuts: [
      { keys: ['\u2318', 'K'], description: 'Suche \u00f6ffnen' },
      { keys: ['G', 'H'], separator: 'then', description: 'Dashboard (Home)' },
      { keys: ['G', 'C'], separator: 'then', description: 'CRM' },
      { keys: ['G', 'M'], separator: 'then', description: 'Mailing' },
      { keys: ['G', 'F'], separator: 'then', description: 'Finanzen' },
      { keys: ['G', 'U'], separator: 'then', description: 'Follow-Up' },
    ],
  },
  {
    title: 'CRM',
    color: 'var(--amber)',
    shortcuts: [
      { keys: ['N'], description: 'Neuer Lead' },
      { keys: ['V'], description: 'Ansicht wechseln (Tabelle/Kanban)' },
      { keys: ['Esc'], description: 'Panel schliessen' },
    ],
  },
  {
    title: 'Dashboard',
    color: 'var(--green)',
    shortcuts: [
      { keys: ['R'], description: 'Daten aktualisieren' },
    ],
  },
  {
    title: 'Allgemein',
    color: 'var(--purple)',
    shortcuts: [
      { keys: ['?'], description: 'Diese Hilfe anzeigen' },
      { keys: ['Esc'], description: 'Schliessen' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Inline keyframes
// ---------------------------------------------------------------------------

const helpAnimStyles = `
  @keyframes shortcut-help-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shortcut-help-scale-in {
    from { opacity: 0; transform: scale(0.95) translateY(-8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
`;

// ---------------------------------------------------------------------------
// KeyBadge: renders a single keyboard key
// ---------------------------------------------------------------------------

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        minWidth: 24,
        lineHeight: '20px',
        textAlign: 'center',
      }}
    >
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  // Listen for '?' key to toggle, Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Expose open handler for external trigger (the ? button in header)
  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }
    document.addEventListener('toggle-keyboard-help', handleToggle);
    return () => document.removeEventListener('toggle-keyboard-help', handleToggle);
  }, []);

  if (!open) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: helpAnimStyles }} />

      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 z-[260] flex items-center justify-center"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'shortcut-help-fade-in 150ms ease-out',
        }}
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          className="w-full max-w-lg mx-4 rounded-2xl border overflow-hidden"
          style={{
            background: 'rgba(12, 15, 23, 0.85)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            boxShadow:
              '0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 1px 0 rgba(255, 255, 255, 0.05) inset',
            animation: 'shortcut-help-scale-in 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                }}
              >
                <Keyboard size={14} style={{ color: 'var(--amber)' }} />
              </div>
              <h2
                className="text-sm font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
              >
                Tastenk\u00fcrzel
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              aria-label="Schliessen"
            >
              <X size={16} />
            </button>
          </div>

          {/* Categories */}
          <div
            className="overflow-y-auto px-5 py-4"
            style={{ maxHeight: 'calc(80vh - 120px)' }}
          >
            {CATEGORIES.map((category, catIdx) => (
              <div key={category.title} style={{ marginTop: catIdx > 0 ? 20 : 0 }}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: category.color,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {category.title}
                  </h3>
                </div>

                {/* Shortcut rows */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    background: 'rgba(255, 255, 255, 0.015)',
                  }}
                >
                  {category.shortcuts.map((shortcut, idx) => (
                    <div
                      key={`${category.title}-${idx}`}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{
                        borderTop:
                          idx > 0 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                      }}
                    >
                      {/* Description */}
                      <span
                        className="text-sm"
                        style={{
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      >
                        {shortcut.description}
                      </span>

                      {/* Key combo */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-4">
                        {shortcut.keys.map((key, ki) => (
                          <span key={ki} className="flex items-center gap-1.5">
                            {ki > 0 && (
                              <span
                                className="text-xs"
                                style={{
                                  color: 'var(--text-muted)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 10,
                                }}
                              >
                                {shortcut.separator === 'then' ? 'dann' : '+'}
                              </span>
                            )}
                            <KeyBadge>{key}</KeyBadge>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 border-t text-center"
            style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <p
              className="text-xs"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Dr\u00fccke{' '}
              <KeyBadge>?</KeyBadge>{' '}
              um diese \u00dcbersicht ein-/auszublenden
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
