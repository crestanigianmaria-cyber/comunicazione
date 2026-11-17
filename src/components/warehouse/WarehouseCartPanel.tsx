import React from 'react';
import {
  AlignLeft,
  Minus,
  Package,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { ORDER_DOCUMENT_LABELS, Order, OrderDocumentType, Product } from '../../types';
import { EmptyState } from './ui/EmptyState';

export interface CartItem {
  id: string;
  product?: Product;
  quantity: number;
  unitOfMeasure?: string;
  isDescription?: boolean;
  description?: string;
}

interface WarehouseCartPanelProps {
  cart: CartItem[];
  documentType: OrderDocumentType | null;
  editingOrder: Order | null;
  isSubmitting: boolean;
  unitOptions: Record<string, string[]>;
  newUnitDraft: Record<string, string>;
  showDescriptionEditor: boolean;
  descriptionDraft: string;
  totalLines: number;
  productLinesCount: number;
  totalUnits: number;
  variant?: 'rail' | 'drawer' | 'inline';
  onCloseDrawer?: () => void;
  onToggleDescriptionEditor: () => void;
  onDescriptionDraftChange: (val: string) => void;
  onCancelDescription: () => void;
  onAddDescriptionLine: () => void;
  onRequestClearCart: () => void;
  onQuantityDelta: (productCode: string, delta: number) => void;
  onOpenQuantityPad: (item: CartItem) => void;
  onRemoveItem: (itemId: string) => void;
  onSelectUnit: (itemId: string, unit: string) => void;
  onNewUnitDraftChange: (productId: string, value: string) => void;
  onSaveCustomUnit: (itemId: string, productId: string) => Promise<void>;
  onOpenConfirmSubmit: () => void;
}

export const WarehouseCartPanel: React.FC<WarehouseCartPanelProps> = ({
  cart,
  documentType,
  editingOrder,
  isSubmitting,
  unitOptions,
  newUnitDraft,
  showDescriptionEditor,
  descriptionDraft,
  totalLines,
  productLinesCount,
  totalUnits,
  variant = 'rail',
  onCloseDrawer,
  onToggleDescriptionEditor,
  onDescriptionDraftChange,
  onCancelDescription,
  onAddDescriptionLine,
  onRequestClearCart,
  onQuantityDelta,
  onOpenQuantityPad,
  onRemoveItem,
  onSelectUnit,
  onNewUnitDraftChange,
  onSaveCustomUnit,
  onOpenConfirmSubmit,
}) => {
  const isInline = variant === 'inline';

  return (
    <div
      className={`flex flex-col bg-white ${
        isInline
          ? 'rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden'
          : variant === 'rail'
          ? 'rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden h-full'
          : 'h-full'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#0b0f19] text-white flex items-center justify-between gap-2 shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-600/90 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white truncate">
                {editingOrder ? `Carico ${editingOrder.order_number}` : 'Distinta Carrello'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white/15 font-mono text-[11px] font-black text-white tabular-nums">
                {totalLines}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {productLinesCount} {productLinesCount === 1 ? 'articolo' : 'articoli'} · {totalUnits} unità tot.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {totalLines > 0 && (
            <button
              type="button"
              onClick={onRequestClearCart}
              className="min-h-[38px] px-2.5 rounded-lg text-[11px] font-bold text-red-300 hover:text-white hover:bg-red-600/30 transition touch-manipulation"
            >
              Svuota
            </button>
          )}
          {onCloseDrawer && (
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Chiudi carrello"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-toolbar: + Nota Descrittiva trigger */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleDescriptionEditor}
          className={`min-h-[40px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition active:scale-[0.98] touch-manipulation ${
            showDescriptionEditor
              ? 'border-amber-400 bg-amber-50 text-amber-950'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 shadow-2xs'
          }`}
        >
          <AlignLeft className="w-4 h-4 text-red-600 shrink-0" />
          <span>{showDescriptionEditor ? 'Chiudi Nota Libera' : '+ Aggiungi Nota Descrittiva'}</span>
        </button>
      </div>

      {/* Inline Note Editor */}
      {showDescriptionEditor && (
        <div className="p-3.5 bg-amber-50/70 border-b border-amber-200 space-y-2.5 shrink-0 animate-wms-fade">
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-950">
            Nota / Riga Descrittiva Libera
          </label>
          <textarea
            value={descriptionDraft}
            onChange={e => onDescriptionDraftChange(e.target.value)}
            rows={2}
            maxLength={500}
            autoFocus
            placeholder="Es. Scarico con gru lato cantiere nord / Bancali a rendere..."
            className="w-full resize-y rounded-xl border border-amber-300 bg-white p-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-500">
              {descriptionDraft.length}/500
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelDescription}
                className="min-h-[40px] rounded-xl px-3.5 text-xs font-bold text-slate-700 hover:bg-white border border-slate-200 bg-white/60 transition touch-manipulation"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={onAddDescriptionLine}
                disabled={!descriptionDraft.trim()}
                className="min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 px-4 text-xs font-extrabold text-white disabled:opacity-40 transition touch-manipulation"
              >
                Inserisci Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Items Body */}
      <div
        className={`flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2.5 ${
          isInline ? '' : 'min-h-[200px]'
        }`}
      >
        {cart.length === 0 ? (
          <EmptyState
            icon={Package}
            compact
            title="Carrello carico vuoto"
            description="Cerca un articolo, tocca gli ultimi 8 utilizzati o scansiona un QR per iniziare."
          />
        ) : (
          cart.map((item, idx) => (
            <div
              key={item.id}
              className={`rounded-xl border transition ${
                item.isDescription
                  ? 'p-3.5 bg-amber-50/90 border-amber-200 border-l-4 border-l-amber-500'
                  : 'p-3.5 bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              {item.isDescription ? (
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-mono font-bold text-amber-800">
                        #{idx + 1}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wide text-amber-950">
                        <AlignLeft className="w-3 h-3" /> NOTA DESCRITTIVA
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                      {item.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label="Elimina nota descrittiva"
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition touch-manipulation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : item.product ? (
                <div className="space-y-3">
                  {/* Top metadata + delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-black text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded">
                          {item.product.code}
                        </span>
                        {item.product.alternative_code && (
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                            {item.product.alternative_code}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug break-words">
                        {item.product.description}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Rimuovi ${item.product.description}`}
                      className="w-10 h-10 -mr-1 -mt-1 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Unit of measure pills + quick custom UM */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono font-extrabold uppercase text-slate-400 mr-0.5">
                      U.M.
                    </span>
                    {[
                      ...new Set([
                        item.product.unit_of_measure,
                        ...(unitOptions[item.product.id] || []),
                      ]),
                    ].map(unit => {
                      const isSelected =
                        (item.unitOfMeasure || item.product!.unit_of_measure) === unit;
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => onSelectUnit(item.id, unit)}
                          className={`min-h-[38px] px-2.5 rounded-lg border text-[11px] font-mono font-black transition touch-manipulation ${
                            isSelected
                              ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          {unit}
                        </button>
                      );
                    })}

                    <div className="inline-flex items-center gap-1">
                      <input
                        value={newUnitDraft[item.product.id] || ''}
                        onChange={e => onNewUnitDraftChange(item.product!.id, e.target.value)}
                        placeholder="+ U.M."
                        aria-label="Nuova unità di misura"
                        className="w-[74px] min-h-[38px] rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-[11px] font-mono font-bold uppercase text-center focus:border-solid focus:bg-white focus:border-slate-900 outline-none"
                      />
                      {(newUnitDraft[item.product.id] || '').trim() && (
                        <button
                          type="button"
                          onClick={() => void onSaveCustomUnit(item.id, item.product!.id)}
                          className="min-h-[38px] px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-extrabold transition touch-manipulation"
                        >
                          Salva
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stepper Controls Row (- / Qty Touch Numpad / +) */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400">Quantità</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onQuantityDelta(item.product!.code, -1)}
                        aria-label="Diminuisci quantità"
                        className="w-12 h-11 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-300 text-slate-900 hover:bg-slate-200 active:scale-90 transition font-black touch-manipulation"
                      >
                        <Minus className="w-5 h-5 stroke-[3]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenQuantityPad(item)}
                        title="Tocca per aprire il tastierino numerico"
                        className="h-11 min-w-[5.75rem] px-3 bg-white border-2 border-slate-900 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 active:scale-95 transition touch-manipulation"
                      >
                        <span className="font-mono font-black text-base sm:text-lg text-slate-900 tabular-nums">
                          {item.quantity}
                        </span>
                        <span className="text-[11px] font-mono font-extrabold text-red-600 uppercase">
                          {item.unitOfMeasure || item.product.unit_of_measure}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onQuantityDelta(item.product!.code, 1)}
                        aria-label="Aumenta quantità"
                        className="w-12 h-11 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-90 transition font-black shadow-2xs touch-manipulation"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* Footer CTA (hidden when inline summary on mobile uses the persistent floating dock, or shown neatly for rail/drawer) */}
      {!isInline && (
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 pb-safe shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Documento selezionato:</span>
            {documentType ? (
              <span className="font-mono font-black text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                {ORDER_DOCUMENT_LABELS[documentType]}
              </span>
            ) : (
              <span className="font-bold text-red-600">Seleziona documento</span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenConfirmSubmit}
            disabled={cart.length === 0 || isSubmitting || !documentType}
            className="w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] disabled:opacity-40 disabled:hover:bg-red-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition tracking-wide uppercase touch-manipulation"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>
              {editingOrder ? 'Aggiorna Ordine' : "Trasmetti Ordine all'Ufficio"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
