import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Package,
  ClipboardCheck,
  Clock,
  MessageSquareText,
  X,
} from 'lucide-react';
import { WarehouseReminder } from '../../types';
import {
  formatReminderDayLabel,
  getLocalDateKey,
  loadLastReminderOperator,
  loadRecentReminderOperators,
  saveReminderOperatorChoice,
} from '../../lib/reminders';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';

interface CompleteReminderModalProps {
  reminder: WarehouseReminder | null;
  operatorMode?: 'magazzino' | 'ufficio';
  onCancel: () => void;
  onConfirm: (operatorName: string, completionNote?: string) => Promise<void> | void;
}

export const CompleteReminderModal: React.FC<CompleteReminderModalProps> = ({
  reminder,
  operatorMode = 'magazzino',
  onCancel,
  onConfirm,
}) => {
  const [recentOperators, setRecentOperators] = useState<string[]>([]);
  const [operatorName, setOperatorName] = useState('');
  const [completionNote, setCompletionNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!reminder) return;
    const recents = loadRecentReminderOperators(operatorMode);
    const last = loadLastReminderOperator(operatorMode);
    setRecentOperators(recents);
    setOperatorName(last);
    setCompletionNote('');
    setError(null);
    setIsSubmitting(false);
  }, [reminder, operatorMode]);

  if (!reminder) return null;

  const todayKey = getLocalDateKey();
  const isOrderPrep = reminder.category === 'ORDINE_DA_PREPARARE';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = operatorName.trim();
    if (!trimmed) {
      setError("Inserisci o seleziona chi ha completato l'attività.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const next = saveReminderOperatorChoice(trimmed, operatorMode);
      setRecentOperators(next);
      await onConfirm(trimmed, completionNote.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveSheetModal
      isOpen={Boolean(reminder)}
      onClose={() => {
        if (!isSubmitting) onCancel();
      }}
      headerTone="dark"
      maxWidthClass="sm:max-w-md"
      title="Chi ha completato l'attività?"
      subtitle="Inserisci chi ha svolto l'attività"
      headerBadge={
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
          <UserCheck className="w-3 h-3" />
          <span>Tracciamento Operatore</span>
        </span>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm sm:text-xs font-extrabold transition touch-manipulation"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="min-h-[48px] flex-1 sm:flex-none px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm sm:text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition disabled:opacity-60 touch-manipulation"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? 'Salvataggio...' : 'Conferma Completato'}</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
        {/* Summary of task being completed */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase ${
                isOrderPrep
                  ? 'bg-sky-100 text-sky-900 border border-sky-200'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {isOrderPrep ? (
                <Package className="w-3 h-3" />
              ) : (
                <ClipboardCheck className="w-3 h-3" />
              )}
              <span>{isOrderPrep ? 'Ordine da preparare' : 'Attività'}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-700">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                {formatReminderDayLabel(reminder.due_date, todayKey)}
                {reminder.due_time ? ` · ${reminder.due_time}` : ''}
              </span>
            </span>
          </div>

          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
            {reminder.title}
          </h4>

          {reminder.customer_reference && (
            <div className="text-xs font-bold text-slate-600">
              Rif. Cliente: <span className="text-slate-900">{reminder.customer_reference}</span>
            </div>
          )}
        </div>

        {/* Recent Operator Quick Chips */}
        {recentOperators.length > 0 && (
          <div>
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              Selezione Rapida Operatore
            </span>
            <div className="flex flex-wrap gap-2">
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
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-extrabold border transition touch-manipulation ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Operator Name Input */}
        <div>
          <label
            htmlFor="reminder-completed-by-input"
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Nome di chi ha completato *
          </label>
          <div className="relative">
            <input
              id="reminder-completed-by-input"
              type="text"
              value={operatorName}
              onChange={(e) => {
                setOperatorName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Es. Marco, Luca, Matteo..."
              autoFocus={recentOperators.length === 0}
              className="w-full min-h-[48px] pl-3.5 pr-11 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
            />
            {operatorName && (
              <button
                type="button"
                onClick={() => setOperatorName('')}
                aria-label="Cancella nome operatore"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Optional Note */}
        <div>
          <label
            htmlFor="reminder-completion-note-input"
            className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Nota chiusura (Opzionale)</span>
          </label>
          <input
            id="reminder-completion-note-input"
            type="text"
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            placeholder="Es. Bancale pronto in corsia B / caricato..."
            className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </ResponsiveSheetModal>
  );
};
