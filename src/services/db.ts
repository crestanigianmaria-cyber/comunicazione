import { CompanySettings, Order, OrderItem, OrderStatus, Product, ExcelImportRow, UserRole } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialCatalog';
import { getSupabaseClient } from '../lib/supabase';
import { playOrderNotificationChime } from '../lib/audio';
import { idbGetAllProducts, idbSaveAllProducts, idbClearProducts, idbGetAllOrders, idbSaveAllOrders } from './indexedDb';

const STORAGE_KEY_PRODUCTS = 'magazzino_products_v1';
const STORAGE_KEY_ORDERS = 'magazzino_orders_v1';
const STORAGE_KEY_ORDER_SEQ = 'magazzino_order_sequence_v1';
const STORAGE_KEY_PENDING = 'magazzino_pending_orders_v1';
const STORAGE_KEY_SETTINGS = 'magazzino_company_settings_v1';

// Clear legacy bloated localStorage products entry to eliminate quota errors
try {
  localStorage.removeItem(STORAGE_KEY_PRODUCTS);
} catch {
  // Ignore
}

// In-memory cache for ultra-fast, zero-latency synchronous access during typing/searching
let cachedProducts: Product[] | null = null;
let cachedOrders: Order[] | null = null;

// Cross-tab / cross-window real-time synchronization channel
const broadcastChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('magazzino_realtime_sync')
  : null;

type OrderListener = (orders: Order[], newOrderEvent?: Order) => void;
type CatalogListener = (products: Product[]) => void;

const orderListeners = new Set<OrderListener>();
const catalogListeners = new Set<CatalogListener>();

// Default company settings
const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'SAGGIN',
  legalName: 'Saggin Guglielmo - Materiali Edili',
  address: 'Sede e Magazzino Forniture Edili',
  vatNumber: 'IT 01234567890',
  phone: 'Tel. Magazzino / Ufficio',
  email: 'ordini@saggin.it',
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
    } else if (type === 'CATALOG_UPDATED') {
      const prods = await idbGetAllProducts();
      cachedProducts = prods;
      catalogListeners.forEach(listener => listener(prods));
    }
  };
}

// Initialize Server-Sent Events (SSE) for Real-Time Cross-Device Communication
if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
  let evtSource: EventSource | null = null;
  const connectSSE = () => {
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

// --------------------------------------------------------------------------
// CATALOG OPERATIONS (Backed by IndexedDB with in-memory caching)
// --------------------------------------------------------------------------

export async function fetchProducts(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh && cachedProducts !== null) {
    return cachedProducts;
  }

  // When Supabase is configured, it is the source of truth.
  // Read in pages because Supabase commonly limits each response to 1,000 rows.
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const PAGE_SIZE = 1000;
      const allProducts: Product[] = [];
      let lastCode: string | null = null;
      let expectedCount: number | null = null;

      // Keyset pagination is more reliable than large numeric offsets on PostgREST.
      // Product codes are unique, so each page starts strictly after the previous one.
      for (;;) {
        const response = lastCode
          ? await supabase
              .from('products')
              .select('*', { count: 'exact' })
              .gt('code', lastCode)
              .order('code', { ascending: true })
              .limit(PAGE_SIZE)
          : await supabase
              .from('products')
              .select('*', { count: 'exact' })
              .order('code', { ascending: true })
              .limit(PAGE_SIZE);

        const { data, error, count } = response;
        if (error) throw error;
        if (expectedCount === null && typeof count === 'number') {
          expectedCount = count;
        }

        const page = (data || []) as Product[];
        if (page.length === 0) break;

        allProducts.push(...page);
        lastCode = page[page.length - 1].code;

        if (page.length < PAGE_SIZE) break;
      }

      if (expectedCount !== null && allProducts.length !== expectedCount) {
        throw new Error(
          `Catalogo incompleto: scaricati ${allProducts.length} articoli su ${expectedCount} presenti in Supabase.`
        );
      }

      cachedProducts = allProducts;
      await idbSaveAllProducts(allProducts);
      return allProducts;
    } catch (err) {
      console.warn('Supabase fetch products error:', err);
      // Do not show demo products when a Supabase project is configured.
      const idbProducts = await idbGetAllProducts();
      cachedProducts = idbProducts || [];
      return cachedProducts;
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
  items: {
    product: Product;
    quantity: number;
  }[];
}): Promise<Order> {
  if (!orderInput.items || orderInput.items.length === 0) {
    throw new Error('Impossibile inviare un ordine senza articoli.');
  }

  // Supabase schema uses UUID primary keys for orders and order_items.
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const orderNumber = getNextOrderNumber();

  const formattedItems: OrderItem[] = orderInput.items.map((item, index) => ({
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: item.product.id,
    product_code_snapshot: item.product.code,
    product_description_snapshot: item.product.description,
    unit_of_measure_snapshot: item.product.unit_of_measure,
    alternative_code_snapshot: item.product.alternative_code || null,
    quantity: Number(item.quantity) || 1,
  }));

  const newOrder: Order = {
    id: orderId,
    order_number: orderNumber,
    customer_reference: orderInput.customer_reference?.trim() || null,
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

  // 4. Send to Central Server so all desktop computers and smartphones receive it immediately
  if (typeof window !== 'undefined') {
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
  const supabase = getSupabaseClient();

  if (isOnline && supabase) {
    try {
      const { data: dbOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          id: newOrder.id,
          // The database trigger assigns a globally unique order number.
          order_number: '',
          customer_reference: newOrder.customer_reference,
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

  // Update on central server
  if (typeof window !== 'undefined') {
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(err => {
      console.warn('Failed to update status on central server:', err);
    });
  }

  // Update Supabase if available
  const supabase = getSupabaseClient();
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

export async function syncPendingOrders(): Promise<{ synced: number; remaining: number }> {
  const pending = getLocalPendingOrders();
  if (pending.length === 0) return { synced: 0, remaining: 0 };

  const supabase = getSupabaseClient();
  if (!supabase) return { synced: 0, remaining: pending.length };

  let synced = 0;
  const stillPending: Order[] = [];

  for (const order of pending) {
    try {
      // Retry with INSERT ... ON CONFLICT DO NOTHING. This is deliberately
      // idempotent and does not require UPDATE policies for warehouse users.
      const { error: ordErr } = await supabase.from('orders').upsert({
        id: order.id,
        order_number: order.order_number,
        customer_reference: order.customer_reference,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }, { onConflict: 'id', ignoreDuplicates: true });

      if (ordErr) {
        console.warn('[Order sync] Failed to save order:', order.id, ordErr);
        stillPending.push(order);
        continue;
      }

      const dbItems = order.items.map(it => ({
        id: it.id,
        order_id: order.id,
        product_id: it.product_id,
        product_code_snapshot: it.product_code_snapshot,
        product_description_snapshot: it.product_description_snapshot,
        unit_of_measure_snapshot: it.unit_of_measure_snapshot,
        alternative_code_snapshot: it.alternative_code_snapshot,
        quantity: it.quantity,
        created_at: order.created_at,
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .upsert(dbItems, { onConflict: 'id', ignoreDuplicates: true });

      if (itemsErr) {
        console.warn('[Order sync] Failed to save order items:', order.id, itemsErr);
        stillPending.push(order);
        continue;
      }

      synced++;
    } catch {
      stillPending.push(order);
    }
  }

  saveLocalPendingOrders(stillPending);
  return { synced, remaining: stillPending.length };
}

// --------------------------------------------------------------------------
// SUBSCRIPTIONS (LOCAL + SUPABASE REALTIME)
// --------------------------------------------------------------------------

export function subscribeToOrders(callback: OrderListener): () => void {
  orderListeners.add(callback);

  // Setup Supabase Realtime subscription if client available
  const supabase = getSupabaseClient();
  let supabaseChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

  if (supabase) {
    try {
      supabaseChannel = supabase
        .channel('realtime_orders_sub')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          async (payload) => {
            console.log('[Realtime] Orders change received:', payload);
            const freshOrders = await fetchOrders(true);
            callback(freshOrders);
            if (payload.eventType === 'INSERT') {
              playOrderNotificationChime();
            }
          }
        )
        // Order headers and their items are inserted in two requests. Listen
        // to item changes too, so the office refreshes after the items arrive.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'order_items' },
          async (payload) => {
            console.log('[Realtime] Order items change received:', payload);
            const freshOrders = await fetchOrders(true);
            callback(freshOrders);
          }
        )
        .subscribe((status, err) => {
          console.log('[Realtime] Orders channel status:', status, err || '');
        });
    } catch (err) {
      console.warn('Failed to subscribe to Supabase Realtime channel:', err);
    }
  }

  return () => {
    orderListeners.delete(callback);
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
