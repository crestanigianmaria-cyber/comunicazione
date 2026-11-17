import React, { useState, useMemo, useRef, useDeferredValue } from 'react';
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
  Layers,
  Receipt,
  FileText,
  AlignLeft,
  Delete,
  Warehouse,
  Hash
} from 'lucide-react';
import { Product, CompanySettings, OrderDocumentType, ORDER_DOCUMENT_LABELS, WarehouseLocation } from '../../types';
import { searchProducts } from '../../lib/search';
import { createNewOrder, fetchProductUnitOptions, saveProductUnitOption } from '../../services/db';

interface CartItem {
  id: string;
  product?: Product;
  quantity: number;
  unitOfMeasure?: string;
  isDescription?: boolean;
  description?: string;
}

interface WarehouseViewProps {
  products: Product[];
  companySettings: CompanySettings;
  isOnline: boolean;
  isProductsLoading?: boolean;
  onOpenExcelModal?: () => void;
}

const DRAFT_STORAGE_KEY = 'magazzino_active_draft_v1';
const RECENT_CODES_STORAGE_KEY = 'magazzino_recent_product_codes_v1';

interface SavedDraft {
  customerReference?: string;
  documentType?: OrderDocumentType | null;
  cart?: CartItem[];
}

function loadSavedDraft(): SavedDraft {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SavedDraft;
  } catch {
    return {};
  }
}

function loadRecentCodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CODES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  products,
  companySettings,
  isOnline,
  isProductsLoading = false,
}) => {
  const initialDraft = useMemo(() => loadSavedDraft(), []);

  const [customerReference, setCustomerReference] = useState(() => initialDraft.customerReference || '');
  const [warehouseLocation, setWarehouseLocation] = useState<WarehouseLocation>(() => {
    try {
      return (localStorage.getItem('saggin_warehouse_location') as WarehouseLocation) || 'MAGAZZINO';
    } catch {
      return 'MAGAZZINO';
    }
  });
  const [unitOptions, setUnitOptions] = useState<Record<string, string[]>>({});
  const [newUnitDraft, setNewUnitDraft] = useState<Record<string, string>>({});
  const [documentType, setDocumentType] = useState<OrderDocumentType | null>(() => initialDraft.documentType || null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [cart, setCart] = useState<CartItem[]>(() => Array.isArray(initialDraft.cart) ? initialDraft.cart : []);
  const [recentCodes, setRecentCodes] = useState<string[]>(() => loadRecentCodes());
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dedicated Mobile & Tablet Touch Quick Quantity Pad Modal
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [keypadValue, setKeypadValue] = useState<string>('1');
  const [keypadFreshOpen, setKeypadFreshOpen] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist active draft automatically so phone lock / refresh never loses a load in progress
  React.useEffect(() => {
    try {
      if (cart.length === 0 && !customerReference.trim() && !documentType) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ customerReference, documentType, cart })
        );
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [cart, customerReference, documentType]);

  // Preload custom unit options for any restored cart items
  React.useEffect(() => {
    for (const item of cart) {
      if (item.product?.id && !unitOptions[item.product.id]) {
        const pid = item.product.id;
        void fetchProductUnitOptions(pid).then(options =>
          setUnitOptions(prev => ({ ...prev, [pid]: options }))
        );
      }
    }
  }, []);

  // Resolve recent products from catalog for 1-tap quick add
  const recentProducts = useMemo(() => {
    if (recentCodes.length === 0 || products.length === 0) return [];
    const byCode = new Map(products.map(p => [p.code, p]));
    return recentCodes
      .map(code => byCode.get(code))
      .filter((p): p is Product => Boolean(p))
      .slice(0, 6);
  }, [recentCodes, products]);

  // Map of product codes currently in cart for instant visual indicator during search
  const cartQuantitiesByCode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      if (item.product?.code) {
        map[item.product.code] = item.quantity;
      }
    }
    return map;
  }, [cart]);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!deferredSearchQuery.trim()) return [];
    return searchProducts(products, deferredSearchQuery, 30);
  }, [products, deferredSearchQuery]);

  // Total lines and total units count
  const totalLines = cart.length;
  const productLinesCount = useMemo(
    () => cart.filter(item => !item.isDescription && item.product).length,
    [cart]
  );
  const totalUnits = useMemo(() => {
    return Number(cart.reduce((acc, item) => acc + (item.isDescription ? 0 : item.quantity), 0).toFixed(3));
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
    if (!documentType) return;
    triggerHaptic();

    // Track in recent products for 1-tap quick picks
    setRecentCodes(prev => {
      const next = [product.code, ...prev.filter(c => c !== product.code)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_CODES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product?.code === product.code);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Number((updated[existingIndex].quantity + 1).toFixed(3)),
        };
        return updated;
      } else {
        void fetchProductUnitOptions(product.id).then(options =>
          setUnitOptions(prev => ({ ...prev, [product.id]: options }))
        );
        return [{ id: product.code, product, quantity: 1, unitOfMeasure: product.unit_of_measure }, ...prevCart];
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
          if (item.product?.code === productCode) {
            const newQty = Number((item.quantity + delta).toFixed(3));
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Open dedicated mobile/tablet quantity editor
  const handleOpenQuantityPad = (item: CartItem) => {
    triggerHaptic();
    setEditingItem(item);
    setKeypadValue(String(item.quantity).replace('.', ','));
    setKeypadFreshOpen(true);
  };

  const handleNumpadDigit = (digit: string) => {
    triggerHaptic();
    setKeypadValue(prev => {
      if (keypadFreshOpen) {
        setKeypadFreshOpen(false);
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

  const handleNumpadBackspace = () => {
    triggerHaptic();
    setKeypadFreshOpen(false);
    setKeypadValue(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleApplyPreset = (delta: number) => {
    triggerHaptic();
    setKeypadFreshOpen(false);
    const current = parseFloat(keypadValue.replace(',', '.')) || 0;
    const nextVal = Math.max(1, Number((current + delta).toFixed(3)));
    setKeypadValue(String(nextVal).replace('.', ','));
  };

  const handleSetExact = (val: number) => {
    triggerHaptic();
    setKeypadFreshOpen(false);
    setKeypadValue(String(val).replace('.', ','));
  };

  const handleSaveQuantityPad = () => {
    if (!editingItem?.product) return;
    const editingProductCode = editingItem.product.code;
    triggerHaptic();
    const sanitized = keypadValue.replace(',', '.').trim();
    const parsed = parseFloat(sanitized);

    if (!isNaN(parsed) && parsed > 0) {
      setCart(prevCart =>
        prevCart.map(item =>
          item.product?.code === editingProductCode
            ? { ...item, quantity: Number(parsed.toFixed(3)) }
            : item
        )
      );
    }
    setEditingItem(null);
  };

  // Remove item completely
  const handleRemoveItem = (itemId: string) => {
    triggerHaptic();
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const handleAddDescriptionLine = () => {
    const description = descriptionDraft.trim();
    if (!description) return;
    triggerHaptic();
    setCart(prevCart => [
      ...prevCart,
      { id: `description-${crypto.randomUUID()}`, isDescription: true, description, quantity: 0 },
    ]);
    setDescriptionDraft('');
    setShowDescriptionEditor(false);
  };

  // Order submission
  const handleConfirmSubmit = async () => {
    if (cart.length === 0 || isSubmitting || !documentType) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const newOrder = await createNewOrder({
        customer_reference: customerReference.trim() || null,
        document_type: documentType,
        warehouse_location: warehouseLocation,
        items: cart,
      });

      setSubmittedOrderNumber(newOrder.order_number);
      setShowConfirmModal(false);
      setCart([]);
      setCustomerReference('');
      setDocumentType(null);
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
    setDocumentType(null);
    setSearchQuery('');
  };

  // ------------------------------------------------------------------------
  // SCREEN: ORDER SUBMITTED SUCCESSFULLY
  // ------------------------------------------------------------------------
  if (submittedOrderNumber) {
    return (
      <div className="min-h-[calc(100dvh-7rem)] flex flex-col items-center px-4 py-6 text-center select-none">
        <div className="w-full max-w-md my-auto bg-white p-6 sm:p-9 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 border border-emerald-200">
            <CheckCircle2 className="w-11 h-11 stroke-[2.5]" />
          </div>

          <span className="text-[11px] font-mono font-extrabold tracking-widest text-emerald-800 uppercase bg-emerald-100/80 px-3 py-1 rounded-md mb-2">
            TRASMISSIONE COMPLETATA
          </span>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mb-1">
            Ordine Inviato in Ufficio
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-xs">
            La postazione amministrativa di {companySettings.companyName || 'Saggin'} ha ricevuto la distinta di carico.
          </p>

          <div className="w-full bg-[#0b0f19] rounded-xl p-5 mb-6 text-center border border-slate-800">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              NUMERO PROGRESSIVO DOCUMENTO
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-white">
              {submittedOrderNumber}
            </div>
          </div>

          <button
            onClick={handleResetForNewOrder}
            className="w-full h-14 bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-extrabold rounded-xl text-base flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/20 transition touch-manipulation"
          >
            <RotateCcw className="w-5 h-5" />
            <span>INIZIA NUOVO CARICO</span>
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------------
  // MAIN WAREHOUSE TERMINAL (MOBILE, PORTRAIT TABLET & WINDOWS TOUCH TABLET)
  // ------------------------------------------------------------------------
  return (
    <div className="min-h-[calc(100dvh-6rem)] flex flex-col justify-between pb-28 sm:pb-32">
      <div className="max-w-4xl mx-auto w-full space-y-3.5 sm:space-y-4">
        {/* STEP 1: ORDER HEADER & DOCUMENT CONFIG */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Section Bar */}
          <div className="bg-slate-900 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-md bg-red-600 text-white font-mono text-xs font-black flex items-center justify-center shrink-0">
                1
              </span>
              <h1 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white truncate">
                Impostazione Carico
              </h1>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {cart.length > 0 && (
                <span className="hidden sm:inline-flex text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  BOZZA SALVATA
                </span>
              )}
              <span className="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                {warehouseLocation === 'DEPOSITO' ? 'DEPOSITO' : 'MAGAZZINO'}
              </span>
              <span
                className={`text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 space-y-4">
            {/* Row 1: Warehouse Location + Customer/Truck Reference (Side-by-side on Tablet/Desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
              {/* Punto di Carico (5 cols on tablet) */}
              <div className="md:col-span-5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Punto di Carico
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'MAGAZZINO', label: 'Magazzino', icon: Warehouse },
                      { value: 'DEPOSITO', label: 'Deposito', icon: Layers },
                    ] as const
                  ).map(option => {
                    const selected = warehouseLocation === option.value;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setWarehouseLocation(option.value);
                          try {
                            localStorage.setItem('saggin_warehouse_location', option.value);
                          } catch {
                            // Ignore
                          }
                          triggerHaptic();
                        }}
                        className={`min-h-[48px] rounded-xl border-2 px-3 py-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold active:scale-[0.98] transition touch-manipulation ${
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Riferimento Cliente / Cantiere / Targa (7 cols on tablet) */}
              <div className="md:col-span-7">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Cliente / Cantiere / Targa Mezzo <span className="font-normal text-slate-400">(facoltativo)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={customerReference}
                    onChange={(e) => setCustomerReference(e.target.value)}
                    placeholder="Es. Rossi Costruzioni / Cantiere Marostica / Targa..."
                    className="w-full h-12 pl-10 pr-9 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 transition placeholder:text-slate-400 placeholder:font-medium"
                  />
                  {customerReference && (
                    <button
                      type="button"
                      onClick={() => setCustomerReference('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      aria-label="Cancella riferimento"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Document Type Selector (4 large touch cards on tablet, 2x2 on phone) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Tipo Documento Richiesto <span className="text-red-600">*</span>
                </label>
                {!documentType ? (
                  <span className="text-[11px] font-bold text-red-600 animate-pulse">
                    Seleziona un documento per abilitare la ricerca
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold text-emerald-700">
                    Selezionato: {ORDER_DOCUMENT_LABELS[documentType]}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(
                  [
                    { value: 'SCONTRINO', icon: Receipt, hint: 'Vendita al banco' },
                    { value: 'DDT', icon: Truck, hint: 'Doc. di trasporto' },
                    { value: 'FATTURA', icon: FileText, hint: 'Emissione fattura' },
                    { value: 'NOTA_PRELIEVO', icon: Package, hint: 'Prelievo interno' },
                  ] as const
                ).map(option => {
                  const selected = documentType === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setDocumentType(option.value);
                        triggerHaptic();
                      }}
                      className={`min-h-[76px] rounded-xl border-2 p-3 flex flex-col items-start justify-between text-left transition active:scale-[0.98] touch-manipulation ${
                        selected
                          ? 'border-red-600 bg-red-50/50 shadow-xs ring-2 ring-red-600/15'
                          : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          selected ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selected ? 'border-red-600 bg-red-600' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className={`block text-xs sm:text-sm font-black leading-tight ${
                          selected ? 'text-red-950' : 'text-slate-900'
                        }`}>
                          {ORDER_DOCUMENT_LABELS[option.value]}
                        </span>
                        <span className="block text-[10px] font-medium text-slate-500 mt-0.5">
                          {option.hint}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* STEP 2: HIGH-SPEED PRODUCT SEARCH BAR */}
        <section className="relative z-30">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono text-xs font-black flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-900 truncate">
                  Ricerca Rapida Articoli ({products.length})
                </span>
              </div>
              {documentType && (
                <span className="hidden sm:inline text-[11px] font-medium text-slate-400">
                  Ricerca multi-parola attiva (es. "cemento 25")
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className={`w-5 h-5 ${documentType ? 'text-red-600' : 'text-slate-400'}`} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isProductsLoading || !documentType}
                placeholder={
                  isProductsLoading
                    ? 'Sincronizzazione catalogo articoli in corso...'
                    : !documentType
                    ? '↑ Seleziona prima il Tipo Documento qui sopra...'
                    : 'Digita codice, parole chiave (es. "cemento 25") o cod. alternativo...'
                }
                className={`w-full h-14 pl-12 pr-12 rounded-xl text-sm sm:text-base font-bold transition placeholder:text-slate-400 ${
                  !documentType
                    ? 'bg-slate-100 border-2 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 border-2 border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center min-w-[48px] min-h-[48px] text-slate-400 hover:text-slate-700 active:scale-95 touch-manipulation"
                  aria-label="Cancella ricerca"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* 1-Tap Recent / Frequent Products Strip (when documentType is selected and search is empty) */}
            {documentType && !searchQuery.trim() && recentProducts.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Aggiunta Rapida · Articoli Caricati di Recente
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {recentProducts.map(prod => {
                    const inCartQty = cartQuantitiesByCode[prod.code];
                    return (
                      <button
                        key={prod.code}
                        type="button"
                        onClick={() => handleAddProduct(prod)}
                        className={`shrink-0 h-9 px-2.5 rounded-lg border text-left flex items-center gap-1.5 text-xs transition active:scale-95 touch-manipulation ${
                          inCartQty
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 text-red-600 shrink-0 stroke-[2.5]" />
                        <span className="font-mono font-black text-[11px]">{prod.code}</span>
                        <span className="font-semibold text-[11px] max-w-[140px] truncate text-slate-600">
                          {prod.description}
                        </span>
                        {inCartQty !== undefined && (
                          <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black">
                            {inCartQty}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isProductsLoading && (
              <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-slate-700">
                Caricamento del catalogo articoli da Supabase in corso...
              </div>
            )}
          </div>

          {/* Search Instant Results Dropdown Panel */}
          {!isProductsLoading && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 z-40 bg-white rounded-2xl shadow-2xl border-2 border-slate-900/15 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    Nessun articolo trovato per "{searchQuery}"
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Verifica il codice o usa il pulsante "Riga descrittiva" per inserire una nota manuale.
                  </p>
                </div>
              ) : (
                searchResults.map(prod => {
                  const inCartQty = cartQuantitiesByCode[prod.code];
                  return (
                    <button
                      key={prod.code}
                      type="button"
                      onClick={() => handleAddProduct(prod)}
                      className="w-full p-3.5 sm:p-4 text-left hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between gap-3 min-h-[64px] touch-manipulation"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono font-black text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                            {prod.code}
                          </span>
                          <span className="text-[11px] font-mono font-extrabold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded uppercase">
                            {prod.unit_of_measure}
                          </span>
                          {prod.alternative_code && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Alt: {prod.alternative_code}
                            </span>
                          )}
                          {inCartQty !== undefined && (
                            <span className="text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              NEL CARICO: {inCartQty}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-900 whitespace-normal break-words leading-snug">
                          {prod.description}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 px-3.5 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-sm active:scale-95 transition">
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span className="hidden sm:inline">AGGIUNGI</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* STEP 3: CURRENT ORDER LINES */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden min-h-[260px]">
          <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono text-xs font-black flex items-center justify-center">
                3
              </span>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Distinta Materiali Caricati ({totalLines})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDescriptionEditor(value => !value)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100 active:scale-95 transition touch-manipulation shadow-2xs"
              >
                <AlignLeft className="w-3.5 h-3.5 text-red-600" />
                <span>+ Riga Descrittiva</span>
              </button>

              {totalLines > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 active:scale-95 transition touch-manipulation"
                >
                  Svuota
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {showDescriptionEditor && (
              <div className="mb-4 rounded-xl border-2 border-slate-900/15 bg-slate-50 p-4 space-y-3">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Nota / Riga Descrittiva Libera
                </label>
                <textarea
                  value={descriptionDraft}
                  onChange={e => setDescriptionDraft(e.target.value)}
                  rows={2}
                  maxLength={500}
                  autoFocus
                  placeholder="Es. Scarico con gru lato cantiere nord / Bancali a rendere..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-500">
                    {descriptionDraft.length}/500 caratteri
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDescriptionEditor(false);
                        setDescriptionDraft('');
                      }}
                      className="min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleAddDescriptionLine}
                      disabled={!descriptionDraft.trim()}
                      className="min-h-[40px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40"
                    >
                      Inserisci Nota
                    </button>
                  </div>
                </div>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                  <Package className="w-7 h-7 stroke-[1.75]" />
                </div>
                <p className="text-sm font-extrabold text-slate-700">Nessun materiale inserito</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Seleziona il tipo documento in alto e cerca gli articoli caricati per comporre l'ordine da inviare all'ufficio.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 border-2 rounded-xl transition ${
                      item.isDescription
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {item.isDescription ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wide text-amber-950 mb-1.5">
                            <AlignLeft className="w-3 h-3" /> NOTA DESCRITTIVA
                          </span>
                          <p className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">
                            {item.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition touch-manipulation"
                          title="Elimina nota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : item.product ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        {/* Left: Product Metadata & Unit Switcher */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[11px] font-mono font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <span className="font-mono font-black text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded">
                              {item.product.code}
                            </span>
                            {item.product.alternative_code && (
                              <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                {item.product.alternative_code}
                              </span>
                            )}
                          </div>

                          <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug break-words">
                            {item.product.description}
                          </div>

                          {/* Unit of Measure Selector Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            <span className="text-[10px] font-mono font-extrabold uppercase text-slate-400 mr-1">
                              U.M.:
                            </span>
                            {[
                              ...new Set([
                                item.product.unit_of_measure,
                                ...(unitOptions[item.product.id] || []),
                              ]),
                            ].map(unit => {
                              const isSelectedUnit =
                                (item.unitOfMeasure || item.product!.unit_of_measure) === unit;
                              return (
                                <button
                                  key={unit}
                                  type="button"
                                  onClick={() =>
                                    setCart(prev =>
                                      prev.map(row =>
                                        row.id === item.id ? { ...row, unitOfMeasure: unit } : row
                                      )
                                    )
                                  }
                                  className={`min-h-[34px] px-3 rounded-lg border text-xs font-mono font-black transition touch-manipulation ${
                                    isSelectedUnit
                                      ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                                  }`}
                                >
                                  {unit}
                                </button>
                              );
                            })}

                            <div className="inline-flex items-center gap-1 ml-1">
                              <input
                                value={newUnitDraft[item.product.id] || ''}
                                onChange={e =>
                                  setNewUnitDraft(prev => ({
                                    ...prev,
                                    [item.product!.id]: e.target.value,
                                  }))
                                }
                                placeholder="+ U.M."
                                aria-label="Nuova unità di misura"
                                className="w-20 min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-mono font-bold uppercase focus:bg-white focus:border-slate-900 outline-none"
                              />
                              {(newUnitDraft[item.product.id] || '').trim() && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const productId = item.product!.id;
                                    const unit = (newUnitDraft[productId] || '')
                                      .trim()
                                      .toUpperCase();
                                    if (!unit) return;
                                    try {
                                      await saveProductUnitOption(productId, unit);
                                      setUnitOptions(prev => ({
                                        ...prev,
                                        [productId]: [
                                          ...new Set([...(prev[productId] || []), unit]),
                                        ],
                                      }));
                                      setCart(prev =>
                                        prev.map(row =>
                                          row.id === item.id ? { ...row, unitOfMeasure: unit } : row
                                        )
                                      );
                                      setNewUnitDraft(prev => ({ ...prev, [productId]: '' }));
                                    } catch (error) {
                                      setSubmitError(
                                        error instanceof Error
                                          ? error.message
                                          : 'Unità non salvata'
                                      );
                                    }
                                  }}
                                  className="min-h-[34px] px-3 rounded-lg bg-red-600 text-white text-xs font-extrabold touch-manipulation"
                                >
                                  Salva
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Large Touch Stepper Controls (Optimized for Portrait Tablet & Smartphone) */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                          <div className="flex items-center gap-1.5">
                            {/* Stepper - */}
                            <button
                              type="button"
                              onClick={() => handleQuantityDelta(item.product!.code, -1)}
                              className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-300 text-slate-900 hover:bg-slate-200 active:scale-90 transition font-black touch-manipulation"
                              aria-label="Diminuisci quantità"
                            >
                              <Minus className="w-5 h-5 stroke-[3]" />
                            </button>

                            {/* Quantity Display Button (Opens Touch Numpad) */}
                            <button
                              type="button"
                              onClick={() => handleOpenQuantityPad(item)}
                              className="h-12 min-w-[5.5rem] px-3 bg-white border-2 border-slate-900 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 active:scale-95 transition touch-manipulation"
                              title="Tocca per aprire il tastierino numerico"
                            >
                              <span className="font-mono font-black text-lg text-slate-900 tabular-nums">
                                {item.quantity}
                              </span>
                              <span className="text-[11px] font-mono font-extrabold text-red-600 uppercase">
                                {item.unitOfMeasure || item.product.unit_of_measure}
                              </span>
                            </button>

                            {/* Stepper + */}
                            <button
                              type="button"
                              onClick={() => handleQuantityDelta(item.product!.code, 1)}
                              className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-90 transition font-black shadow-xs touch-manipulation"
                              aria-label="Aumenta quantità"
                            >
                              <Plus className="w-5 h-5 stroke-[3]" />
                            </button>
                          </div>

                          {/* Delete row */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-11 h-12 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition touch-manipulation"
                            title="Rimuovi articolo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* FIXED BOTTOM COMMAND BAR (THUMB ZONE FOR PHONE & TABLET PORTRAIT) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0b0f19]/95 backdrop-blur-md border-t border-slate-800 p-3 sm:px-6 sm:py-3.5 shadow-2xl pb-safe">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                RIEPILOGO CARICO
              </span>
              <div className="flex items-baseline gap-2 text-white">
                <span className="font-mono font-black text-base sm:text-lg tabular-nums">
                  {productLinesCount}
                </span>
                <span className="text-xs text-slate-300 font-semibold">articoli</span>
                <span className="text-slate-600">·</span>
                <span className="font-mono font-black text-base sm:text-lg text-red-400 tabular-nums">
                  {totalUnits}
                </span>
                <span className="text-xs text-slate-300 font-semibold">unità tot.</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={cart.length === 0 || isSubmitting || !documentType}
            className="flex-1 max-w-md h-13 sm:h-14 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.99] disabled:opacity-35 disabled:hover:bg-red-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/25 transition tracking-wide touch-manipulation"
          >
            <Send className="w-4 h-4" />
            <span className="whitespace-nowrap uppercase">TRASMETTI ORDINE ALL'UFFICIO</span>
          </button>
        </div>
      </div>

      {/* TOUCH QUANTITY KEYPAD MODAL (IDEAL FOR WINDOWS TABLET & MOBILE) */}
      {editingItem?.product && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 mb-3">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                    {editingItem.product.code}
                  </span>
                  <span className="text-xs font-mono font-bold text-red-600 uppercase">
                    U.M.: {editingItem.unitOfMeasure || editingItem.product.unit_of_measure}
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-1 mt-1">
                  {editingItem.product.description}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Numeric Display / Direct Input */}
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={keypadValue}
                  onChange={(e) => {
                    setKeypadFreshOpen(false);
                    setKeypadValue(e.target.value);
                  }}
                  className="w-full h-14 text-center font-mono font-black text-3xl bg-slate-900 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 transition tabular-nums"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-black text-xs text-slate-400 uppercase">
                  {editingItem.unitOfMeasure || editingItem.product.unit_of_measure}
                </span>
              </div>
            </div>

            {/* Quick Delta Presets */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
              {[1, 5, 10, 25].map(delta => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => handleApplyPreset(delta)}
                  className="h-10 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono font-extrabold text-xs text-slate-800 active:scale-95 transition touch-manipulation"
                >
                  +{delta}
                </button>
              ))}
            </div>

            {/* Tactile On-Screen Numpad for Tablet & Touch */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleNumpadDigit(digit)}
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 font-mono font-black text-lg text-slate-900 transition touch-manipulation"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNumpadDigit(',')}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-mono font-black text-lg text-slate-900 transition touch-manipulation"
              >
                ,
              </button>
              <button
                type="button"
                onClick={() => handleNumpadDigit('0')}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-mono font-black text-lg text-slate-900 transition touch-manipulation"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleNumpadBackspace}
                className="h-12 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition touch-manipulation"
                aria-label="Cancella cifra"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleSaveQuantityPad}
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition touch-manipulation"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>IMPOSTA QUANTITÀ</span>
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE SENDING */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 bg-[#0b0f19] text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-red-500" />
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Conferma Trasmissione Ordine
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                    Punto di Carico
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {warehouseLocation === 'DEPOSITO' ? 'Deposito' : 'Magazzino'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                    Documento
                  </span>
                  <span className="font-extrabold text-red-600">
                    {documentType ? ORDER_DOCUMENT_LABELS[documentType] : 'DDT'}
                  </span>
                </div>
                {customerReference && (
                  <div className="col-span-2 pt-2 border-t border-slate-200/80">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                      Cliente / Riferimento Cantiere
                    </span>
                    <span className="font-extrabold text-slate-900">{customerReference}</span>
                  </div>
                )}
              </div>

              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Articoli in distinta ({cart.length}):
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {cart.map(item => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-2 text-xs bg-white"
                  >
                    {item.isDescription ? (
                      <div className="min-w-0">
                        <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-mono font-black uppercase text-amber-900">
                          Nota
                        </span>
                        <span className="whitespace-pre-wrap break-words text-slate-800 font-medium">
                          {item.description}
                        </span>
                      </div>
                    ) : item.product ? (
                      <>
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="font-mono font-bold text-[11px] bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded mr-2">
                            {item.product.code}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {item.product.description}
                          </span>
                        </div>
                        <div className="font-mono font-black text-slate-900 whitespace-nowrap text-sm tabular-nums">
                          {item.quantity} {item.unitOfMeasure || item.product.unit_of_measure}
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 active:scale-95 transition touch-manipulation"
              >
                Torna al Carico
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-95 transition uppercase touch-manipulation"
              >
                {isSubmitting ? (
                  <span>Trasmissione...</span>
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

