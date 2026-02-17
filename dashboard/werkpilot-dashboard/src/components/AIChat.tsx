'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Minimize2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hallo! Ich bin Ihr AI-Assistent. Ich kann Ihnen bei der Analyse Ihrer Leads, Agent-Performance und Dashboard-Daten helfen. Was möchten Sie wissen?',
  timestamp: new Date(),
};

// Simulated AI responses based on keywords
function generateResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('lead') || lower.includes('crm')) {
    return 'Basierend auf Ihren CRM-Daten: Sie haben aktuell eine gesunde Pipeline mit steigendem Trend. Ich empfehle, sich auf die "Interested" und "Meeting" Leads zu konzentrieren — diese haben die höchste Konversionswahrscheinlichkeit. Die Branchen Treuhand und IT-Services zeigen das stärkste Wachstum.';
  }
  if (lower.includes('agent') || lower.includes('system')) {
    return 'System Health: 38 von 43 Agents laufen einwandfrei (88%). 3 Agents zeigen Warnungen (Sales-Dept), 2 haben Fehler (IT-Dept). Empfehlung: Priorisieren Sie die Fehlerbehebung bei den IT-Agents, da diese die Night-Shift-Automatisierung beeinflussen.';
  }
  if (lower.includes('night') || lower.includes('nacht')) {
    return 'Night Shift Status: Letzte Nacht wurden 14 Tasks erfolgreich abgeschlossen in 4h 23m. API-Kosten: $2.47. Performance-Score: 92%. Vorschlag für heute Nacht: Agent-Logs reviewen und die 3 niedrigsten Scores optimieren.';
  }
  if (lower.includes('revenue') || lower.includes('umsatz') || lower.includes('mrr')) {
    return 'MRR-Analyse: Ihr aktueller MRR zeigt einen positiven Trend von +12%. Pipeline-Value wächst um 8% gegenüber dem Vormonat. Top-Contributor: Treuhand-Branche (35%), gefolgt von IT-Services (22%). Empfehlung: Fokussieren Sie Akquise-Aktivitäten auf Beratungsfirmen — dort liegt ungenutztes Potenzial.';
  }
  if (lower.includes('scraper') || lower.includes('google')) {
    return 'Scraper-Insights: Die besten Ergebnisse kommen aktuell aus "Treuhand Zürich" (durchschnittlich 4.2 Google-Rating) und "Immobilien Basel" (höchste E-Mail-Verfügbarkeit bei 68%). Empfehlung: Nächste Scraping-Session auf "Beratung Bern" fokussieren — unterrepräsentierte Region mit hohem Potenzial.';
  }
  return 'Ich habe Ihre Daten analysiert. Hier sind die Key Insights:\n\n• Pipeline ist gesund mit 12% Wachstum\n• 88% Agent Health — 2 Agents brauchen Aufmerksamkeit\n• Night Shift hat letzte Nacht 14 Tasks erfolgreich erledigt\n• Top-Branche: Treuhand mit 35% der Leads\n\nMöchten Sie zu einem bestimmten Bereich mehr Details?';
}

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(0);

  // Listen for toggle event from CommandPalette
  useEffect(() => {
    function handleToggle() {
      setOpen(true);
      setMinimized(false);
    }
    document.addEventListener('toggle-ai-chat', handleToggle);
    return () => document.removeEventListener('toggle-ai-chat', handleToggle);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: `msg-${++counterRef.current}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Try real API, fallback to local generation
    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg.content }),
    })
      .then((r) => r.json())
      .then((data) => {
        const assistantMsg: Message = {
          id: `msg-${++counterRef.current}`,
          role: 'assistant',
          content: data.response || generateResponse(userMsg.content),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      })
      .catch(() => {
        const assistantMsg: Message = {
          id: `msg-${++counterRef.current}`,
          role: 'assistant',
          content: generateResponse(userMsg.content),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      });
  }, [input, isTyping]);

  // Floating button when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-2xl flex items-center justify-center transition-all"
        style={{
          backgroundColor: 'var(--amber)',
          color: '#000',
          boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
        }}
        aria-label="AI Chat öffnen"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  // Minimized state
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-4 py-3 rounded-2xl transition-all"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--amber)',
          color: 'var(--amber)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <Sparkles size={18} />
        <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
          AI Chat
        </span>
        {messages.length > 1 && (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: 'var(--amber)', color: '#000' }}
          >
            {messages.length - 1}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-[90] flex flex-col rounded-2xl border overflow-hidden animate-scale-in"
      style={{
        width: 400,
        maxWidth: 'calc(100vw - 48px)',
        height: 520,
        maxHeight: 'calc(100vh - 120px)',
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--amber-glow, rgba(245,158,11,0.15))' }}
          >
            <Sparkles size={16} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
              AI Assistant
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Powered by Claude
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Minimieren"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Schliessen"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor:
                  msg.role === 'assistant'
                    ? 'var(--amber-glow, rgba(245,158,11,0.15))'
                    : 'var(--blue-glow, rgba(96,165,250,0.12))',
              }}
            >
              {msg.role === 'assistant' ? (
                <Bot size={14} style={{ color: 'var(--amber)' }} />
              ) : (
                <User size={14} style={{ color: 'var(--blue)' }} />
              )}
            </div>
            <div
              className="max-w-[80%] rounded-xl px-3.5 py-2.5"
              style={{
                backgroundColor:
                  msg.role === 'user' ? 'var(--amber-glow, rgba(245,158,11,0.15))' : 'var(--bg)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: msg.role === 'user' ? 'rgba(245,158,11,0.2)' : 'var(--border)',
              }}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--text)' }}
              >
                {msg.content}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {msg.timestamp.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--amber-glow, rgba(245,158,11,0.15))' }}
            >
              <Bot size={14} style={{ color: 'var(--amber)' }} />
            </div>
            <div
              className="rounded-xl px-3.5 py-2.5"
              style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <span className="ai-thinking text-sm" style={{ color: 'var(--text-muted)' }}>
                Analysiere
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {['Lead-Analyse', 'Agent Status', 'Night Shift Report', 'Revenue Insights'].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                // Directly create and send the message
                const userMsg: Message = {
                  id: `msg-${++counterRef.current}`,
                  role: 'user',
                  content: prompt,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMsg]);
                setIsTyping(true);
                fetch('/api/ai/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: prompt }),
                })
                  .then((r) => r.json())
                  .then((data) => {
                    setMessages((prev) => [...prev, {
                      id: `msg-${++counterRef.current}`,
                      role: 'assistant' as const,
                      content: data.response || generateResponse(prompt),
                      timestamp: new Date(),
                    }]);
                    setIsTyping(false);
                  })
                  .catch(() => {
                    setMessages((prev) => [...prev, {
                      id: `msg-${++counterRef.current}`,
                      role: 'assistant' as const,
                      content: generateResponse(prompt),
                      timestamp: new Date(),
                    }]);
                    setIsTyping(false);
                  });
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs border transition-colors"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Fragen Sie den AI-Assistenten..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--text)' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="p-2 rounded-lg transition-all"
          style={{
            backgroundColor: input.trim() ? 'var(--amber)' : 'transparent',
            color: input.trim() ? '#000' : 'var(--text-muted)',
            opacity: isTyping ? 0.5 : 1,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
