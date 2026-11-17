import React, { useEffect, useState } from 'react';
import { Check, Delete, RotateCcw } from 'lucide-react';
import { Product } from '../../types';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';

interface TouchNumpadModalProps {
  isOpen: boolean;
  product: Product | null;
  initialQuantity: number;
  unitOfMeasure: string;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  onTriggerHaptic?: () => void;
}

export const TouchNumpadModal: React.FC<TouchNumpadModalProps> = ({
  isOpen,
  product,
  initialQuantity,
  unitOfMeasure,
  onClose,
  onConfirm,
  onTriggerHaptic,
}) => {
  const [keypadValue, setKeypadValue] = useState<string>('1');
  const [freshOpen, setFreshOpen] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setKeypadValue(String(initialQuantity).replace('.', ','));
      setFreshOpen(true);
    }
  }, [isOpen, initialQuantity, product?.code]);

  if (!isOpen || !product) return null;

  const haptic = () => onTriggerHaptic?.();

  const handleDigit = (digit: string) => {
    haptic();
    setKeypadValue(prev => {
      if (freshOpen) {
        setFreshOpen(false);
        return digit === ',' ? '0,' : digit;
      }
      if (digit === ',' && (prev.includes(',') || prev.includes('.'))) {
        return prev;
      }
      if (prev === '0' && digit !== ',') {
        return digit;
      }
      if (prev.length >= 9) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    haptic();
    setFreshOpen(false);
    setKeypadValue(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleClear = () => {
    haptic();
    setFreshOpen(false);
    setKeypadValue('0');
  };

  const handleApplyDelta = (delta: number) => {
    haptic();
    setFreshOpen(false);
    const current = parseFloat(keypadValue.replace(',', '.')) || 0;
    const nextVal = Math.max(0.001, Number((current + delta).toFixed(3)));
    setKeypadValue(String(nextVal).replace('.', ','));
  };

  const sanitizedNumber = parseFloat(keypadValue.replace(',', '.').trim());
  const isValid = !isNaN(sanitizedNumber) && sanitizedNumber > 0;

  const handleConfirm = () => {
    if (!isValid) return;
    haptic();
    onConfirm(Number(sanitizedNumber.toFixed(3)));
  };

  return (
    <ResponsiveSheetModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="sm:max-w-md"
      headerTone="light"
      headerBadge={
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded">
            {product.code}
          </span>
          <span className="text-[11px] font-mono font-extrabold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
            U.M.: {unitOfMeasure}
          </span>
        </div>
      }
      title={product.description}
    >
      <div className="p-4 sm:p-5 space-y-3.5 pb-safe">
        {/* Numeric Display */}
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Quantità articolo"
            value={keypadValue}
            onChange={e => {
              setFreshOpen(false);
              setKeypadValue(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && isValid) {
                e.preventDefault();
                handleConfirm();
              }
            }}
            className="w-full h-16 text-center font-mono font-black text-3xl sm:text-4xl bg-[#0b0f19] text-white rounded-xl px-14 focus:outline-none focus:ring-2 focus:ring-red-600 transition tabular-nums"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-black text-xs text-slate-400 uppercase pointer-events-none">
            {unitOfMeasure}
          </span>
        </div>

        {/* Presets Row */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 5, 10, 25].map(delta => (
            <button
              key={delta}
              type="button"
              onClick={() => handleApplyDelta(delta)}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-mono font-extrabold text-xs sm:text-sm text-slate-900 active:scale-95 transition touch-manipulation"
            >
              +{delta}
            </button>
          ))}
        </div>

        {/* 3x4 Touch Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-13 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white active:bg-slate-200 font-mono font-black text-xl text-slate-900 shadow-2xs transition touch-manipulation"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleDigit(',')}
            aria-label="Separatore decimale virgola"
            className="h-13 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white active:bg-slate-200 font-mono font-black text-2xl text-slate-900 shadow-2xs transition touch-manipulation"
          >
            ,
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-13 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white active:bg-slate-200 font-mono font-black text-xl text-slate-900 shadow-2xs transition touch-manipulation"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Cancella ultima cifra"
            className="h-13 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-800 transition touch-manipulation"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Clear + Confirm CTA Row */}
        <div className="grid grid-cols-12 gap-2 pt-1">
          <button
            type="button"
            onClick={handleClear}
            className="col-span-4 h-13 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition touch-manipulation"
          >
            <RotateCcw className="w-4 h-4" />
            <span>C</span>
          </button>

          <button
            type="button"
            disabled={!isValid}
            onClick={handleConfirm}
            className="col-span-8 h-13 bg-red-600 hover:bg-red-700 disabled:opacity-45 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-[0.98] transition touch-manipulation"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>IMPOSTA QUANTITÀ</span>
          </button>
        </div>
      </div>
    </ResponsiveSheetModal>
  );
};
