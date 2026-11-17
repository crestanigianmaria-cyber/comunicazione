import React, { useState, useEffect } from 'react';
import { UserCheck, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order } from '../../types';

const OPERATORS_STORAGE_KEY = 'saggin_office_operators_v1';
const LAST_OPERATOR_STORAGE_KEY = 'saggin_last_office_operator_v1';

interface CompleteOrderOperatorModalProps {
  order: Order;
  onCancel: () => void;
  onConfirm: (operatorName: string) => Promise<void> | void;
}

export const CompleteOrderOperatorModal: React.FC<CompleteOrderOperatorModalProps> = ({
  order,
  onCancel,
  onConfirm,
}) => {
  const [recentOperators, setRecentOperators] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(OPERATORS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
    } catch {
      return [];
    }
  });

  const [operatorName, setOperatorName] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_OPERATOR_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isSubmitting]);

  const submitOperator = async (nameToSave: string) => {
    const trimmed = nameToSave.trim();
    if (!trimmed) {
      setError("Inserisci il nome dell'operatore ufficio che sta completando l'ordine.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const nextRecent = [
        trimmed,
        ...recentOperators.filter((n) => n.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 8);
      setRecentOperators(nextRecent);
      try {
        localStorage.setItem(OPERATORS_STORAGE_KEY, JSON.stringify(nextRecent));
        localStorage.setItem(LAST_OPERATOR_STORAGE_KEY, trimmed);
      } catch {
        // Ignore storage errors
      }
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitOperator(operatorName);
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-emerald-600" />
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">Conferma Evasione Ordine</h3>
              <p className="text-[11px] font-mono text-slate-300">
                {order.order_number}
                {order.customer_reference ? ` · ${order.customer_reference}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-600 font-medium leading-relaxed">
            Prima di spostare l&apos;ordine in <strong className="text-emerald-700">COMPLETATO</strong>, indica il nome del dipendente dell&apos;ufficio che ha eseguito l&apos;operazione.
          </div>

          {recentOperators.length > 0 && (
            <div>
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Selezione Rapida Operatore
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentOperators.map((name) => {
                  const isSelected = operatorName.trim().toLowerCase() === name.toLowerCase();
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setOperatorName(name);
                        setError(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Nome Operatore Ufficio *
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => {
                setOperatorName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Es. Marco, Giulia, Luca..."
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvataggio...' : 'Conferma Completato'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
