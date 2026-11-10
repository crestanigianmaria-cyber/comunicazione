import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Hash,
  X,
  FileSpreadsheet,
  Check,
  Edit2
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
  onOpenExcelModal?: () => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  products,
  companySettings,
  isOnline,
  onOpenExcelModal,
}) => {
  const [customerReference, setCustomerReference] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Manual quantity editing state
  const [editingItemCode, setEditingItemCode] = useState<string | null>(null);
  const [editingQuantityInput, setEditingQuantityInput] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchProducts(products, searchQuery, 20);
  }, [products, searchQuery]);

  // Total lines and total units count
  const totalLines = cart.length;
  const totalUnits = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Handle adding product (one-touch add or increment)
  const handleAddProduct = (product: Product) => {
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

    // Provide haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }

    // Clear search query to keep UI clean, keep focus
    setSearchQuery('');
  };

  // Adjust quantity with +/-
  const handleQuantityDelta = (productCode: string, delta: number) => {
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

  // Open manual decimal quantity editing
  const handleStartEditQuantity = (item: CartItem) => {
    setEditingItemCode(item.product.code);
    setEditingQuantityInput(String(item.quantity).replace('.', ','));
  };

  const handleSaveQuantity = (productCode: string) => {
    const sanitized = editingQuantityInput.replace(',', '.').trim();
    const parsed = parseFloat(sanitized);

    if (!isNaN(parsed) && parsed > 0) {
      setCart(prevCart =>
        prevCart.map(item =>
          item.product.code === productCode ? { ...item, quantity: Number(parsed.toFixed(3)) } : item
        )
      );
    }
    setEditingItemCode(null);
    setEditingQuantityInput('');
  };

  // Remove item completely
  const handleRemoveItem = (productCode: string) => {
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
      // Clear cart
      setCart([]);
      setCustomerReference('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante l\'invio dell\'ordine';
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
      <div className="min-h-[calc(100vh-3.5rem)] bg-slate-900 text-white flex flex-col justify-center items-center p-6 text-center select-none">
        <div className="w-full max-w-sm bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-500/5">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-white mb-1">
            ORDINE INVIATO CORRETTAMENTE!
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            L'ufficio amministrativo ha ricevuto l'ordine in tempo reale.
          </p>

          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Numero Progressivo Assegnato
            </div>
            <div className="text-3xl font-black font-mono tracking-wider text-blue-400">
              {submittedOrderNumber}
            </div>
          </div>

          <button
            onClick={handleResetForNewOrder}
            className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 shadow-xl shadow-blue-600/25 active:scale-95 transition"
          >
            <RotateCcw className="w-5 h-5" />
            <span>INIZIA NUOVO ORDINE</span>
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // MAIN WAREHOUSE SCREEN
  // ------------------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-100 flex flex-col justify-between pb-28 md:pb-12">
      {/* Top Section */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-4 pb-2">
        {/* Title & Connection Header */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                NUOVO ORDINE CARICO
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
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
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Truck className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={customerReference}
              onChange={(e) => setCustomerReference(e.target.value)}
              placeholder="Riferimento cliente / Cantiere / Targa (facoltativo)"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Search Bar - Main Element of Interface */}
        <div className="relative mb-3">
          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per codice, descrizione o codice alternativo..."
              className="w-full pl-11 pr-10 py-3.5 bg-white border-2 border-slate-300 rounded-2xl text-sm font-semibold shadow-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search Instant Results Dropdown / Panel */}
          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs font-semibold text-slate-500">
                  Nessun articolo trovato per "{searchQuery}".
                </div>
              ) : (
                searchResults.map(prod => (
                  <button
                    key={prod.id || prod.code}
                    onClick={() => handleAddProduct(prod)}
                    className="w-full p-3 text-left hover:bg-blue-50/70 active:bg-blue-100/80 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                          {prod.code}
                        </span>
                        <span className="text-[11px] font-bold text-blue-600 uppercase">
                          {prod.unit_of_measure}
                        </span>
                        {prod.alternative_code && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Alt: {prod.alternative_code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-slate-900 line-clamp-1">
                        {prod.description}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-sm">
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Current Order Items Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 min-h-[220px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Articoli Inseriti ({totalLines} {totalLines === 1 ? 'riga' : 'righe'})
              </h2>
            </div>
            {totalLines > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700"
              >
                Svuota tutto
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <Package className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Nessun articolo nell'ordine</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                Usa la barra di ricerca in alto per aggiungere i materiali caricati dal cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((item) => (
                <div
                  key={item.product.code}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 transition hover:border-slate-300"
                >
                  {/* Left: Code, Description & Alternative Code */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-xs bg-slate-900 text-white px-1.5 py-0.5 rounded">
                        {item.product.code}
                      </span>
                      {item.product.alternative_code && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.product.alternative_code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-900 line-clamp-1">
                      {item.product.description}
                    </div>
                  </div>

                  {/* Right: Quantity Stepper & UM */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Stepper - */}
                    <button
                      onClick={() => handleQuantityDelta(item.product.code, -1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-90 transition font-bold"
                      aria-label="Diminuisci quantità"
                    >
                      <Minus className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    {/* Quantity Display / Manual Edit */}
                    {editingItemCode === item.product.code ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingQuantityInput}
                          onChange={(e) => setEditingQuantityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveQuantity(item.product.code);
                          }}
                          autoFocus
                          className="w-14 h-9 text-center font-mono font-bold text-sm bg-white border-2 border-blue-600 rounded-lg focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveQuantity(item.product.code)}
                          className="w-8 h-9 flex items-center justify-center bg-blue-600 text-white rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEditQuantity(item)}
                        className="px-2 h-9 min-w-[3.5rem] bg-white border border-slate-300 rounded-lg flex items-center justify-center gap-1 hover:border-blue-500 transition group"
                        title="Modifica quantità manualmente"
                      >
                        <span className="font-mono font-black text-sm text-slate-900">
                          {item.quantity}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 uppercase">
                          {item.product.unit_of_measure}
                        </span>
                      </button>
                    )}

                    {/* Stepper + */}
                    <button
                      onClick={() => handleQuantityDelta(item.product.code, 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-90 transition font-bold shadow-sm"
                      aria-label="Aumenta quantità"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    {/* Delete item button */}
                    <button
                      onClick={() => handleRemoveItem(item.product.code)}
                      className="w-8 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition ml-1"
                      title="Elimina articolo"
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
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 shadow-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Riepilogo Carico
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <span className="font-mono">{totalLines}</span> righe
              <span className="text-slate-400">·</span>
              <span className="font-mono">{totalUnits}</span> pezzi/unità
            </div>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={cart.length === 0 || isSubmitting}
            className="flex-1 max-w-sm h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-95 transition"
          >
            <Send className="w-4 h-4" />
            <span className="whitespace-nowrap">INVIA ORDINE ALL'UFFICIO</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal before Sending */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Conferma Invio Ordine</h3>
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
                    Cliente / Riferimento
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {customerReference}
                  </span>
                </div>
              )}

              <div className="text-xs font-bold text-slate-700">
                Riepilogo articoli ({cart.length} righe):
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.product.code} className="p-2.5 flex items-center justify-between text-xs bg-white">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="font-mono font-bold text-[11px] text-blue-700 mr-2">
                        {item.product.code}
                      </span>
                      <span className="text-slate-800 line-clamp-1">{item.product.description}</span>
                    </div>
                    <div className="font-mono font-bold text-slate-900 whitespace-nowrap">
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
                className="flex-1 h-11 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
              >
                Annulla e Modifica
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition"
              >
                {isSubmitting ? (
                  <span>Invio in corso...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>CONFERMA E TRASMETTI</span>
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
