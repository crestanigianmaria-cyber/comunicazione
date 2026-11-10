import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  RotateCcw,
  Package,
  AlertCircle,
  Truck,
  X,
  Check,
  Calculator,
  Layers
} from 'lucide-react';
import { Product, CompanySettings } from '../../types';
import { searchProducts } from '../../lib/search';
import { createNewOrder } from '../../services/db';

interface CartItem {
  product: Product;
  quantity: number;
}

interface WarehouseViewProps {
  products: Product[];
  companySettings: CompanySettings;
  isOnline: boolean;
  isProductsLoading?: boolean;
  onOpenExcelModal?: () => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  products,
  companySettings,
  isOnline,
  isProductsLoading = false,
}) => {
  const [customerReference, setCustomerReference] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dedicated Mobile Quick Quantity Pad Modal
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [keypadValue, setKeypadValue] = useState<string>('1');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchProducts(products, searchQuery, 25);
  }, [products, searchQuery]);

  // Total lines and total units count
  const totalLines = cart.length;
  const totalUnits = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Haptic feedback helper
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {
        // Ignore
      }
    }
  };

  // Handle adding product (one-touch add or increment)
  const handleAddProduct = (product: Product) => {
    triggerHaptic();
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product.code === product.code);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Number((updated[existingIndex].quantity + 1).toFixed(3)),
        };
        return updated;
      } else {
        return [{ product, quantity: 1 }, ...prevCart];
      }
    });

    // Clear search query to immediately show the updated order
    setSearchQuery('');
  };

  // Adjust quantity with +/-
  const handleQuantityDelta = (productCode: string, delta: number) => {
    triggerHaptic();
    setCart(prevCart => {
      return prevCart
        .map(item => {
          if (item.product.code === productCode) {
            const newQty = Number((item.quantity + delta).toFixed(3));
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Open dedicated mobile quantity editor
  const handleOpenQuantityPad = (item: CartItem) => {
    triggerHaptic();
    setEditingItem(item);
    setKeypadValue(String(item.quantity).replace('.', ','));
  };

  const handleApplyPreset = (delta: number) => {
    triggerHaptic();
    const current = parseFloat(keypadValue.replace(',', '.')) || 0;
    const nextVal = Math.max(1, Number((current + delta).toFixed(3)));
    setKeypadValue(String(nextVal).replace('.', ','));
  };

  const handleSetExact = (val: number) => {
    triggerHaptic();
    setKeypadValue(String(val).replace('.', ','));
  };

  const handleSaveQuantityPad = () => {
    if (!editingItem) return;
    triggerHaptic();
    const sanitized = keypadValue.replace(',', '.').trim();
    const parsed = parseFloat(sanitized);

    if (!isNaN(parsed) && parsed > 0) {
      setCart(prevCart =>
        prevCart.map(item =>
          item.product.code === editingItem.product.code
            ? { ...item, quantity: Number(parsed.toFixed(3)) }
            : item
        )
      );
    }
    setEditingItem(null);
  };

  // Remove item completely
  const handleRemoveItem = (productCode: string) => {
    triggerHaptic();
    setCart(prevCart => prevCart.filter(item => item.product.code !== productCode));
  };

  // Order submission
  const handleConfirmSubmit = async () => {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const newOrder = await createNewOrder({
        customer_reference: customerReference.trim() || null,
        items: cart,
      });

      setSubmittedOrderNumber(newOrder.order_number);
      setShowConfirmModal(false);
      setCart([]);
      setCustomerReference('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante l'invio dell'ordine";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewOrder = () => {
    setSubmittedOrderNumber(null);
    setCart([]);
    setCustomerReference('');
    setSearchQuery('');
  };

  // ------------------------------------------------------------------------
  // SCREEN: ORDER SUBMITTED SUCCESSFULLY
  // ------------------------------------------------------------------------
  if (submittedOrderNumber) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 py-8 text-center select-none">
        <div className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-5 ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>

          <span className="text-[11px] font-black tracking-widest text-emerald-700 uppercase bg-emerald-100/70 px-3 py-1 rounded-full mb-2">
            Trasmissione Completata
          </span>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mb-1">
            ORDINE INVIATO CORRETTAMENTE!
          </h2>
          <p className="text-xs text-slate-500 mb-6 max-w-xs">
            L'ufficio di {companySettings.companyName || 'Saggin'} ha ricevuto l'ordine in tempo reale.
          </p>

          <div className="w-full bg-slate-950 rounded-2xl p-4 sm:p-5 mb-6 text-center shadow-inner">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              NUMERO PROGRESSIVO ASSEGNATO
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-blue-400">
              {submittedOrderNumber}
            </div>
          </div>

          <button
            onClick={handleResetForNewOrder}
            className="w-full h-14 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold rounded-2xl text-base flex items-center justify-center gap-2.5 shadow-xl shadow-blue-600/25 transition"
          >
            <RotateCcw className="w-5 h-5" />
            <span>INIZIA NUOVO CARICO</span>
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // MAIN WAREHOUSE SCREEN (OPTIMIZED FOR MOBILE SMARTPHONE)
  // ------------------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between pb-32">
      {/* Top Section */}
      <div className="max-w-xl mx-auto w-full space-y-3">
        {/* Title & Connection Header */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                {companySettings.companyName || 'SAGGIN'} · NUOVO ORDINE
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Customer / Jobsite Reference (Optional) */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Truck className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={customerReference}
              onChange={(e) => setCustomerReference(e.target.value)}
              placeholder="Riferimento cliente / Cantiere / Targa (facoltativo)"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Primary Search Bar - Ergonomic Touch Zone */}
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isProductsLoading}
              placeholder={isProductsLoading ? "Caricamento catalogo articoli..." : "Cerca per codice, descrizione o barcode..."}
              className="w-full pl-12 pr-12 py-3.5 bg-white border-2 border-slate-300 rounded-2xl text-sm font-bold shadow-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-700 active:scale-95"
                aria-label="Cancella ricerca"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {isProductsLoading && (
            <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-xs font-semibold text-blue-800">
              Caricamento del catalogo articoli da Supabase. La ricerca sarà disponibile tra pochi istanti.
            </div>
          )}

          {/* Search Instant Results Dropdown Panel */}
          {!isProductsLoading && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {searchResults.length === 0 ? (
                <div className="p-5 text-center text-xs font-bold text-slate-500">
                  Nessun articolo trovato per "{searchQuery}".
                </div>
              ) : (
                searchResults.map(prod => (
                  <button
                    key={prod.code}
                    onClick={() => handleAddProduct(prod)}
                    className="w-full p-3.5 text-left hover:bg-blue-50/70 active:bg-blue-100 transition flex items-start justify-between gap-3 min-h-[56px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-black text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                          {prod.code}
                        </span>
                        <span className="text-[11px] font-black text-blue-600 uppercase">
                          {prod.unit_of_measure}
                        </span>
                        {prod.alternative_code && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Alt: {prod.alternative_code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 whitespace-normal break-words leading-relaxed">
                        {prod.description}
                      </div>
                    </div>

                    <div className="shrink-0 mt-1 flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white shadow-md active:scale-90 transition">
                      <Plus className="w-5 h-5 stroke-[3]" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Current Order Items Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 min-h-[240px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-600" />
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Articoli Inseriti ({totalLines} {totalLines === 1 ? 'riga' : 'righe'})
              </h2>
            </div>
            {totalLines > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 active:scale-95 py-1 px-2"
              >
                Svuota tutto
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <Package className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Nessun articolo nell'ordine</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Usa la barra di ricerca in alto per aggiungere i materiali caricati sul mezzo del cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.product.code}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                >
                  {/* Left: Code, Description & Alternative Code */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-black text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                        {item.product.code}
                      </span>
                      {item.product.alternative_code && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.product.alternative_code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {item.product.description}
                    </div>
                  </div>

                  {/* Right: Touch Controls with Large Hitboxes (Min 44x44px) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Stepper - (Touch hitbox 44px) */}
                    <button
                      onClick={() => handleQuantityDelta(item.product.code, -1)}
                      className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-90 transition font-black shadow-xs"
                      aria-label="Diminuisci quantità"
                    >
                      <Minus className="w-5 h-5 stroke-[3]" />
                    </button>

                    {/* Quantity Display Button (Opens Quick Numeric Keypad Modal) */}
                    <button
                      onClick={() => handleOpenQuantityPad(item)}
                      className="h-11 min-w-[4rem] px-2.5 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center gap-1 hover:border-blue-500 active:scale-95 transition shadow-xs"
                      title="Tocca per modificare la quantità con il tastierino rapido"
                    >
                      <span className="font-mono font-black text-base text-slate-900">
                        {item.quantity}
                      </span>
                      <span className="text-[11px] font-black text-blue-700 uppercase">
                        {item.product.unit_of_measure}
                      </span>
                    </button>

                    {/* Stepper + (Touch hitbox 44px) */}
                    <button
                      onClick={() => handleQuantityDelta(item.product.code, 1)}
                      className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-90 transition font-black shadow-sm shadow-blue-500/20"
                      aria-label="Aumenta quantità"
                    >
                      <Plus className="w-5 h-5 stroke-[3]" />
                    </button>

                    {/* Delete item button */}
                    <button
                      onClick={() => handleRemoveItem(item.product.code)}
                      className="w-10 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition ml-0.5"
                      title="Elimina riga"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Ergonomic Thumb Zone CTA Bar for Smartphone */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 shadow-2xl pb-safe">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              TOTALE CARICO
            </span>
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
              <span className="font-mono text-sm">{totalLines}</span> righe
              <span className="text-slate-300">·</span>
              <span className="font-mono text-sm">{totalUnits}</span> unità
            </div>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={cart.length === 0 || isSubmitting}
            className="flex-1 max-w-sm h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition tracking-wide"
          >
            <Send className="w-4 h-4" />
            <span className="whitespace-nowrap uppercase">INVIA ORDINE ALL'UFFICIO</span>
          </button>
        </div>
      </div>

      {/* Quick Mobile Quantity Keypad Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-8 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                  {editingItem.product.code}
                </span>
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mt-1">
                  {editingItem.product.description}
                </h4>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Display / Input */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Quantità ({editingItem.product.unit_of_measure})
              </span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={keypadValue}
                  onChange={(e) => setKeypadValue(e.target.value)}
                  autoFocus
                  className="w-full h-14 text-center font-mono font-black text-2xl bg-slate-50 border-2 border-blue-600 rounded-2xl focus:outline-none focus:bg-white transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-500 uppercase">
                  {editingItem.product.unit_of_measure}
                </span>
              </div>
            </div>

            {/* Quick Presets for Building Materials */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Incrementi Rapidi
              </span>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(1)}
                  className="h-10 rounded-xl bg-slate-100 font-bold text-xs text-slate-800 hover:bg-slate-200 active:scale-90 transition"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(5)}
                  className="h-10 rounded-xl bg-slate-100 font-bold text-xs text-slate-800 hover:bg-slate-200 active:scale-90 transition"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(10)}
                  className="h-10 rounded-xl bg-slate-100 font-bold text-xs text-slate-800 hover:bg-slate-200 active:scale-90 transition"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(25)}
                  className="h-10 rounded-xl bg-slate-100 font-bold text-xs text-slate-800 hover:bg-slate-200 active:scale-90 transition"
                >
                  +25
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleSetExact(10)}
                  className="h-9 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs active:scale-90 transition"
                >
                  Esatti: 10
                </button>
                <button
                  type="button"
                  onClick={() => handleSetExact(50)}
                  className="h-9 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs active:scale-90 transition"
                >
                  Esatti: 50
                </button>
                <button
                  type="button"
                  onClick={() => handleSetExact(100)}
                  className="h-9 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs active:scale-90 transition"
                >
                  Esatti: 100
                </button>
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleSaveQuantityPad}
              className="w-full h-12 bg-slate-950 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <span>Conferma Quantità</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Sending */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Conferma Invio Ordine all'Ufficio</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {customerReference && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Cliente / Riferimento Carico
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {customerReference}
                  </span>
                </div>
              )}

              <div className="text-xs font-bold text-slate-700">
                Riepilogo articoli caricati ({cart.length} righe):
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.product.code} className="p-2.5 flex items-center justify-between text-xs bg-white">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="font-mono font-bold text-[11px] text-blue-700 mr-2">
                        {item.product.code}
                      </span>
                      <span className="text-slate-800 line-clamp-1">{item.product.description}</span>
                    </div>
                    <div className="font-mono font-black text-slate-900 whitespace-nowrap">
                      {item.quantity} {item.product.unit_of_measure}
                    </div>
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 active:scale-95 transition"
              >
                Modifica
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-95 transition uppercase"
              >
                {isSubmitting ? (
                  <span>Invio in corso...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Conferma e Invia</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
