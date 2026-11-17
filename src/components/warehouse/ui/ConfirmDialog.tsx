import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ResponsiveSheetModal } from './ResponsiveSheetModal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  tone = 'danger',
}) => {
  return (
    <ResponsiveSheetModal
      isOpen={isOpen}
      onClose={onCancel}
      maxWidthClass="sm:max-w-md"
      headerTone="light"
      title={title}
    >
      <div className="p-5 flex items-start gap-3.5">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-slate-900 text-white'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-700 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2.5 pb-safe">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold hover:bg-slate-100 active:scale-[0.98] transition touch-manipulation"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-1 min-h-[48px] px-4 rounded-xl text-white text-xs sm:text-sm font-extrabold shadow-sm active:scale-[0.98] transition touch-manipulation ${
            tone === 'danger'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-slate-900 hover:bg-slate-800'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ResponsiveSheetModal>
  );
};
