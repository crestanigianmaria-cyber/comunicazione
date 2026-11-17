import React, { useState, useMemo, useRef, useDeferredValue, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
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
  Warehouse,
  Camera,
  Edit3,
  ShoppingCart,
  QrCode,
  Sparkles,
  WifiOff,
  ListTodo,
  ChevronRight,
} from 'lucide-react';
import {
  Product,
  CompanySettings,
  OrderDocumentType,
  ORDER_DOCUMENT_LABELS,
  WarehouseLocation,
  Order,
  CustomerCommitment,
} from '../../types';
import { searchProducts, normalizeSearchString } from '../../lib/search';
import {
  createNewOrder,
  updateExistingOrder,
  fetchProductUnitOptions,
  saveProductUnitOption,
  markCommitmentAsLoaded,
} from '../../services/db';
import { decodeCommitmentQrPayload } from '../../lib/commitmentQr';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { TouchNumpadModal } from './TouchNumpadModal';
import { WarehouseCartPanel, CartItem } from './WarehouseCartPanel';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';
import { EmptyState, SkeletonList } from './ui/EmptyState';
import { useToast } from './ui/ToastProvider';

interface WarehouseViewProps {
  products: Product[];
  companySettings: CompanySettings;
  isOnline: boolean;
  isProductsLoading?: boolean;
  warehouseLocation: WarehouseLocation;
  onWarehouseLocationChange: (loc: WarehouseLocation) => void;
  editingOrder?: Order | null;
  onCancelEditOrder?: () => void;
  onOrderSaved?: (order: Order) => void;
  commitments?: CustomerCommitment[];
  pendingCommitmentToLoad?: CustomerCommitment | null;
  onCommitmentLoaded?: () => void;
  onOrdersQueueChanged?: () => void;
  onCartStatsChange?: (stats: { lines: number; units: number }) => void;
  todayRemindersSummary?: {
    totalOpen: number;
    urgentOpen: number;
    overdueCount: number;
  };
  onOpenReminders?: () => void;
  pendingReminderCustomerRef?: string | null;
  onReminderCustomerRefConsumed?: () => void;
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

function mapOrderToCart(order: Order, products: Product[]): CartItem[] {
  if (!order.items || order.items.length === 0) return [];
  return order.items.map(it => {
    if (it.line_type === 'DESCRIPTION') {
      return {
        id: it.id || `desc-${Math.random()}`,
        isDescription: true,
        description: it.manual_description || it.product_description_snapshot,
        quantity: 0,
      };
    }
    const matched = products.find(p => p.code === it.product_code_snapshot);
    return {
      id: it.id || it.product_code_snapshot,
      product: matched || {
        id: it.product_id || it.product_code_snapshot,
        code: it.product_code_snapshot,
        description: it.product_description_snapshot,
        unit_of_measure: it.unit_of_measure_snapshot,
        alternative_code: it.alternative_code_snapshot,
        created_at: '',
        updated_at: '',
      },
      quantity: it.quantity,
      unitOfMeasure: it.unit_of_measure_snapshot,
    };
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const cleanTokens = useMemo(() => {
    const tokens = normalizeSearchString(query)
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length >= 2);
    return [...new Set(tokens)];
  }, [query]);

  if (!cleanTokens.length || !text) return <>{text}</>;

  const pattern = new RegExp(`(${cleanTokens.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = cleanTokens.some(t => normalizeSearchString(part) === t);
        return isMatch ? (
          <mark
            key={idx}
            className="bg-amber-200/90 text-slate-950 rounded px-0.5 font-extrabold"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        );
      })}
    </>
  );
};

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  products,
  companySettings,
  isOnline,
  isProductsLoading = false,
  warehouseLocation,
  onWarehouseLocationChange,
  editingOrder = null,
  onCancelEditOrder,
  onOrderSaved,
  commitments = [],
  pendingCommitmentToLoad = null,
  onCommitmentLoaded,
  onOrdersQueueChanged,
  onCartStatsChange,
  todayRemindersSummary,
  onOpenReminders,
  pendingReminderCustomerRef,
  onReminderCustomerRefConsumed,
}) => {
  const { showToast } = useToast();
  const initialDraft = useMemo(() => loadSavedDraft(), []);

  const [customerReference, setCustomerReference] = useState(() =>
    editingOrder ? editingOrder.customer_reference || '' : initialDraft.customerReference || ''
  );
  const [unitOptions, setUnitOptions] = useState<Record<string, string[]>>({});
  const [newUnitDraft, setNewUnitDraft] = useState<Record<string, string>>({});
  const [documentType, setDocumentType] = useState<OrderDocumentType | null>(() =>
    editingOrder ? editingOrder.document_type || 'DDT' : initialDraft.documentType || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [cart, setCart] = useState<CartItem[]>(() =>
    editingOrder ? mapOrderToCart(editingOrder, products) : Array.isArray(initialDraft.cart) ? initialDraft.cart : []
  );

  const [recentCodes, setRecentCodes] = useState<string[]>(() => loadRecentCodes());
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [submittedOrderInfo, setSubmittedOrderInfo] = useState<{
    orderNumber: string;
    wasOffline: boolean;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [loadedCommitmentBanner, setLoadedCommitmentBanner] = useState<{
    number: string;
    customer: string;
    installer?: string | null;
    notes?: string | null;
    category: 'STANDARD' | 'VELUX';
    count: number;
  } | null>(null);

  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevEditingOrderIdRef = useRef<string | null>(editingOrder?.id || null);

  // Sync editingOrder transitions safely even when kept mounted across navigation tabs
  useEffect(() => {
    const nextId = editingOrder?.id || null;
    if (nextId && nextId !== prevEditingOrderIdRef.current && editingOrder) {
      prevEditingOrderIdRef.current = nextId;
      setSubmittedOrderInfo(null);
      setCustomerReference(editingOrder.customer_reference || '');
      setDocumentType(editingOrder.document_type || 'DDT');
      if (editingOrder.warehouse_location) {
        onWarehouseLocationChange(editingOrder.warehouse_location);
      }
      setCart(mapOrderToCart(editingOrder, products));
      setLoadedCommitmentBanner(null);
      setSearchQuery('');
    } else if (!nextId && prevEditingOrderIdRef.current) {
      prevEditingOrderIdRef.current = null;
      const restored = loadSavedDraft();
      setCustomerReference(restored.customerReference || '');
      setDocumentType(restored.documentType || null);
      setCart(Array.isArray(restored.cart) ? restored.cart : []);
      setLoadedCommitmentBanner(null);
    }
  }, [editingOrder, products, onWarehouseLocationChange]);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch {
        // Ignore
      }
    }
  }, []);

  // Inject items & metadata from a Customer Commitment (via QR scan or list click)
  const applyCommitmentToOrder = useCallback(
    (commitmentData: {
      id?: string;
      commitment_number: string;
      customer_name: string;
      category: 'STANDARD' | 'VELUX';
      installer_name?: string | null;
      notes?: string | null;
      items: {
        product_id?: string | null;
        product_code: string;
        product_description: string;
        unit_of_measure: string;
        quantity: number;
      }[];
    }) => {
      triggerHaptic();
      setSubmittedOrderInfo(null);
      setDocumentType(prev => prev || 'DDT');

      const formattedRef = `${commitmentData.customer_name} - Impegno N° ${commitmentData.commitment_number}${
        commitmentData.installer_name ? ` (Inst. ${commitmentData.installer_name})` : ''
      }`;
      setCustomerReference(prev => {
        if (!prev.trim()) return formattedRef;
        if (prev.includes(commitmentData.commitment_number)) return prev;
        return `${prev} · Impegno N° ${commitmentData.commitment_number}`;
      });

      setCart(prevCart => {
        const nextCart = [...prevCart];
        for (const cItem of commitmentData.items) {
          const matchedCatalog = products.find(
            p => p.code.toLowerCase() === cItem.product_code.toLowerCase()
          );
          const resolvedProduct: Product = matchedCatalog || {
            id: cItem.product_id || `imp-${cItem.product_code}-${crypto.randomUUID()}`,
            code: cItem.product_code,
            description: cItem.product_description,
            unit_of_measure: cItem.unit_of_measure || 'PZ',
            alternative_code: null,
            created_at: '',
            updated_at: '',
          };

          const existingIdx = nextCart.findIndex(
            row => row.product?.code.toLowerCase() === resolvedProduct.code.toLowerCase()
          );
          if (existingIdx > -1) {
            nextCart[existingIdx] = {
              ...nextCart[existingIdx],
              quantity: Number(
                (nextCart[existingIdx].quantity + (Number(cItem.quantity) || 1)).toFixed(3)
              ),
            };
          } else {
            nextCart.push({
              id: resolvedProduct.code,
              product: resolvedProduct,
              quantity: Number(cItem.quantity) || 1,
              unitOfMeasure: cItem.unit_of_measure || resolvedProduct.unit_of_measure || 'PZ',
            });
          }
        }
        return nextCart;
      });

      setLoadedCommitmentBanner({
        number: commitmentData.commitment_number,
        customer: commitmentData.customer_name,
        installer: commitmentData.installer_name,
        notes: commitmentData.notes || null,
        category: commitmentData.category,
        count: commitmentData.items.length,
      });

      if (commitmentData.id) {
        void markCommitmentAsLoaded(commitmentData.id);
      }

      showToast({
        message: `Impegno N° ${commitmentData.commitment_number} collegato`,
        detail: commitmentData.customer_name,
        tone: 'success',
      });
    },
    [products, showToast, triggerHaptic]
  );

  // Triggered when warehouse operator selects "Carica nell'Ordine" from Impegni Clienti view
  useEffect(() => {
    if (pendingCommitmentToLoad) {
      applyCommitmentToOrder(pendingCommitmentToLoad);
      if (onCommitmentLoaded) {
        onCommitmentLoaded();
      }
    }
  }, [pendingCommitmentToLoad, applyCommitmentToOrder, onCommitmentLoaded]);

  // Triggered when warehouse operator taps "Apri Carico" on an Order-Prep reminder
  useEffect(() => {
    if (pendingReminderCustomerRef) {
      setSubmittedOrderInfo(null);
      setDocumentType(prev => prev || 'DDT');
      setCustomerReference(prev =>
        prev.trim() ? `${prev} · ${pendingReminderCustomerRef}` : pendingReminderCustomerRef
      );
      showToast({
        message: 'Riferimento promemoria impostato',
        detail: pendingReminderCustomerRef,
        tone: 'info',
      });
      onReminderCustomerRefConsumed?.();
    }
  }, [pendingReminderCustomerRef, onReminderCustomerRefConsumed, showToast]);

  // Auto-persist active draft cleanly when not editing an existing order
  useEffect(() => {
    if (editingOrder) return;
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
  }, [cart, customerReference, documentType, editingOrder]);

  // Preload custom unit options for restored/editing cart items
  useEffect(() => {
    for (const item of cart) {
      if (item.product?.id && !unitOptions[item.product.id]) {
        const pid = item.product.id;
        void fetchProductUnitOptions(pid).then(options =>
          setUnitOptions(prev => ({ ...prev, [pid]: options }))
        );
      }
    }
  }, [cart.length]);

  // Recent 8 products for 1-tap selection
  const recentProducts = useMemo(() => {
    if (recentCodes.length === 0 || products.length === 0) return [];
    const byCode = new Map(products.map(p => [p.code, p]));
    return recentCodes
      .map(code => byCode.get(code))
      .filter((p): p is Product => Boolean(p))
      .slice(0, 8);
  }, [recentCodes, products]);

  const cartQuantitiesByCode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      if (item.product?.code) {
        map[item.product.code] = item.quantity;
      }
    }
    return map;
  }, [cart]);

  const searchResults = useMemo(() => {
    if (!deferredSearchQuery.trim()) return [];
    return searchProducts(products, deferredSearchQuery, 30);
  }, [products, deferredSearchQuery]);

  const totalLines = cart.length;
  const productLinesCount = useMemo(
    () => cart.filter(item => !item.isDescription && item.product).length,
    [cart]
  );
  const totalUnits = useMemo(
    () => Number(cart.reduce((acc, item) => acc + (item.isDescription ? 0 : item.quantity), 0).toFixed(3)),
    [cart]
  );

  useEffect(() => {
    onCartStatsChange?.({ lines: totalLines, units: totalUnits });
  }, [totalLines, totalUnits, onCartStatsChange]);

  const handleAddProduct = (product: Product) => {
    if (!documentType) {
      setDocumentType('DDT');
    }
    triggerHaptic();

    setRecentCodes(prev => {
      const next = [product.code, ...prev.filter(c => c !== product.code)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_CODES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    const prevQty = cartQuantitiesByCode[product.code] || 0;
    const nextQty = Number((prevQty + 1).toFixed(3));

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

    showToast({
      message: `${product.code} aggiunto`,
      detail: `${product.description} · Q.tà nel carico: ${nextQty}`,
      tone: 'success',
    });

    setSearchQuery('');
  };

  const handleQuantityDelta = (productCode: string, delta: number) => {
    triggerHaptic();
    setCart(prevCart =>
      prevCart
        .map(item => {
          if (item.product?.code === productCode) {
            const newQty = Number((item.quantity + delta).toFixed(3));
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const handleOpenQuantityPad = (item: CartItem) => {
    triggerHaptic();
    setEditingItem(item);
  };

  const handleSaveQuantityPad = (quantity: number) => {
    if (!editingItem?.product) return;
    const code = editingItem.product.code;
    setCart(prevCart =>
      prevCart.map(item => (item.product?.code === code ? { ...item, quantity } : item))
    );
    showToast({
      message: `Quantità aggiornata: ${quantity} ${editingItem.unitOfMeasure || editingItem.product.unit_of_measure}`,
      detail: editingItem.product.description,
      tone: 'info',
    });
    setEditingItem(null);
  };

  const handleRemoveItem = (itemId: string) => {
    triggerHaptic();
    const target = cart.find(i => i.id === itemId);
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    showToast({
      message: target?.isDescription ? 'Nota rimossa' : 'Articolo rimosso dal carico',
      detail: target?.product?.code || undefined,
      tone: 'info',
    });
  };

  const handleConfirmClearCart = () => {
    triggerHaptic();
    setCart([]);
    setShowClearCartConfirm(false);
    setIsCartDrawerOpen(false);
    showToast({
      message: 'Distinta carrello svuotata',
      tone: 'warning',
    });
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
    showToast({
      message: 'Nota descrittiva aggiunta',
      tone: 'success',
    });
  };

  const handleSaveCustomUnit = async (itemId: string, productId: string) => {
    const unit = (newUnitDraft[productId] || '').trim().toUpperCase();
    if (!unit) return;
    try {
      await saveProductUnitOption(productId, unit);
      setUnitOptions(prev => ({
        ...prev,
        [productId]: [...new Set([...(prev[productId] || []), unit])],
      }));
      setCart(prev =>
        prev.map(row => (row.id === itemId ? { ...row, unitOfMeasure: unit } : row))
      );
      setNewUnitDraft(prev => ({ ...prev, [productId]: '' }));
      showToast({
        message: `Unità di misura "${unit}" salvata`,
        tone: 'success',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unità non salvata';
      setSubmitError(msg);
      showToast({ message: msg, tone: 'error' });
    }
  };

  // Barcode / QR resolution (IMP|, SAGGIN_IMP|, direct commitment match, code, EAN, partial)
  const handleBarcodeScanned = (decodedText: string) => {
    triggerHaptic();
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    const decodedCommitment = decodeCommitmentQrPayload(cleanText);
    if (decodedCommitment) {
      const matchedStoredCommitment = commitments.find(
        c =>
          (decodedCommitment.id && c.id === decodedCommitment.id) ||
          c.commitment_number.trim().toLowerCase() ===
            decodedCommitment.commitment_number.trim().toLowerCase()
      );
      if (matchedStoredCommitment) {
        applyCommitmentToOrder(matchedStoredCommitment);
      } else {
        applyCommitmentToOrder(decodedCommitment);
      }
      setSearchQuery('');
      return;
    }

    const directCommitmentMatch = commitments.find(
      c => c.commitment_number.trim().toLowerCase() === cleanText.toLowerCase()
    );
    if (directCommitmentMatch) {
      applyCommitmentToOrder(directCommitmentMatch);
      setSearchQuery('');
      return;
    }

    let matched = products.find(p => p.code.trim().toLowerCase() === cleanText.toLowerCase());
    if (!matched) {
      matched = products.find(
        p => p.alternative_code && p.alternative_code.trim().toLowerCase() === cleanText.toLowerCase()
      );
    }
    if (!matched && cleanText.length >= 2) {
      const candidates = products.filter(p =>
        p.code.toLowerCase().includes(cleanText.toLowerCase())
      );
      if (candidates.length === 1) {
        matched = candidates[0];
      }
    }

    if (matched) {
      if (!documentType) setDocumentType('DDT');
      handleAddProduct(matched);
      setSearchQuery('');
    } else {
      if (!documentType) setDocumentType('DDT');
      setSearchQuery(cleanText);
      showToast({
        message: `Nessun codice esatto per "${cleanText}"`,
        detail: 'Ricerca testuale aperta nei risultati',
        tone: 'warning',
      });
    }
  };

  // Submit / update order
  const handleConfirmSubmit = async () => {
    if (cart.length === 0 || isSubmitting || !documentType) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (editingOrder) {
        const updated = await updateExistingOrder(editingOrder.id, {
          customer_reference: customerReference.trim() || null,
          document_type: documentType,
          warehouse_location: warehouseLocation,
          items: cart,
        });
        prevEditingOrderIdRef.current = null;
        setSubmittedOrderInfo({ orderNumber: updated.order_number, wasOffline: !isOnline });
        setShowConfirmModal(false);
        setIsCartDrawerOpen(false);
        setCart([]);
        setCustomerReference('');
        setDocumentType(null);
        setLoadedCommitmentBanner(null);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        onOrdersQueueChanged?.();
        showToast({
          message: `Ordine ${updated.order_number} aggiornato`,
          tone: 'success',
        });
        onOrderSaved?.(updated);
      } else {
        const newOrder = await createNewOrder({
          customer_reference: customerReference.trim() || null,
          document_type: documentType,
          warehouse_location: warehouseLocation,
          items: cart,
        });

        setSubmittedOrderInfo({ orderNumber: newOrder.order_number, wasOffline: !isOnline });
        setShowConfirmModal(false);
        setIsCartDrawerOpen(false);
        setCart([]);
        setCustomerReference('');
        setDocumentType(null);
        setLoadedCommitmentBanner(null);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        onOrdersQueueChanged?.();
        showToast({
          message: isOnline
            ? `Ordine ${newOrder.order_number} inviato`
            : `Ordine ${newOrder.order_number} salvato in coda offline`,
          tone: isOnline ? 'success' : 'warning',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante il salvataggio dell'ordine";
      setSubmitError(msg);
      showToast({ message: msg, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewOrder = () => {
    setSubmittedOrderInfo(null);
    setCart([]);
    setCustomerReference('');
    setDocumentType(null);
    setSearchQuery('');
    setLoadedCommitmentBanner(null);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
  };

  // ------------------------------------------------------------------------
  // SCREEN: ORDER SUBMITTED SUCCESSFULLY
  // ------------------------------------------------------------------------
  if (submittedOrderInfo) {
    return (
      <div className="min-h-[calc(100dvh-10rem)] flex flex-col items-center justify-center px-3 py-6 text-center select-none animate-wms-slide-up">
        <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border ${
              submittedOrderInfo.wasOffline
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}
          >
            {submittedOrderInfo.wasOffline ? (
              <WifiOff className="w-10 h-10 stroke-[2.25]" />
            ) : (
              <CheckCircle2 className="w-11 h-11 stroke-[2.5]" />
            )}
          </div>

          <span
            className={`text-[11px] font-mono font-extrabold tracking-widest uppercase px-3 py-1 rounded-md mb-2 ${
              submittedOrderInfo.wasOffline
                ? 'bg-amber-100 text-amber-900'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {submittedOrderInfo.wasOffline
              ? 'SALVATO IN CODA OFFLINE'
              : 'TRASMISSIONE COMPLETATA'}
          </span>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mb-1">
            {submittedOrderInfo.wasOffline
              ? 'Ordine Pronto sul Dispositivo'
              : 'Ordine Inviato in Ufficio'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-xs leading-relaxed">
            {submittedOrderInfo.wasOffline
              ? 'La connessione era assente. Verrà sincronizzato automaticamente appena torna la rete.'
              : `La postazione amministrativa di ${
                  companySettings.companyName || 'Saggin'
                } ha ricevuto la distinta di carico.`}
          </p>

          <div className="w-full bg-[#0b0f19] rounded-xl p-5 mb-6 text-center border border-slate-800">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
              NUMERO PROGRESSIVO DOCUMENTO
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-white tabular-nums">
              {submittedOrderInfo.orderNumber}
            </div>
          </div>

          <button
            type="button"
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

  const cartPanelProps = {
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
    onToggleDescriptionEditor: () => setShowDescriptionEditor(v => !v),
    onDescriptionDraftChange: setDescriptionDraft,
    onCancelDescription: () => {
      setShowDescriptionEditor(false);
      setDescriptionDraft('');
    },
    onAddDescriptionLine: handleAddDescriptionLine,
    onRequestClearCart: () => setShowClearCartConfirm(true),
    onQuantityDelta: handleQuantityDelta,
    onOpenQuantityPad: handleOpenQuantityPad,
    onRemoveItem: handleRemoveItem,
    onSelectUnit: (itemId: string, unit: string) =>
      setCart(prev =>
        prev.map(row => (row.id === itemId ? { ...row, unitOfMeasure: unit } : row))
      ),
    onNewUnitDraftChange: (productId: string, value: string) =>
      setNewUnitDraft(prev => ({ ...prev, [productId]: value })),
    onSaveCustomUnit: handleSaveCustomUnit,
    onOpenConfirmSubmit: () => setShowConfirmModal(true),
  };

  return (
    <div className="pb-40 md:pb-24 xl:pb-4">
      <div className="xl:flex xl:items-start xl:gap-5">
        {/* LEFT / MAIN OPERATIONAL COMPOSER WORKSPACE */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* COMPACT DAILY REMINDERS SHORTCUT STRIP */}
          {todayRemindersSummary && todayRemindersSummary.totalOpen > 0 && !editingOrder && onOpenReminders && (
            <button
              type="button"
              onClick={onOpenReminders}
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2.5 text-left transition active:scale-[0.99] touch-manipulation shadow-2xs ${
                todayRemindersSummary.urgentOpen > 0
                  ? 'bg-red-50 border-red-200 hover:bg-red-100/70 text-red-950'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100/70 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    todayRemindersSummary.urgentOpen > 0
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  <ListTodo className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex items-center gap-1.5 flex-wrap text-xs font-extrabold">
                  <span>
                    {todayRemindersSummary.totalOpen} promemoria da completare oggi
                  </span>
                  {todayRemindersSummary.urgentOpen > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-black uppercase">
                      {todayRemindersSummary.urgentOpen}{' '}
                      {todayRemindersSummary.urgentOpen === 1 ? 'urgente' : 'urgenti'}
                    </span>
                  )}
                  {todayRemindersSummary.overdueCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-300 text-amber-950 text-[10px] font-mono font-black uppercase">
                      {todayRemindersSummary.overdueCount} arretrati
                    </span>
                  )}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black uppercase shrink-0 opacity-80">
                <span className="hidden sm:inline">Apri To-Do</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          )}

          {/* COMMITMENT LOADED BANNER */}
          {loadedCommitmentBanner && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-3.5 sm:p-4 flex items-start justify-between gap-3 shadow-sm animate-wms-slide-up">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 font-black text-[10px] ${
                    loadedCommitmentBanner.category === 'VELUX'
                      ? 'bg-[#e30613]'
                      : 'bg-emerald-600'
                  }`}
                >
                  {loadedCommitmentBanner.category === 'VELUX' ? (
                    'VELUX'
                  ) : (
                    <QrCode className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded">
                      IMPEGNO N° {loadedCommitmentBanner.number}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {loadedCommitmentBanner.customer}
                    </span>
                    {loadedCommitmentBanner.installer && (
                      <span className="text-[11px] font-bold text-[#e30613] bg-red-100 px-2 py-0.5 rounded">
                        Inst: {loadedCommitmentBanner.installer}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {loadedCommitmentBanner.count > 0
                      ? `Inseriti ${loadedCommitmentBanner.count} articoli e impostato il riferimento cliente.`
                      : 'Riferimento cliente e N° Impegno applicati. Aggiungi o scansiona gli articoli caricati.'}
                  </p>
                  {loadedCommitmentBanner.notes && (
                    <p className="text-xs font-bold text-amber-900 bg-amber-100/90 border border-amber-200 rounded-lg px-2.5 py-1 mt-1.5">
                      Note: {loadedCommitmentBanner.notes}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLoadedCommitmentBanner(null)}
                aria-label="Chiudi banner impegno"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-emerald-100/80 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* EDITING ORDER BANNER */}
          {editingOrder && (
            <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-wms-slide-up">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded">
                      MODIFICA ORDINE
                    </span>
                    <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                      {editingOrder.order_number}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">
                    Aggiungi o modifica righe e premi &ldquo;Aggiorna Ordine&rdquo;.
                  </p>
                </div>
              </div>
              {onCancelEditOrder && (
                <button
                  type="button"
                  onClick={onCancelEditOrder}
                  className="min-h-[44px] w-full sm:w-auto px-4 rounded-xl bg-white border border-slate-300 text-xs font-extrabold text-slate-800 hover:bg-slate-100 active:scale-[0.98] transition touch-manipulation shrink-0"
                >
                  Annulla Modifica
                </button>
              )}
            </div>
          )}

          {/* COMPACT ORDER CONFIGURATION CARD */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3.5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* Customer / Jobsite Reference */}
              <div className="lg:col-span-6">
                <label
                  htmlFor="wms-customer-ref"
                  className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  <span>Cliente / Cantiere / Targa</span>
                  <span className="font-medium lowercase text-slate-400">facoltativo</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <input
                    id="wms-customer-ref"
                    type="text"
                    value={customerReference}
                    onChange={e => setCustomerReference(e.target.value)}
                    placeholder="Es. Rossi Costruzioni / Cantiere Marostica..."
                    className="w-full h-12 pl-10 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition placeholder:text-slate-400 placeholder:font-medium"
                  />
                  {customerReference && (
                    <button
                      type="button"
                      onClick={() => setCustomerReference('')}
                      aria-label="Cancella riferimento cliente"
                      className="absolute inset-y-0 right-0 pr-2 flex items-center justify-center min-w-[44px] text-slate-400 hover:text-slate-700 touch-manipulation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Synced Loading Location */}
              <div className="lg:col-span-6">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Punto di Carico</span>
                  {cart.length > 0 && !editingOrder && (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                      BOZZA AUTO-SALVATA
                    </span>
                  )}
                </div>
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
                          onWarehouseLocationChange(option.value);
                          triggerHaptic();
                        }}
                        className={`h-12 rounded-xl border-2 px-3 flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold active:scale-[0.98] transition touch-manipulation ${
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
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
            </div>

            {/* Compact Segmented Document Type Selector */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Tipo Documento <span className="text-red-600">*</span>
                </span>
                {!documentType ? (
                  <span className="text-[11px] font-bold text-red-600">
                    Seleziona un documento
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-extrabold text-emerald-700">
                    Attivo: {ORDER_DOCUMENT_LABELS[documentType]}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { value: 'SCONTRINO', icon: Receipt, hint: 'Banco' },
                    { value: 'DDT', icon: Truck, hint: 'Trasporto' },
                    { value: 'FATTURA', icon: FileText, hint: 'Fattura' },
                    { value: 'NOTA_PRELIEVO', icon: Package, hint: 'Interno' },
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
                      className={`min-h-[54px] rounded-xl border-2 px-2.5 py-2 flex items-center gap-2 text-left transition active:scale-[0.98] touch-manipulation ${
                        selected
                          ? 'border-red-600 bg-red-50/70 text-red-950 shadow-2xs ring-2 ring-red-600/10'
                          : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white text-slate-800'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                          selected
                            ? 'bg-red-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[11px] sm:text-xs font-black leading-tight whitespace-normal">
                          {ORDER_DOCUMENT_LABELS[option.value]}
                        </span>
                        <span className="block text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                          {option.hint}
                        </span>
                      </div>
                      {selected && (
                        <Check className="w-3.5 h-3.5 text-red-600 stroke-[3] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SEARCH, SCANNER QR & RECENT 8 PRODUCTS */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Catalogo Articoli
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-600 tabular-nums">
                  {products.length}
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] font-medium text-slate-400">
                Multi-parola attiva (es. &ldquo;cemento 25&rdquo;) · Enter per codice rapido
              </span>
            </div>

            {/* Search Input + Scanner QR Trigger */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center min-w-0">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-red-600" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    const val = e.target.value;
                    if (!documentType && val.trim()) {
                      setDocumentType('DDT');
                    }
                    if (val.trim().startsWith('IMP|') || val.trim().startsWith('SAGGIN_IMP|')) {
                      handleBarcodeScanned(val.trim());
                      return;
                    }
                    setSearchQuery(val);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      e.preventDefault();
                      handleBarcodeScanned(searchQuery.trim());
                    }
                  }}
                  disabled={isProductsLoading}
                  placeholder={
                    isProductsLoading
                      ? 'Caricamento catalogo in corso...'
                      : 'Cerca per codice, descrizione o barcode...'
                  }
                  className="w-full h-14 pl-11 pr-12 rounded-xl text-sm sm:text-base font-bold bg-slate-50 border-2 border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Cancella ricerca"
                    className="absolute inset-y-0 right-0 pr-2 flex items-center justify-center min-w-[46px] text-slate-400 hover:text-slate-700 touch-manipulation"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowScannerModal(true);
                }}
                aria-label="Scansiona codice a barre o QR code"
                className="h-14 px-3.5 sm:px-4 rounded-xl bg-[#0b0f19] hover:bg-slate-800 text-white flex items-center justify-center gap-2 font-extrabold text-xs sm:text-sm active:scale-95 transition touch-manipulation shrink-0 shadow-sm"
              >
                <Camera className="w-5 h-5 text-red-500 stroke-[2.25]" />
                <span className="hidden sm:inline whitespace-nowrap">Scanner QR</span>
              </button>
            </div>

            {/* Loading Skeleton */}
            {isProductsLoading && <SkeletonList rows={3} />}

            {/* SEARCH RESULTS PANEL (Inline within workspace — no z-index clashes with Cart!) */}
            {!isProductsLoading && searchQuery.trim() && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden animate-wms-fade">
                <div className="px-3.5 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>
                    {searchResults.length > 0
                      ? `${searchResults.length} risultati trovati`
                      : 'Nessun risultato'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-extrabold transition touch-manipulation"
                  >
                    Chiudi risultati
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    compact
                    title={`Nessun articolo trovato per "${searchQuery}"`}
                    description="Controlla il codice oppure aggiungi una riga descrittiva libera al carico."
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setDescriptionDraft(searchQuery.trim());
                          setShowDescriptionEditor(true);
                          if (typeof window !== 'undefined' && window.innerWidth < 1280) {
                            setIsCartDrawerOpen(true);
                          }
                          setSearchQuery('');
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-extrabold inline-flex items-center gap-2 hover:bg-slate-800 transition touch-manipulation"
                      >
                        <AlignLeft className="w-4 h-4 text-red-400" />
                        <span>Usa &ldquo;{searchQuery.trim()}&rdquo; come Nota</span>
                      </button>
                    }
                  />
                ) : (
                  <div className="divide-y divide-slate-200/80 max-h-[54vh] overflow-y-auto overscroll-contain bg-white">
                    {searchResults.map(prod => {
                      const inCartQty = cartQuantitiesByCode[prod.code];
                      return (
                        <button
                          key={prod.code}
                          type="button"
                          onClick={() => handleAddProduct(prod)}
                          className="w-full p-3 sm:p-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between gap-3 min-h-[64px] touch-manipulation"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="font-mono font-black text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                                <HighlightMatch text={prod.code} query={deferredSearchQuery} />
                              </span>
                              <span className="text-[11px] font-mono font-extrabold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded uppercase">
                                {prod.unit_of_measure}
                              </span>
                              {prod.alternative_code && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Alt:{' '}
                                  <HighlightMatch
                                    text={prod.alternative_code}
                                    query={deferredSearchQuery}
                                  />
                                </span>
                              )}
                              {inCartQty !== undefined && (
                                <span className="text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  NEL CARICO: {inCartQty}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold text-slate-900 whitespace-normal break-words leading-snug">
                              <HighlightMatch text={prod.description} query={deferredSearchQuery} />
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5 px-3.5 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-xs">
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span className="hidden sm:inline">AGGIUNGI</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LAST 8 RECENT PRODUCTS QUICK STRIP / GRID */}
            {!searchQuery.trim() && recentProducts.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ultimi {recentProducts.length} Articoli Utilizzati · Tocco Rapido</span>
                  </span>
                </div>

                {/* Horizontal strip on mobile, multi-column responsive grid on tablet/desktop */}
                <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-2 overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar pb-1 md:pb-0">
                  {recentProducts.map(prod => {
                    const inCartQty = cartQuantitiesByCode[prod.code];
                    return (
                      <button
                        key={prod.code}
                        type="button"
                        onClick={() => handleAddProduct(prod)}
                        className={`w-[236px] sm:w-[250px] md:w-auto shrink-0 snap-start min-h-[54px] p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition active:scale-[0.98] touch-manipulation ${
                          inCartQty !== undefined
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                            : 'bg-slate-50/90 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-900'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-[11px] text-slate-900">
                              {prod.code}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                              {prod.unit_of_measure}
                            </span>
                            {inCartQty !== undefined && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black tabular-nums">
                                {inCartQty}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                            {prod.description}
                          </div>
                        </div>
                        <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-red-600 shrink-0 shadow-2xs">
                          <Plus className="w-4 h-4 stroke-[2.75]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* MOBILE & TABLET INLINE CART SECTION (< 1200px) */}
          <div className="xl:hidden">
            <WarehouseCartPanel variant="inline" {...cartPanelProps} />
          </div>
        </div>

        {/* DESKTOP PERSISTENT RIGHT CART RAIL (>= 1200px) */}
        <aside className="hidden xl:block w-[390px] 2xl:w-[430px] shrink-0 sticky top-[5.25rem] h-[calc(100dvh-6.25rem)]">
          <WarehouseCartPanel variant="rail" {...cartPanelProps} />
        </aside>
      </div>

      {/* MOBILE / TABLET STICKY DOCKED SUMMARY & SUBMIT CTA (< 1200px) */}
      <div className="xl:hidden wms-hide-on-mobile-typing fixed left-0 right-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-30 px-2.5 sm:px-3 pb-2 md:pb-3 pointer-events-none no-print">
        <div className="max-w-4xl mx-auto bg-[#0b0f19]/95 backdrop-blur-md border border-slate-800 rounded-2xl p-2 sm:px-4 shadow-2xl pointer-events-auto flex items-center justify-between gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsCartDrawerOpen(true)}
            className="flex items-center gap-2 min-h-[46px] px-1.5 sm:px-2 rounded-xl hover:bg-white/10 text-left transition touch-manipulation min-w-0 shrink"
          >
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-white" />
              {totalLines > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white font-mono text-[10px] font-black flex items-center justify-center tabular-nums">
                  {totalLines}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block leading-none">
                Carrello
              </span>
              <div className="text-[11px] sm:text-sm font-black text-white font-mono tabular-nums whitespace-nowrap mt-1">
                {productLinesCount} art. · {totalUnits}
                <span className="hidden min-[380px]:inline"> un.</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={cart.length === 0 || isSubmitting || !documentType}
            className="shrink-0 sm:min-w-[220px] h-12 px-3 sm:px-5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-35 text-white font-extrabold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-red-600/25 transition uppercase tracking-wide touch-manipulation"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">
              {editingOrder ? 'Aggiorna' : 'Trasmetti Ordine'}
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET / TABLET DRAWER FOR CART (< 1200px) */}
      {isCartDrawerOpen && (
        <div
          className="xl:hidden fixed inset-0 z-[65] bg-slate-950/70 backdrop-blur-[2px] flex items-end md:items-stretch md:justify-end animate-wms-fade no-print"
          onClick={() => setIsCartDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full md:w-[430px] h-[88dvh] md:h-full bg-white rounded-t-2xl md:rounded-none shadow-2xl overflow-hidden animate-wms-slide-up md:animate-wms-slide-left flex flex-col"
          >
            <WarehouseCartPanel
              variant="drawer"
              onCloseDrawer={() => setIsCartDrawerOpen(false)}
              {...cartPanelProps}
            />
          </div>
        </div>
      )}

      {/* TOUCH QUANTITY KEYPAD MODAL */}
      <TouchNumpadModal
        isOpen={Boolean(editingItem?.product)}
        product={editingItem?.product || null}
        initialQuantity={editingItem?.quantity || 1}
        unitOfMeasure={
          editingItem?.unitOfMeasure || editingItem?.product?.unit_of_measure || 'PZ'
        }
        onClose={() => setEditingItem(null)}
        onConfirm={handleSaveQuantityPad}
        onTriggerHaptic={triggerHaptic}
      />

      {/* CONFIRM CLEAR CART DIALOG */}
      <ConfirmDialog
        isOpen={showClearCartConfirm}
        onCancel={() => setShowClearCartConfirm(false)}
        onConfirm={handleConfirmClearCart}
        title="Svuotare la distinta di carico?"
        description={`Verranno rimosse tutte le ${cart.length} righe attualmente inserite nel carrello. L'operazione non può essere annullata.`}
        confirmLabel="Svuota Carrello"
        cancelLabel="Mantieni Articoli"
        tone="danger"
      />

      {/* CONFIRMATION MODAL BEFORE ORDER SUBMIT */}
      <ResponsiveSheetModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        maxWidthClass="sm:max-w-lg"
        headerTone="dark"
        title={editingOrder ? `Aggiorna Ordine ${editingOrder.order_number}` : 'Conferma Trasmissione Ordine'}
        subtitle="Verifica intestazione e distinta materiali prima dell'invio"
        footer={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white text-slate-800 font-bold text-xs sm:text-sm hover:bg-slate-100 active:scale-[0.98] transition touch-manipulation"
            >
              Torna al Carico
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-[0.98] transition uppercase touch-manipulation"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>
                {isSubmitting
                  ? 'Trasmissione...'
                  : editingOrder
                  ? 'Aggiorna Ordine'
                  : 'Conferma e Invia'}
              </span>
            </button>
          </div>
        }
      >
        <div className="p-4 sm:p-5 space-y-4">
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

          <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-500">
            <span>Distinta Materiali ({cart.length})</span>
            <span className="font-mono text-slate-900">{totalUnits} unità tot.</span>
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

          {!isOnline && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Sei offline: l&apos;ordine sarà salvato localmente e sincronizzato appena torna internet.
              </span>
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>
      </ResponsiveSheetModal>

      {/* Barcode & QR Code Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
