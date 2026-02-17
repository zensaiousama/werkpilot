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
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    { id: 'dashboard', label: 'Dashboard', description: 'Executive overview', icon: <LayoutDashboard size={18} />, action: () => router.push('/'), category: 'Navigation' },
    { id: 'crm', label: 'CRM', description: 'Manage leads & clients', icon: <Users size={18} />, action: () => router.push('/crm'), category: 'Navigation' },
    { id: 'scraper', label: 'Lead Scraper', description: 'Find new leads', icon: <Search size={18} />, action: () => router.push('/scraper'), category: 'Navigation' },
    { id: 'agents', label: 'AI Agents', description: 'Monitor 43 agents', icon: <Bot size={18} />, action: () => router.push('/agents'), category: 'Navigation' },
    { id: 'nightshift', label: 'Night Shift', description: 'Automation control', icon: <Moon size={18} />, action: () => router.push('/nightshift'), category: 'Navigation' },
    { id: 'analytics', label: 'Analytics', description: 'Charts & insights', icon: <BarChart3 size={18} />, action: () => router.push('/analytics'), category: 'Navigation' },
    { id: 'settings', label: 'Settings', description: 'Configuration', icon: <Settings size={18} />, action: () => router.push('/settings'), category: 'Navigation' },
    { id: 'ai-chat', label: 'AI Assistant', description: 'Ask Claude anything', icon: <MessageSquare size={18} />, action: () => { document.dispatchEvent(new CustomEvent('toggle-ai-chat')); }, category: 'AI' },
    { id: 'trigger-agents', label: 'Trigger All Agents', description: 'Run all idle agents', icon: <Zap size={18} />, action: () => { document.dispatchEvent(new CustomEvent('trigger-all-agents')); }, category: 'Actions' },
  ];

  const filtered = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const executeCommand = useCallback(
    (cmd: Command) => {
      handleClose();
      cmd.action();
    },
    [handleClose]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) handleClose();
        else handleOpen();
      }
      // Escape to close
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleOpen, handleClose]);

  // Arrow navigation
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        executeCommand(filtered[selectedIndex]);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, executeCommand]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  // Group commands by category
  const groups: Record<string, Command[]> = {};
  filtered.forEach((cmd) => {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  });

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] cmd-palette-backdrop"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden animate-scale-in"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Seiten, Aktionen..."
            className="flex-1 py-4 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
          />
          <kbd
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: 'var(--bg)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--border)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[340px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Keine Ergebnisse für &ldquo;{query}&rdquo;
            </p>
          )}
          {Object.entries(groups).map(([category, cmds]) => (
            <div key={category}>
              <p
                className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {category}
              </p>
              {cmds.map((cmd) => {
                flatIndex++;
                const idx = flatIndex;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--surface-hover)' : 'transparent',
                      color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span style={{ color: isSelected ? 'var(--amber)' : 'var(--text-muted)' }}>
                      {cmd.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cmd.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cmd.description}</p>
                    </div>
                    {isSelected && (
                      <kbd
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: 'var(--bg)',
                          color: 'var(--text-muted)',
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
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <span>↑↓ Navigieren</span>
          <span>↵ Öffnen</span>
          <span>ESC Schliessen</span>
        </div>
      </div>
    </div>
  );
}
