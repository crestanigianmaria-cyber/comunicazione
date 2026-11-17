import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  message: string;
  detail?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem extends Required<ToastInput> {
  id: string;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, detail = '', tone = 'success', durationMs }: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timeout = durationMs ?? (tone === 'error' || tone === 'warning' ? 3800 : 2500);

      setToasts(prev => [{ id, message, detail, tone, durationMs: timeout }, ...prev].slice(0, 3));

      window.setTimeout(() => {
        dismissToast(id);
      }, timeout);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 z-[80] flex flex-col gap-2 sm:w-[360px] pointer-events-none no-print"
        >
          {toasts.map(toast => {
            const toneStyles =
              toast.tone === 'success'
                ? {
                    container: 'bg-[#0b0f19] text-white border-emerald-500/60',
                    iconWrap: 'bg-emerald-500/20 text-emerald-400',
                    Icon: CheckCircle2,
                  }
                : toast.tone === 'warning'
                ? {
                    container: 'bg-[#0b0f19] text-white border-amber-500/60',
                    iconWrap: 'bg-amber-500/20 text-amber-400',
                    Icon: AlertTriangle,
                  }
                : toast.tone === 'error'
                ? {
                    container: 'bg-red-950 text-white border-red-500/70',
                    iconWrap: 'bg-red-500/25 text-red-300',
                    Icon: AlertCircle,
                  }
                : {
                    container: 'bg-[#0b0f19] text-white border-slate-700',
                    iconWrap: 'bg-slate-700/60 text-slate-200',
                    Icon: Info,
                  };

            const Icon = toneStyles.Icon;

            return (
              <div
                key={toast.id}
                role="status"
                className={`pointer-events-auto animate-wms-slide-up flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 shadow-xl ${toneStyles.container}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneStyles.iconWrap}`}>
                    <Icon className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold leading-snug truncate">{toast.message}</p>
                    {toast.detail && (
                      <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5">{toast.detail}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Chiudi notifica"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition touch-manipulation shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
};
