import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ResponsiveSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerBadge?: React.ReactNode;
  headerTone?: 'dark' | 'light' | 'velux';
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const ResponsiveSheetModal: React.FC<ResponsiveSheetModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerBadge,
  headerTone = 'dark',
  maxWidthClass = 'sm:max-w-lg',
  children,
  footer,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headerClasses =
    headerTone === 'velux'
      ? 'bg-[#e30613] text-white border-b border-red-700'
      : headerTone === 'light'
      ? 'bg-slate-50 text-slate-900 border-b border-slate-200'
      : 'bg-[#0b0f19] text-white border-b border-slate-800';

  const closeBtnClasses =
    headerTone === 'light'
      ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
      : 'text-slate-300 hover:text-white hover:bg-white/15';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-[2px] sm:p-4 animate-wms-fade no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full ${maxWidthClass} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-wms-slide-up`}
      >
        {/* Mobile Sheet Handle */}
        <div className={`sm:hidden flex justify-center pt-2 pb-1 ${headerTone === 'light' ? 'bg-slate-50' : headerTone === 'velux' ? 'bg-[#e30613]' : 'bg-[#0b0f19]'}`}>
          <span className={`w-10 h-1 rounded-full ${headerTone === 'light' ? 'bg-slate-300' : 'bg-white/30'}`} />
        </div>

        {(title || headerBadge) && (
          <div className={`px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 shrink-0 ${headerClasses}`}>
            <div className="min-w-0 flex-1">
              {headerBadge && <div className="mb-1">{headerBadge}</div>}
              {title && (
                <h3 className="text-sm sm:text-base font-extrabold leading-tight truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className={`text-xs mt-0.5 truncate ${headerTone === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi finestra"
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition touch-manipulation ${closeBtnClasses}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 pb-safe shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
