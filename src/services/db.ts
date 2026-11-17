import {
  CompanySettings,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ExcelImportRow,
  UserRole,
  CustomerCommitment,
  CommitmentItem,
  CommitmentCategory,
  CommitmentStatus,
} from '../types';
import { INITIAL_PRODUCTS } from '../data/initialCatalog';
import { getSupabaseClient } from '../lib/supabase';
import { playOrderNotificationChime } from '../lib/audio';
import { idbGetAllProducts, idbSaveAllProducts, idbClearProducts, idbGetAllOrders, idbSaveAllOrders } from './indexedDb';

const STORAGE_KEY_PRODUCTS = 'magazzino_products_v1';
const STORAGE_KEY_ORDERS = 'magazzino_orders_v1';
const STORAGE_KEY_ORDER_SEQ = 'magazzino_order_sequence_v1';
const STORAGE_KEY_PENDING = 'magazzino_pending_orders_v1';
const STORAGE_KEY_SETTINGS = 'magazzino_company_settings_v1';
const STORAGE_KEY_COMMITMENTS = 'magazzino_commitments_v1';
const COMMITMENT_DB_PREFIX = '__SAGGIN_IMP_V1__';

// Clear legacy bloated localStorage products entry to eliminate quota errors
try {
  localStorage.removeItem(STORAGE_KEY_PRODUCTS);
} catch {
  // Ignore
}

// In-memory cache for ultra-fast, zero-latency synchronous access during typing/searching
let cachedProducts: Product[] | null = null;
let cachedOrders: Order[] | null = null;
let cachedCommitments: CustomerCommitment[] | null = null;

// Cross-tab / cross-window real-time synchronization channel
const broadcastChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('magazzino_realtime_sync')
  : null;

type OrderListener = (orders: Order[], newOrderEvent?: Order) => void;
type CatalogListener = (products: Product[]) => void;
type CommitmentListener = (commitments: CustomerCommitment[]) => void;

const orderListeners = new Set<OrderListener>();
const catalogListeners = new Set<CatalogListener>();
const commitmentListeners = new Set<CommitmentListener>();

// Default company settings
const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'SAGGIN',
  legalName: 'Saggin Guglielmo S.R.L. - Materiali Edili e Ferramenta',
  address: 'Via P. Roberto, 80 - 36055 Nove (VI) · Sede Marostica: Via Del Donatore, 3',
  vatNumber: 'IT 01780770242',
  phone: '+39 0424 590 086',
  email: 'info@saggin.it',
  notes: 'Materiale caricato su automezzo del cliente. Documento di trasporto interno per emissione bolla / fattura.',
};

// Default passwords
const DEFAULT_PASSWORDS = {
  magazzino: '1234',
  ufficio: 'ufficio2026',
};

// Initialize BroadcastChannel listener for same-browser multi-tab sync
if (broadcastChannel) {
  broadcastChannel.onmessage = async (event) => {
    const { type, payload } = event.data || {};
    if (type === 'NEW_ORDER') {
      const orders = getLocalOrders();
      orderListeners.forEach(listener => listener(orders, payload));
      playOrderNotificationChime();
    } else if (type === 'ORDER_UPDATED') {
      const orders = getLocalOrders();
      orderListeners.forEach(listener => listener(orders));
    } else if (type === 'COMMITMENTS_UPDATED') {
      const commitments = getLocalCommitments();
      commitmentListeners.forEach(listener => listener(commitments));
    } else if (type === 'CATALOG_UPDATED') {
      const prods = await idbGetAllProducts();
      cachedProducts = prods;
      catalogListeners.forEach(listener => listener(prods));
    }
  };
}

// Initialize Server-Sent Events (SSE) only for legacy local server mode (when Supabase is not configured)
if (typeof window !== 'undefined' && typeof EventSource !== 'undefined' && !getSupabaseClient()) {
  let evtSource: EventSource | null = null;
  const connectSSE = () => {
    if (getSupabaseClient()) return;
    try {
      evtSource = new EventSource('/api/events');
      evtSource.onmessage = async (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === 'NEW_ORDER') {
            const freshOrders = await fetchOrders(true);
            orderListeners.forEach(listener => listener(freshOrders, parsed.payload));
            playOrderNotificationChime();
          } else if (parsed.type === 'ORDER_UPDATED') {
            const freshOrders = await fetchOrders(true);
            orderListeners.forEach(listener => listener(freshOrders));
          } else if (parsed.type === 'CATALOG_UPDATED') {
            const freshProds = await fetchProducts(true);
            catalogListeners.forEach(listener => listener(freshProds));
          }
        } catch {
          // Ignore parsing issues
        }
      };
      evtSource.onerror = () => {
        evtSource?.close();
        setTimeout(connectSSE, 4000);
      };
    } catch {
      // Ignore
    }
  };
  connectSSE();
}

// --------------------------------------------------------------------------
// STORAGE HELPERS
// --------------------------------------------------------------------------

function getLocalProducts(): Product[] {
  if (cachedProducts !== null) {
    return cachedProducts;
  }
  return INITIAL_PRODUCTS;
}

function getLocalOrders(): Order[] {
  if (cachedOrders !== null) {
    return cachedOrders;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (raw) {
      cachedOrders = JSON.parse(raw);
      return cachedOrders || [];
    }
  } catch (err) {
    console.warn('Reading orders from localStorage:', err);
  }
  return [];
}

function saveLocalOrders(orders: Order[]): void {
  cachedOrders = orders;
  idbSaveAllOrders(orders).catch(err => console.warn('IDB save orders notice:', err));
  try {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
  } catch (err) {
    console.warn('localStorage quota reached, orders safely preserved in IndexedDB:', err);
  }
}

function getNextOrderNumber(): string {
  try {
    let current = parseInt(localStorage.getItem(STORAGE_KEY_ORDER_SEQ) || '0', 10);
    // Also inspect existing orders to avoid any regression
    const existing = getLocalOrders();
    for (const ord of existing) {
      const numMatch = ord.order_number?.match(/ORD-(\d+)/);
      if (numMatch && numMatch[1]) {
        const val = parseInt(numMatch[1], 10);
        if (val > current) current = val;
      }
    }
    const nextVal = current + 1;
    localStorage.setItem(STORAGE_KEY_ORDER_SEQ, String(nextVal));
    return `ORD-${String(nextVal).padStart(6, '0')}`;
  } catch {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `ORD-${rand}`;
  }
}

function getLocalPendingOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalPendingOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(orders));
  } catch (err) {
    console.error('Error saving pending orders:', err);
  }
}

function getLocalCommitments(): CustomerCommitment[] {
  if (cachedCommitments !== null) {
    return cachedCommitments;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMITMENTS);
    if (raw) {
      cachedCommitments = JSON.parse(raw);
      return cachedCommitments || [];
    }
  } catch (err) {
    console.warn('Reading commitments from localStorage:', err);
  }
  return [];
}

function saveLocalCommitments(commitments: CustomerCommitment[]): void {
  cachedCommitments = commitments;
  try {
    localStorage.setItem(STORAGE_KEY_COMMITMENTS, JSON.stringify(commitments));
  } catch (err) {
    console.warn('Error saving commitments to localStorage:', err);
  }
}

interface CommitmentHeaderMeta {
  n: string; // commitment_number
  c: string; // customer_name
  cat: CommitmentCategory; // 'STANDARD' | 'VELUX'
  inst?: string | null; // installer_name
  notes?: string | null; // notes
  st?: CommitmentStatus; // 'ATTIVO' | 'CARICATO'
}

function isCommitmentOrderRow(row: any): boolean {
  return typeof row?.customer_reference === 'string' && row.customer_reference.startsWith(COMMITMENT_DB_PREFIX);
}

function encodeCommitmentHeaderMeta(meta: CommitmentHeaderMeta): string {
  return COMMITMENT_DB_PREFIX + JSON.stringify(meta);
}

function parseCommitmentFromOrderRow(row: any): CustomerCommitment | null {
  if (!isCommitmentOrderRow(row)) return null;
  if (row.archived_at) return null; // Soft-deleted commitment

  try {
    const rawJson = String(row.customer_reference).slice(COMMITMENT_DB_PREFIX.length);
    const meta = JSON.parse(rawJson) as CommitmentHeaderMeta;
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items: CommitmentItem[] = rawItems.map((it: any) => ({
      id: it.id || crypto.randomUUID(),
      product_id: it.product_id || null,
      product_code: it.product_code_snapshot || '',
      product_description: it.product_description_snapshot || it.manual_description || '',
      unit_of_measure: it.unit_of_measure_snapshot || 'PZ',
      quantity: Number(it.quantity) || 1,
    }));

    const status: CommitmentStatus =
      row.status === 'COMPLETATO' || meta.st === 'CARICATO' ? 'CARICATO' : 'ATTIVO';

    return {
      id: row.id,
      commitment_number: meta.n || row.order_number || 'IMP',
      customer_name: meta.c || 'Cliente',
      category: meta.cat === 'VELUX' ? 'VELUX' : 'STANDARD',
      installer_name: meta.inst || null,
      notes: meta.notes || null,
      status,
      items,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Failed to parse commitment row:', err);
    return null;
  }
}


// --------------------------------------------------------------------------
// CATALOG OPERATIONS (Backed by IndexedDB with in-memory caching)
// --------------------------------------------------------------------------

export async function fetchProducts(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh && cachedProducts !== null) {
    return cachedProducts;
  }

  // Serve the previously downloaded catalog immediately on repeat visits.
  // Refresh Supabase in the background and notify subscribers when it finishes.
  if (!forceRefresh && cachedProducts === null) {
    const localProducts = await idbGetAllProducts();
    if (localProducts.length > 0) {
      cachedProducts = localProducts;
      if (getSupabaseClient()) {
        void fetchProducts(true)
          .then(freshProducts => {
            if (freshProducts.length > 0) {
              catalogListeners.forEach(listener => listener(freshProducts));
            }
          })
          .catch(err => console.warn('[Catalog] Background refresh failed:', err));
      }
      return localProducts;
    }
  }

  // When Supabase is configured, it is the source of truth.
  // Read in pages because Supabase commonly limits each response to 1,000 rows.
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const PAGE_SIZE = 1000;
      const PAGE_CONCURRENCY = 8;
      const firstPage = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('code', { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (firstPage.error) throw firstPage.error;

      const allProducts: Product[] = (firstPage.data || []) as Product[];
      const expectedCount = firstPage.count;

      if (typeof expectedCount === 'number' && allProducts.length < expectedCount) {
        const offsets: number[] = [];
        for (let offset = PAGE_SIZE; offset < expectedCount; offset += PAGE_SIZE) {
          offsets.push(offset);
        }

        // Fetch catalog pages in small parallel batches instead of 100+
        // sequential network round trips. Stable code ordering keeps pages deterministic.
        for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
          const batchOffsets = offsets.slice(i, i + PAGE_CONCURRENCY);
          const pages = await Promise.all(batchOffsets.map(offset =>
            supabase
              .from('products')
              .select('*')
              .order('code', { ascending: true })
              .range(offset, offset + PAGE_SIZE - 1)
          ));

          for (const pageResponse of pages) {
            if (pageResponse.error) throw pageResponse.error;
            allProducts.push(...((pageResponse.data || []) as Product[]));
          }
        }
      }

      if (typeof expectedCount === 'number' && allProducts.length !== expectedCount) {
        throw new Error(
          `Catalogo incompleto: scaricati ${allProducts.length} articoli su ${expectedCount} presenti in Supabase.`
        );
      }
      cachedProducts = allProducts;
      await idbSaveAllProducts(allProducts);
      return allProducts;
    } catch (err) {
      console.error('[Catalog] Supabase fetch failed:', err);
      // Do not cache an empty fallback after a failed request: that would
      // prevent a later retry and leave the warehouse search permanently empty.
      const idbProducts = await idbGetAllProducts();
      if (idbProducts && idbProducts.length > 0) {
        cachedProducts = idbProducts;
        return idbProducts;
      }
      cachedProducts = null;
      return [];
    }
  }

  // Legacy server API is used only when no Supabase project is configured.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          cachedProducts = data.products;
          await idbSaveAllProducts(data.products);
          return data.products;
        }
      }
    } catch {
      // Continue with local cache.
    }
  }

  const idbProducts = await idbGetAllProducts();
  if (idbProducts && idbProducts.length > 0) {
    cachedProducts = idbProducts;
    return idbProducts;
  }

  cachedProducts = INITIAL_PRODUCTS;
  await idbSaveAllProducts(INITIAL_PRODUCTS);
  return INITIAL_PRODUCTS;
}

export async function importExcelProductsToDb(
  parsedRows: ExcelImportRow[]
): Promise<{ added: number; updated: number; total: number }> {
  // Refresh from the authoritative source before calculating additions/updates.
  const currentProducts = await fetchProducts(true);
  const productMap = new Map<string, Product>();
  for (const product of currentProducts) productMap.set(product.code, product);

  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const rowsToSave: Array<{
    code: string;
    description: string;
    unit_of_measure: string;
    alternative_code: string | null;
    updated_at: string;
  }> = [];

  for (const row of parsedRows) {
    if (!row.code || !row.description || !row.unit_of_measure) continue;

    const existing = productMap.get(row.code);
    if (existing) {
      updated++;
    } else {
      added++;
    }

    rowsToSave.push({
      code: row.code,
      description: row.description,
      unit_of_measure: row.unit_of_measure,
      alternative_code: row.alternative_code || null,
      updated_at: now,
    });
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    // Do not claim success unless every batch has been accepted by Supabase.
    const BATCH_SIZE = 500;
    for (let i = 0; i < rowsToSave.length; i += BATCH_SIZE) {
      const batch = rowsToSave.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('products')
        .upsert(batch, { onConflict: 'code' });
      if (error) {
        throw new Error(`Errore Supabase nel blocco ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      }
    }

    // Reload from the database (paged) so local IDs match the UUIDs generated by PostgreSQL.
    const savedProducts = await fetchProducts(true);
    return { added, updated, total: savedProducts.length };
  }

  // Offline/local-only mode: keep a local catalog, but never send fake string IDs to UUID columns.
  const nowLocal = new Date().toISOString();
  for (const row of rowsToSave) {
    const existing = productMap.get(row.code);
    productMap.set(row.code, {
      id: existing?.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      code: row.code,
      description: row.description,
      unit_of_measure: row.unit_of_measure,
      alternative_code: row.alternative_code,
      created_at: existing?.created_at || nowLocal,
      updated_at: nowLocal,
    });
  }

  const newCatalog = Array.from(productMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );
  cachedProducts = newCatalog;
  await idbSaveAllProducts(newCatalog);
  catalogListeners.forEach(listener => listener(newCatalog));
  if (broadcastChannel) broadcastChannel.postMessage({ type: 'CATALOG_UPDATED' });

  return { added, updated, total: newCatalog.length };
}

export async function clearAllProducts(): Promise<void> {
  cachedProducts = [];
  await idbClearProducts();
  if (typeof window !== 'undefined') {
    fetch('/api/products', { method: 'DELETE' }).catch(() => {});
  }
  catalogListeners.forEach(listener => listener([]));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'CATALOG_UPDATED' });
  }
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('products').delete().neq('code', '');
    } catch (err) {
      console.warn('Error clearing Supabase products:', err);
    }
  }
}

// --------------------------------------------------------------------------
// ORDERS OPERATIONS
// --------------------------------------------------------------------------

export async function fetchOrders(forceRefresh = false): Promise<Order[]> {
  // Supabase is the single source of truth. Do not read /api/orders:
  // on Vercel that legacy endpoint may return an empty server-side list,
  // which previously overwrote valid local orders and hid database orders.
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false });

      if (ordersErr) {
        console.error('[Orders] Supabase read failed; preserving local cache:', ordersErr);
      } else if (ordersData) {
        const normalizedOrders = ordersData.map((order: any) => ({
          ...order,
          items: Array.isArray(order.items) ? order.items : [],
        })) as Order[];
        saveLocalOrders(normalizedOrders);
        return normalizedOrders;
      }
    } catch (err) {
      console.error('[Orders] Unexpected Supabase read failure; preserving local cache:', err);
    }
  }

  // Only use local storage as a fallback when Supabase is unavailable or failed.
  if (cachedOrders === null || forceRefresh) {
    const idbOrders = await idbGetAllOrders();
    if (idbOrders && idbOrders.length > 0) {
      cachedOrders = idbOrders;
      return idbOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  const local = getLocalOrders();
  return local.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createNewOrder(orderInput: {
  customer_reference: string | null;
  document_type?: import('../types').OrderDocumentType;
  warehouse_location?: import('../types').WarehouseLocation;
  items: {
    id: string;
    product?: Product;
    quantity: number;
    unitOfMeasure?: string;
    isDescription?: boolean;
    description?: string;
  }[];
}): Promise<Order> {
  if (!orderInput.items || orderInput.items.length === 0) {
    throw new Error('Impossibile inviare un ordine senza articoli.');
  }

  // Supabase schema uses UUID primary keys for orders and order_items.
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const orderNumber = getNextOrderNumber();

  const formattedItems: OrderItem[] = orderInput.items.map(item => {
    if (item.isDescription) {
      const description = (item.description || '').trim();
      if (!description) throw new Error('La riga descrittiva non può essere vuota.');
      return {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: null,
        line_type: 'DESCRIPTION' as const,
        manual_description: description,
        product_code_snapshot: '',
        product_description_snapshot: description,
        unit_of_measure_snapshot: '',
        alternative_code_snapshot: null,
        quantity: 0,
      };
    }
    if (!item.product) throw new Error('Riga ordine non valida.');
    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.product.id,
      line_type: 'PRODUCT' as const,
      manual_description: null,
      product_code_snapshot: item.product.code,
      product_description_snapshot: item.product.description,
      unit_of_measure_snapshot: item.unitOfMeasure || item.product.unit_of_measure,
      alternative_code_snapshot: item.product.alternative_code || null,
      quantity: Number(item.quantity) || 1,
    };
  });

  const newOrder: Order = {
    id: orderId,
    order_number: orderNumber,
    customer_reference: orderInput.customer_reference?.trim() || null,
    document_type: orderInput.document_type ?? 'DDT',
    warehouse_location: orderInput.warehouse_location ?? 'MAGAZZINO',
    status: 'NUOVO',
    created_at: now,
    updated_at: now,
    items: formattedItems,
  };

  // 1. Immediately save to local orders for 100% resilience
  const currentOrders = getLocalOrders();
  const updatedOrders = [newOrder, ...currentOrders];
  saveLocalOrders(updatedOrders);

  // 2. Play local audio notification and inform local listeners
  playOrderNotificationChime();
  orderListeners.forEach(l => l(updatedOrders, newOrder));

  // 3. Broadcast to all open tabs / devices via BroadcastChannel
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'NEW_ORDER', payload: newOrder });
  }

  // 4. Send to Central Server only if Supabase is not configured (legacy Express mode)
  const supabase = getSupabaseClient();
  if (typeof window !== 'undefined' && !supabase) {
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
    }).catch(err => {
      console.warn('Central server order post notice:', err);
    });
  }

  // 5. If online and Supabase is configured, push to Supabase
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline && supabase) {
    try {
      const { data: dbOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          id: newOrder.id,
          // The database trigger assigns a globally unique order number.
          order_number: '',
          customer_reference: newOrder.customer_reference,
          document_type: newOrder.document_type,
          warehouse_location: newOrder.warehouse_location,
          status: newOrder.status,
          created_at: newOrder.created_at,
          updated_at: newOrder.updated_at,
        })
        .select()
        .single();

      if (orderErr) {
        console.warn('Supabase order insert error, queuing for retry:', orderErr);
        queuePendingOrder(newOrder);
      } else {
        // Use the authoritative order number generated by the Supabase trigger.
        newOrder.order_number = dbOrder.order_number;
        const refreshedLocalOrders = getLocalOrders().map(order => order.id === newOrder.id ? newOrder : order);
        saveLocalOrders(refreshedLocalOrders);

        // Insert order items
        const dbItems = formattedItems.map(it => ({
          id: it.id,
          order_id: dbOrder.id,
          product_id: it.product_id,
          line_type: it.line_type ?? 'PRODUCT',
          manual_description: it.manual_description ?? null,
          product_code_snapshot: it.product_code_snapshot,
          product_description_snapshot: it.product_description_snapshot,
          unit_of_measure_snapshot: it.unit_of_measure_snapshot,
          alternative_code_snapshot: it.alternative_code_snapshot,
          quantity: it.quantity,
          created_at: now,
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(dbItems);
        if (itemsErr) {
          console.warn('Supabase items insert error, queuing order for retry:', itemsErr);
          queuePendingOrder(newOrder);
        }
      }
    } catch (err) {
      console.warn('Supabase network error during order submit:', err);
      queuePendingOrder(newOrder);
    }
  } else if (!isOnline) {
    // Queue offline order
    queuePendingOrder(newOrder);
  }

  return newOrder;
}

export async function updateExistingOrder(orderId: string, orderInput: {
  customer_reference?: string | null;
  document_type?: import('../types').OrderDocumentType;
  warehouse_location?: import('../types').WarehouseLocation;
  items: {
    id: string;
    product?: Product;
    quantity: number;
    unitOfMeasure?: string;
    isDescription?: boolean;
    description?: string;
  }[];
}): Promise<Order> {
  const currentOrders = getLocalOrders();
  const existingIndex = currentOrders.findIndex(o => o.id === orderId);
  if (existingIndex === -1) {
    throw new Error('Ordine non trovato nel registro locale.');
  }

  const existingOrder = currentOrders[existingIndex];
  const now = new Date().toISOString();

  const formattedItems: OrderItem[] = orderInput.items.map(item => {
    if (item.isDescription) {
      const description = (item.description || '').trim();
      if (!description) throw new Error('La riga descrittiva non può essere vuota.');
      return {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: null,
        line_type: 'DESCRIPTION' as const,
        manual_description: description,
        product_code_snapshot: '',
        product_description_snapshot: description,
        unit_of_measure_snapshot: '',
        alternative_code_snapshot: null,
        quantity: 0,
      };
    }
    if (!item.product) throw new Error('Riga ordine non valida.');
    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.product.id,
      line_type: 'PRODUCT' as const,
      manual_description: null,
      product_code_snapshot: item.product.code,
      product_description_snapshot: item.product.description,
      unit_of_measure_snapshot: item.unitOfMeasure || item.product.unit_of_measure,
      alternative_code_snapshot: item.product.alternative_code || null,
      quantity: Number(item.quantity) || 1,
    };
  });

  const updatedOrder: Order = {
    ...existingOrder,
    customer_reference: orderInput.customer_reference !== undefined ? orderInput.customer_reference : existingOrder.customer_reference,
    document_type: orderInput.document_type || existingOrder.document_type,
    warehouse_location: orderInput.warehouse_location || existingOrder.warehouse_location,
    items: formattedItems,
    updated_at: now,
  };

  currentOrders[existingIndex] = updatedOrder;
  saveLocalOrders(currentOrders);
  orderListeners.forEach(l => l(currentOrders, updatedOrder));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'ORDER_UPDATED', payload: updatedOrder });
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const supabase = getSupabaseClient();

  if (isOnline && supabase) {
    try {
      await supabase
        .from('orders')
        .update({
          customer_reference: updatedOrder.customer_reference,
          document_type: updatedOrder.document_type,
          warehouse_location: updatedOrder.warehouse_location,
          updated_at: now,
        })
        .eq('id', orderId);

      // Re-insert items for simplicity and integrity
      await supabase.from('order_items').delete().eq('order_id', orderId);

      const dbItems = formattedItems.map(it => ({
        id: it.id,
        order_id: orderId,
        product_id: it.product_id,
        line_type: it.line_type ?? 'PRODUCT',
        manual_description: it.manual_description ?? null,
        product_code_snapshot: it.product_code_snapshot,
        product_description_snapshot: it.product_description_snapshot,
        unit_of_measure_snapshot: it.unit_of_measure_snapshot,
        alternative_code_snapshot: it.alternative_code_snapshot,
        quantity: it.quantity,
        created_at: now,
      }));

      await supabase.from('order_items').insert(dbItems);
    } catch (err) {
      console.warn('Errore durante l\'aggiornamento dell\'ordine su Supabase:', err);
    }
  }

  return updatedOrder;
}

export async function archiveOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Connessione a Supabase non disponibile.');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({ archived_at: now, updated_at: now })
    .eq('id', orderId);
  if (error) throw error;

  const updated = getLocalOrders().map(order =>
    order.id === orderId ? { ...order, archived_at: now, updated_at: now } : order
  );
  saveLocalOrders(updated);
  orderListeners.forEach(listener => listener(updated));
  broadcastChannel?.postMessage({ type: 'ORDER_UPDATED', payload: { id: orderId, archived_at: now } });
}

export async function restoreOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Connessione a Supabase non disponibile.');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({ archived_at: null, updated_at: now })
    .eq('id', orderId);
  if (error) throw error;

  const updated = getLocalOrders().map(order =>
    order.id === orderId ? { ...order, archived_at: null, updated_at: now } : order
  );
  saveLocalOrders(updated);
  orderListeners.forEach(listener => listener(updated));
  broadcastChannel?.postMessage({ type: 'ORDER_UPDATED', payload: { id: orderId, archived_at: null } });
}

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<Order> {
  const currentOrders = getLocalOrders();
  const targetIndex = currentOrders.findIndex(o => o.id === orderId);

  if (targetIndex === -1) {
    throw new Error('Ordine non trovato');
  }

  const now = new Date().toISOString();
  const updatedOrder: Order = {
    ...currentOrders[targetIndex],
    status: newStatus,
    updated_at: now,
  };

  currentOrders[targetIndex] = updatedOrder;
  saveLocalOrders(currentOrders);

  // Notify listeners and other tabs
  orderListeners.forEach(l => l(currentOrders));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'ORDER_UPDATED', payload: updatedOrder });
  }

  const supabase = getSupabaseClient();

  // Update on central server only if Supabase is not configured
  if (typeof window !== 'undefined' && !supabase) {
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(err => {
      console.warn('Failed to update status on central server:', err);
    });
  }

  // Update Supabase if available
  if (supabase) {
    try {
      await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: now })
        .eq('id', orderId);
    } catch (err) {
      console.warn('Failed to update status in Supabase:', err);
    }
  }

  return updatedOrder;
}

// --------------------------------------------------------------------------
// OFFLINE QUEUE & SYNC
// --------------------------------------------------------------------------

function queuePendingOrder(order: Order): void {
  const pending = getLocalPendingOrders();
  if (!pending.some(p => p.id === order.id)) {
    pending.push(order);
    saveLocalPendingOrders(pending);
  }
}

export function getPendingOrdersCount(): number {
  return getLocalPendingOrders().length;
}

let pendingSyncPromise: Promise<{ synced: number; remaining: number; errors: string[] }> | null = null;

export function syncPendingOrders(): Promise<{ synced: number; remaining: number; errors: string[] }> {
  // A single shared promise prevents the online event, timer and manual button
  // from running the same queue concurrently.
  if (pendingSyncPromise) return pendingSyncPromise;

  pendingSyncPromise = (async () => {
    const pending = getLocalPendingOrders();
    if (pending.length === 0) return { synced: 0, remaining: 0, errors: [] };

    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        synced: 0,
        remaining: pending.length,
        errors: ['Connessione a Supabase non configurata. Gli ordini restano salvati sul dispositivo.'],
      };
    }

    let synced = 0;
    const stillPending: Order[] = [];
    const errors: string[] = [];

    for (const order of pending) {
      try {
        if (!order.id || !Array.isArray(order.items) || order.items.length === 0) {
          stillPending.push(order);
          errors.push(`${order.order_number || order.id || 'Ordine'}: dati ordine incompleti; nessun dato è stato eliminato.`);
          continue;
        }

        // Keep the same ID on every retry. An empty number lets the database
        // trigger assign the canonical sequence when the header is first created.
        // ignoreDuplicates makes retries safe if the header was saved before a timeout.
        const { error: orderError } = await supabase.from('orders').upsert({
          id: order.id,
          order_number: '',
          customer_reference: order.customer_reference,
          document_type: order.document_type ?? null,
          warehouse_location: order.warehouse_location ?? 'MAGAZZINO',
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
        }, { onConflict: 'id', ignoreDuplicates: true });

        if (orderError) {
          stillPending.push(order);
          errors.push(`${order.order_number}: ${orderError.message}`);
          continue;
        }

        // Read the database-generated number. This also handles a previous
        // attempt that created the header but lost its network response.
        const { data: savedHeader, error: headerReadError } = await supabase
          .from('orders')
          .select('order_number')
          .eq('id', order.id)
          .maybeSingle();

        if (headerReadError || !savedHeader) {
          stillPending.push(order);
          errors.push(`${order.order_number}: impossibile verificare l'intestazione salvata${headerReadError ? ` (${headerReadError.message})` : ''}.`);
          continue;
        }

        const dbItems = order.items.map(it => ({
          id: it.id,
          order_id: order.id,
          product_id: it.product_id,
          line_type: it.line_type ?? 'PRODUCT',
          manual_description: it.manual_description ?? null,
          product_code_snapshot: it.product_code_snapshot,
          product_description_snapshot: it.product_description_snapshot,
          unit_of_measure_snapshot: it.unit_of_measure_snapshot,
          alternative_code_snapshot: it.alternative_code_snapshot,
          quantity: it.quantity,
          created_at: order.created_at,
        }));

        // Upsert by the stable item ID: partial prior attempts are completed
        // without inserting duplicate rows.
        const { error: itemsError } = await supabase
          .from('order_items')
          .upsert(dbItems, { onConflict: 'id', ignoreDuplicates: true });

        if (itemsError) {
          stillPending.push(order);
          errors.push(`${savedHeader.order_number || order.order_number}: righe non sincronizzate (${itemsError.message}).`);
          continue;
        }

        // Keep the authoritative database number on this device as well.
        const updatedOrder = { ...order, order_number: savedHeader.order_number || order.order_number };
        const localOrders = getLocalOrders().map(local =>
          local.id === order.id ? { ...local, order_number: updatedOrder.order_number } : local
        );
        saveLocalOrders(localOrders);
        synced++;
      } catch (error) {
        stillPending.push(order);
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${order.order_number || order.id}: ${message}`);
      }
    }

    // Remove only orders whose header and every item upsert completed successfully.
    saveLocalPendingOrders(stillPending);
    return { synced, remaining: stillPending.length, errors };
  })();

  return pendingSyncPromise.finally(() => {
    pendingSyncPromise = null;
  });
}

// --------------------------------------------------------------------------
// SUBSCRIPTIONS (LOCAL + SUPABASE REALTIME)
// --------------------------------------------------------------------------

export function subscribeToOrders(callback: OrderListener): () => void {
  orderListeners.add(callback);

  // Setup Supabase Realtime subscription if client available
  const supabase = getSupabaseClient();
  let supabaseChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let realtimeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingInsertedOrderId: string | null = null;

  const scheduleRealtimeRefresh = () => {
    if (realtimeDebounceTimer) {
      clearTimeout(realtimeDebounceTimer);
    }
    realtimeDebounceTimer = setTimeout(async () => {
      realtimeDebounceTimer = null;
      const insertedIdToNotify = pendingInsertedOrderId;
      pendingInsertedOrderId = null;

      const freshOrders = await fetchOrders(true);
      const insertedOrder = insertedIdToNotify
        ? freshOrders.find(order => order.id === insertedIdToNotify)
        : undefined;
      callback(freshOrders, insertedOrder);
    }, 180);
  };

  if (supabase) {
    try {
      supabaseChannel = supabase
        .channel('realtime_orders_sub')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            const newRow = payload.new as { id?: string; customer_reference?: string } | null;
            const insertedId = newRow?.id;
            const isCommitment = isCommitmentOrderRow(newRow);
            if (payload.eventType === 'INSERT' && insertedId && !isCommitment) {
              pendingInsertedOrderId = insertedId;
              playOrderNotificationChime();
            }
            scheduleRealtimeRefresh();
          }
        )
        // Order headers and their items are inserted in two requests. Coalesce
        // bursts of item inserts into a single debounced database fetch.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'order_items' },
          () => {
            scheduleRealtimeRefresh();
          }
        )
        .subscribe((status, err) => {
          console.log('[Realtime] Orders channel status:', status, err || '');
        });
    } catch (err) {
      console.warn('Failed to subscribe to Supabase Realtime channel:', err);
    }
  }

  // Automatic recovery for Windows sleep, app minimize, and network interruptions
  const handleWakeOrFocus = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    // Check if channel was disconnected/closed during sleep and reconnect if needed
    if (supabase && supabaseChannel) {
      const state = (supabaseChannel as any).state;
      if (state === 'closed' || state === 'errored') {
        try {
          supabaseChannel.subscribe();
        } catch {
          // Ignore
        }
      }
    }
    // Refresh orders immediately from cloud without waiting for manual reload
    scheduleRealtimeRefresh();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWakeOrFocus);
    window.addEventListener('online', handleWakeOrFocus);
    document.addEventListener('visibilitychange', handleWakeOrFocus);
  }

  return () => {
    orderListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWakeOrFocus);
      window.removeEventListener('online', handleWakeOrFocus);
      document.removeEventListener('visibilitychange', handleWakeOrFocus);
    }
    if (realtimeDebounceTimer) {
      clearTimeout(realtimeDebounceTimer);
    }
    if (supabase && supabaseChannel) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}

export function subscribeToCatalog(callback: CatalogListener): () => void {
  catalogListeners.add(callback);
  return () => {
    catalogListeners.delete(callback);
  };
}

// --------------------------------------------------------------------------
// IMPEGNI CLIENTI & VELUX OPERATIONS
// --------------------------------------------------------------------------

export async function fetchCommitments(forceRefresh = false): Promise<CustomerCommitment[]> {
  if (forceRefresh && getSupabaseClient()) {
    await fetchOrders(true);
  }
  const list = getLocalCommitments();
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function subscribeToCommitments(callback: CommitmentListener): () => void {
  commitmentListeners.add(callback);
  return () => {
    commitmentListeners.delete(callback);
  };
}

export async function createCustomerCommitment(input: {
  commitment_number: string;
  customer_name: string;
  category: CommitmentCategory;
  installer_name?: string | null;
  notes?: string | null;
  items: {
    id?: string;
    product_id?: string | null;
    product_code: string;
    product_description: string;
    unit_of_measure: string;
    quantity: number;
  }[];
}): Promise<CustomerCommitment> {
  if (!input.customer_name.trim()) {
    throw new Error('Inserisci il nome del cliente.');
  }
  if (!input.commitment_number.trim()) {
    throw new Error("Inserisci il numero di impegno cliente.");
  }
  if (!input.items || input.items.length === 0) {
    throw new Error("Aggiungi almeno un articolo all'impegno cliente.");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const formattedItems: CommitmentItem[] = input.items.map(it => ({
    id: it.id || crypto.randomUUID(),
    product_id: it.product_id || null,
    product_code: (it.product_code || 'ART').trim(),
    product_description: (it.product_description || '').trim(),
    unit_of_measure: (it.unit_of_measure || 'PZ').trim().toUpperCase(),
    quantity: Number(it.quantity) || 1,
  }));

  const newCommitment: CustomerCommitment = {
    id,
    commitment_number: input.commitment_number.trim(),
    customer_name: input.customer_name.trim(),
    category: input.category,
    installer_name: input.installer_name?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'ATTIVO',
    items: formattedItems,
    created_at: now,
    updated_at: now,
  };

  const current = getLocalCommitments();
  const updated = [newCommitment, ...current];
  saveLocalCommitments(updated);
  commitmentListeners.forEach(l => l(updated));
  broadcastChannel?.postMessage({ type: 'COMMITMENTS_UPDATED' });

  const supabase = getSupabaseClient();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (supabase && isOnline) {
    try {
      const encodedRef = encodeCommitmentHeaderMeta({
        n: newCommitment.commitment_number,
        c: newCommitment.customer_name,
        cat: newCommitment.category,
        inst: newCommitment.installer_name,
        notes: newCommitment.notes,
        st: newCommitment.status,
      });

      const { data: dbRow, error: headerErr } = await supabase
        .from('orders')
        .insert({
          id: newCommitment.id,
          order_number: '',
          customer_reference: encodedRef,
          document_type: 'DDT',
          warehouse_location: 'MAGAZZINO',
          status: 'IN_PREPARAZIONE',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (!headerErr && dbRow) {
        const dbItems = formattedItems.map(it => ({
          id: it.id,
          order_id: dbRow.id,
          product_id: it.product_id,
          line_type: 'PRODUCT',
          manual_description: null,
          product_code_snapshot: it.product_code,
          product_description_snapshot: it.product_description,
          unit_of_measure_snapshot: it.unit_of_measure,
          alternative_code_snapshot: null,
          quantity: it.quantity,
          created_at: now,
        }));
        await supabase.from('order_items').insert(dbItems);
      } else if (headerErr) {
        console.warn('[Commitments] Supabase insert notice:', headerErr);
      }
    } catch (err) {
      console.warn('[Commitments] Cloud sync error:', err);
    }
  }

  return newCommitment;
}

export async function updateCustomerCommitment(
  id: string,
  input: {
    commitment_number: string;
    customer_name: string;
    category: CommitmentCategory;
    installer_name?: string | null;
    notes?: string | null;
    status?: CommitmentStatus;
    items: {
      id?: string;
      product_id?: string | null;
      product_code: string;
      product_description: string;
      unit_of_measure: string;
      quantity: number;
    }[];
  }
): Promise<CustomerCommitment> {
  const current = getLocalCommitments();
  const idx = current.findIndex(c => c.id === id);
  if (idx === -1) {
    throw new Error('Impegno cliente non trovato.');
  }

  const existing = current[idx];
  const now = new Date().toISOString();
  const formattedItems: CommitmentItem[] = input.items.map(it => ({
    id: crypto.randomUUID(),
    product_id: it.product_id || null,
    product_code: (it.product_code || 'ART').trim(),
    product_description: (it.product_description || '').trim(),
    unit_of_measure: (it.unit_of_measure || 'PZ').trim().toUpperCase(),
    quantity: Number(it.quantity) || 1,
  }));

  const updatedCommitment: CustomerCommitment = {
    ...existing,
    commitment_number: input.commitment_number.trim(),
    customer_name: input.customer_name.trim(),
    category: input.category,
    installer_name: input.installer_name?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status || existing.status,
    items: formattedItems,
    updated_at: now,
  };

  const nextList = [...current];
  nextList[idx] = updatedCommitment;
  saveLocalCommitments(nextList);
  commitmentListeners.forEach(l => l(nextList));
  broadcastChannel?.postMessage({ type: 'COMMITMENTS_UPDATED' });

  const supabase = getSupabaseClient();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (supabase && isOnline) {
    try {
      const encodedRef = encodeCommitmentHeaderMeta({
        n: updatedCommitment.commitment_number,
        c: updatedCommitment.customer_name,
        cat: updatedCommitment.category,
        inst: updatedCommitment.installer_name,
        notes: updatedCommitment.notes,
        st: updatedCommitment.status,
      });

      await supabase
        .from('orders')
        .update({
          customer_reference: encodedRef,
          status: updatedCommitment.status === 'CARICATO' ? 'COMPLETATO' : 'IN_PREPARAZIONE',
          updated_at: now,
        })
        .eq('id', id);

      await supabase.from('order_items').delete().eq('order_id', id);

      const dbItems = formattedItems.map(it => ({
        id: it.id,
        order_id: id,
        product_id: it.product_id,
        line_type: 'PRODUCT',
        manual_description: null,
        product_code_snapshot: it.product_code,
        product_description_snapshot: it.product_description,
        unit_of_measure_snapshot: it.unit_of_measure,
        alternative_code_snapshot: null,
        quantity: it.quantity,
        created_at: now,
      }));
      await supabase.from('order_items').insert(dbItems);
    } catch (err) {
      console.warn('[Commitments] Cloud update error:', err);
    }
  }

  return updatedCommitment;
}

export async function markCommitmentAsLoaded(id: string): Promise<void> {
  const current = getLocalCommitments();
  const target = current.find(c => c.id === id);
  if (!target) return;

  const now = new Date().toISOString();
  const updatedCommitment: CustomerCommitment = {
    ...target,
    status: 'CARICATO',
    updated_at: now,
  };

  const nextList = current.map(c => (c.id === id ? updatedCommitment : c));
  saveLocalCommitments(nextList);
  commitmentListeners.forEach(l => l(nextList));
  broadcastChannel?.postMessage({ type: 'COMMITMENTS_UPDATED' });

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const encodedRef = encodeCommitmentHeaderMeta({
        n: updatedCommitment.commitment_number,
        c: updatedCommitment.customer_name,
        cat: updatedCommitment.category,
        inst: updatedCommitment.installer_name,
        notes: updatedCommitment.notes,
        st: 'CARICATO',
      });
      await supabase
        .from('orders')
        .update({
          customer_reference: encodedRef,
          status: 'COMPLETATO',
          updated_at: now,
        })
        .eq('id', id);
    } catch (err) {
      console.warn('[Commitments] Could not mark commitment loaded in cloud:', err);
    }
  }
}

export async function deleteCustomerCommitment(id: string): Promise<void> {
  const current = getLocalCommitments().filter(c => c.id !== id);
  saveLocalCommitments(current);
  commitmentListeners.forEach(l => l(current));
  broadcastChannel?.postMessage({ type: 'COMMITMENTS_UPDATED' });

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const now = new Date().toISOString();
      await supabase
        .from('orders')
        .update({ archived_at: now, updated_at: now })
        .eq('id', id);
    } catch (err) {
      console.warn('[Commitments] Cloud delete notice:', err);
    }
  }
}

// --------------------------------------------------------------------------
// SETTINGS & AUTHENTICATION
// --------------------------------------------------------------------------

export function getCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_COMPANY_SETTINGS;
    return { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COMPANY_SETTINGS;
  }
}

export function saveCompanySettings(settings: CompanySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save company settings:', err);
  }
}

export async function signInRole(role: UserRole, inputSecret: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Connessione a Supabase non configurata.');

  const email = role === 'magazzino' ? 'magazzino@saggin.local' : 'ufficio@saggin.local';
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: inputSecret.trim(),
  });

  if (error || !data.user) {
    throw new Error('PIN / password non corretti.');
  }

  const { data: roleRecord, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (roleError) {
    await supabase.auth.signOut();
    console.error('[Auth] Errore durante la lettura di user_roles:', roleError);
    throw new Error(`Accesso riuscito, ma impossibile verificare il ruolo: ${roleError.message}`);
  }

  if (!roleRecord) {
    await supabase.auth.signOut();
    console.error('[Auth] Nessun record user_roles trovato per:', data.user.id);
    throw new Error('Accesso riuscito, ma non esiste un ruolo associato a questo account.');
  }

  if (roleRecord.role !== role) {
    await supabase.auth.signOut();
    console.error('[Auth] Ruolo non corrispondente:', { expected: role, actual: roleRecord.role, userId: data.user.id });
    throw new Error(`Ruolo non corrispondente: selezionato "${role}", account associato a "${roleRecord.role}".`);
  }
}

export async function getAuthenticatedRole(): Promise<UserRole | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: roleRecord, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (roleError || (roleRecord?.role !== 'magazzino' && roleRecord?.role !== 'ufficio')) {
    await supabase.auth.signOut();
    return null;
  }

  return roleRecord.role as UserRole;
}

export async function signOutRole(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function changeRolePassword(role: UserRole, newPass: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Connessione a Supabase non configurata.');
  if (!newPass.trim()) throw new Error('Inserisci una nuova password.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Sessione scaduta. Accedi nuovamente.');

  const { data: roleRecord, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (roleError || roleRecord?.role !== role) {
    throw new Error('Puoi modificare solo le credenziali del ruolo attualmente autenticato.');
  }

  const { error } = await supabase.auth.updateUser({ password: newPass.trim() });
  if (error) throw new Error(error.message);
}

// Shared alternative units for products (Supabase-backed + local cache to avoid N+1 network requests).
const STORAGE_KEY_UNIT_OPTIONS = 'magazzino_product_units_cache_v1';
let unitOptionsCache: Record<string, string[]> | null = null;

function getLocalUnitOptionsCache(): Record<string, string[]> {
  if (unitOptionsCache !== null) return unitOptionsCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNIT_OPTIONS);
    unitOptionsCache = raw ? JSON.parse(raw) : {};
  } catch {
    unitOptionsCache = {};
  }
  return unitOptionsCache || {};
}

function saveLocalUnitOptionsCache(cache: Record<string, string[]>): void {
  unitOptionsCache = cache;
  try {
    localStorage.setItem(STORAGE_KEY_UNIT_OPTIONS, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchProductUnitOptions(productId: string): Promise<string[]> {
  const cache = getLocalUnitOptionsCache();
  const supabase = getSupabaseClient();
  if (!supabase) return cache[productId] || [];

  const { data, error } = await supabase
    .from('product_unit_options')
    .select('unit')
    .eq('product_id', productId)
    .order('unit');

  if (error) {
    console.warn('[Units] Could not load product units:', error);
    return cache[productId] || [];
  }

  const units = (data || []).map((row: any) => String(row.unit));
  saveLocalUnitOptionsCache({ ...cache, [productId]: units });
  return units;
}

export async function saveProductUnitOption(productId: string, unit: string): Promise<void> {
  const normalized = unit.trim().toUpperCase();
  if (!normalized || normalized.length > 20) throw new Error('Inserisci un\'unità valida (massimo 20 caratteri).');

  // Update local cache immediately for zero-latency UI
  const cache = getLocalUnitOptionsCache();
  const current = cache[productId] || [];
  if (!current.includes(normalized)) {
    saveLocalUnitOptionsCache({
      ...cache,
      [productId]: [...current, normalized].sort(),
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Connessione a Supabase non disponibile: impossibile condividere la nuova unità.');
  const { error } = await supabase
    .from('product_unit_options')
    .upsert({ product_id: productId, unit: normalized }, { onConflict: 'product_id,unit', ignoreDuplicates: true });
  if (error) throw error;
}
