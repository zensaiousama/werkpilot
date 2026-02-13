'use client';

import { useState } from 'react';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production: send to webhook/API
    setIsSubmitted(true);
  };

  return (
    <>
      {/* Chat Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 md:bottom-6 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 ${
          isOpen ? 'rotate-0' : ''
        }`}
        style={{ backgroundColor: 'var(--color-accent)' }}
        aria-label={isOpen ? 'Chat schliessen' : 'Chat starten'}
        data-track="chat-widget"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 18L18 6M6 6l12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-36 md:bottom-24 right-4 z-40 w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {/* Header */}
          <div className="p-4" style={{ backgroundColor: 'var(--color-primary)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="8" y="2" width="4" height="7" fill="white" />
                  <rect x="2" y="8" width="7" height="4" fill="white" />
                  <rect x="11" y="8" width="7" height="4" fill="white" />
                  <rect x="8" y="11" width="4" height="7" fill="white" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">Werkpilot Support</p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Wir antworten in 2 Stunden
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            {isSubmitted ? (
              <div className="text-center py-6">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-success)', opacity: 0.15 }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>
                  Nachricht gesendet!
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Wir melden uns innerhalb von 2 Stunden.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  Fragen? Wir helfen gerne. Hinterlassen Sie uns eine Nachricht.
                </p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Ihr Name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 text-sm border rounded-lg"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <input
                    type="email"
                    placeholder="Ihre Email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 text-sm border rounded-lg"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <textarea
                    placeholder="Ihre Nachricht..."
                    required
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full p-2.5 text-sm border rounded-lg resize-none"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <button type="submit" className="btn btn-primary w-full justify-center text-sm py-2.5">
                    Nachricht senden
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
