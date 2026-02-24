'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Search,
  Bot,
  Moon,
  BarChart3,
  Settings,
  Zap,
  MessageSquare,
  Mail,
  FileText,
  CalendarClock,
  ArrowRight,
  Loader2,
  Clock,
  Receipt,
  RotateCcw,
  X,
} from 'lucide-react';

/* ---------- Types ---------- */

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface SearchResult {
  type: 'lead' | 'invoice' | 'followup' | 'campaign';
  id: string;
  title: string;
  subtitle: string;
  status: string;
  href: string;
}

/* ---------- Constants ---------- */

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lead: <Users size={16} />,
  invoice: <Receipt size={16} />,
  followup: <RotateCcw size={16} />,
  campaign: <Mail size={16} />,
};

const TYPE_LABELS: Record<string, string> = {
  lead: 'Lead',
  invoice: 'Rechnung',
  followup: 'Follow-Up',
  campaign: 'Kampagne',
};

const TYPE_COLORS: Record<string, string> = {
  lead: 'var(--amber)',
  invoice: 'var(--green)',
  followup: 'var(--blue)',
  campaign: 'var(--purple)',
};

const STATUS_COLORS: Record<string, string> = {
  'New Lead': '#60a5fa',
  Researched: '#818cf8',
  Contacted: '#c084fc',
  Interested: '#f59e0b',
  Meeting: '#f59e0b',
  Proposal: '#f59e0b',
  Negotiation: '#f59e0b',
  Won: '#34d399',
  Client: '#34d399',
  Lost: '#f87171',
  paid: '#34d399',
  sent: '#60a5fa',
  overdue: '#f87171',
  draft: '#9ca3af',
  pending: '#f59e0b',
  completed: '#34d399',
  skipped: '#9ca3af',
};

/* ---------- Component ---------- */

const RECENT_SEARCHES_KEY = 'werkpilot-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(q: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== q);
    recent.unshift(q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch { /* ignore */ }
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    { id: 'dashboard', label: 'Überblick', description: 'Executive Dashboard', icon: <LayoutDashboard size={18} />, action: () => router.push('/'), category: 'Navigation' },
    { id: 'crm', label: 'CRM / Leads', description: 'Leads & Kunden verwalten', icon: <Users size={18} />, action: () => router.push('/crm'), category: 'Navigation' },
    { id: 'mailing', label: 'Mailing', description: 'Kampagnen & E-Mails', icon: <Mail size={18} />, action: () => router.push('/mailing'), category: 'Navigation' },
    { id: 'finanzen', label: 'Finanzen', description: 'Rechnungen & Ausgaben', icon: <Receipt size={18} />, action: () => router.push('/finanzen'), category: 'Navigation' },
    { id: 'followup', label: 'Follow-Up', description: 'Pendenzen & Sequenzen', icon: <RotateCcw size={18} />, action: () => router.push('/follow-up'), category: 'Navigation' },
    { id: 'scraper', label: 'Lead Scraper', description: 'Neue Leads finden', icon: <Search size={18} />, action: () => router.push('/scraper'), category: 'Navigation' },
    { id: 'agents', label: 'AI Agents', description: 'Agent-Verwaltung', icon: <Bot size={18} />, action: () => router.push('/agents'), category: 'Navigation' },
    { id: 'analytics', label: 'Analytics', description: 'Charts & Auswertungen', icon: <BarChart3 size={18} />, action: () => router.push('/analytics'), category: 'Navigation' },
    { id: 'nightshift', label: 'Nightshift', description: 'Automatisierung', icon: <Moon size={18} />, action: () => router.push('/nightshift'), category: 'Navigation' },
    { id: 'settings', label: 'Einstellungen', description: 'Konfiguration', icon: <Settings size={18} />, action: () => router.push('/settings'), category: 'Navigation' },
    { id: 'ai-chat', label: 'AI Assistent', description: 'Claude fragen', icon: <MessageSquare size={18} />, action: () => { document.dispatchEvent(new CustomEvent('toggle-ai-chat')); }, category: 'Aktionen' },
    { id: 'trigger-agents', label: 'Agents starten', description: 'Alle Agents auslösen', icon: <Zap size={18} />, action: () => { document.dispatchEvent(new CustomEvent('trigger-all-agents')); }, category: 'Aktionen' },
  ];

  const filteredCommands = query.trim().length > 0
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Total selectable items: search results + commands
  const totalItems = searchResults.length + filteredCommands.length;

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelectedIndex(0);
    setSearchResults([]);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSearchResults([]);
  }, []);

  const handleSelect = useCallback(
    (idx: number) => {
      if (idx < searchResults.length) {
        const r = searchResults[idx];
        if (query.trim().length >= 2) addRecentSearch(query.trim());
        router.push(r.href);
      } else {
        const cmdIdx = idx - searchResults.length;
        const cmd = filteredCommands[cmdIdx];
        if (cmd) cmd.action();
      }
      handleClose();
    },
    [searchResults, filteredCommands, router, handleClose, query]
  );

  const handleRecentClick = useCallback(
    (term: string) => {
      setQuery(term);
    },
    []
  );

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Keyboard: Cmd+K / Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) handleClose();
        else handleOpen();
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleOpen, handleClose]);

  // Arrow navigation + Enter
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(selectedIndex);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, totalItems, selectedIndex, handleSelect]);

  // Focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Live search with debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.results || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  // Group commands by category
  const groups: Record<string, Command[]> = {};
  filteredCommands.forEach((cmd) => {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  });

  let cmdFlatIndex = searchResults.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          animation: 'scale-in 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {searching ? (
            <Loader2 size={18} style={{ color: 'var(--amber)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          ) : (
            <Search size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen… Leads, Rechnungen, Seiten"
            className="flex-1 py-4 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
          />
          <kbd
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: 'var(--bg)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--border)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">

          {/* Recent searches (shown when no query) */}
          {query.trim().length === 0 && recentSearches.length > 0 && (
            <>
              <div className="flex items-center justify-between px-4 py-1.5">
                <p
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  Letzte Suchen
                </p>
                <button
                  onClick={handleClearRecent}
                  className="text-xs px-2 py-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  Löschen
                </button>
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleRecentClick(term)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="text-sm flex-1">{term}</span>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                </button>
              ))}
              <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '6px 16px' }} />
            </>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <>
              <p
                className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                Ergebnisse
              </p>
              {searchResults.map((r, i) => {
                const isSelected = i === selectedIndex;
                return (
                  <button
                    key={`r-${r.id}`}
                    data-idx={i}
                    onClick={() => handleSelect(i)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${TYPE_COLORS[r.type] || 'var(--text-muted)'}15`,
                        color: TYPE_COLORS[r.type] || 'var(--text-muted)',
                      }}
                    >
                      {TYPE_ICONS[r.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.title}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.subtitle}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: `${TYPE_COLORS[r.type] || 'var(--text-muted)'}15`,
                        color: TYPE_COLORS[r.type] || 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {TYPE_LABELS[r.type]}
                    </span>
                    <ArrowRight
                      size={14}
                      style={{ color: 'var(--text-secondary)', flexShrink: 0, opacity: isSelected ? 1 : 0 }}
                    />
                  </button>
                );
              })}
            </>
          )}

          {/* Command groups */}
          {Object.entries(groups).map(([category, cmds]) => (
            <div key={category}>
              <p
                className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: searchResults.length > 0 ? 4 : 0,
                }}
              >
                {category}
              </p>
              {cmds.map((cmd) => {
                cmdFlatIndex++;
                const idx = cmdFlatIndex;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    onClick={() => handleSelect(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
                    }}
                  >
                    <span style={{ color: isSelected ? 'var(--amber)' : 'var(--text-secondary)' }}>
                      {cmd.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cmd.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{cmd.description}</p>
                    </div>
                    {isSelected && (
                      <kbd
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: 'var(--bg)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Empty state */}
          {query.trim().length >= 2 && !searching && searchResults.length === 0 && filteredCommands.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              Keine Ergebnisse für &ldquo;{query}&rdquo;
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          <span>↑↓ navigieren</span>
          <span>↵ öffnen</span>
          <span>ESC schliessen</span>
        </div>
      </div>
    </div>
  );
}
