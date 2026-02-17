'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'var(--green)',
  error: 'var(--red)',
  warning: 'var(--amber)',
  info: 'var(--blue)',
};

const glows: Record<ToastType, string> = {
  success: 'var(--green-glow, rgba(34,197,94,0.12))',
  error: 'var(--red-glow, rgba(239,68,68,0.12))',
  warning: 'var(--amber-glow, rgba(245,158,11,0.15))',
  info: 'var(--blue-glow, rgba(96,165,250,0.12))',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 380 }}
      >
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: colors[t.type],
                boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 15px ${glows[t.type]}`,
              }}
            >
              <Icon size={18} style={{ color: colors[t.type], flexShrink: 0 }} />
              <span className="text-sm flex-1" style={{ color: 'var(--text)' }}>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
