import { CompanySettings, Order, OrderItem, OrderStatus, Product, ExcelImportRow } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialCatalog';
import { getSupabaseClient } from '../lib/supabase';
import { playOrderNotificationChime } from '../lib/audio';
import { idbGetAllProducts, idbSaveAllProducts, idbClearProducts, idbGetAllOrders, idbSaveAllOrders } from './indexedDb';

const STORAGE_KEY_PRODUCTS = 'magazzino_products_v1';
const STORAGE_KEY_ORDERS = 'magazzino_orders_v1';
const STORAGE_KEY_ORDER_SEQ = 'magazzino_order_sequence_v1';
const STORAGE_KEY_PENDING = 'magazzino_pending_orders_v1';
const STORAGE_KEY_SETTINGS = 'magazzino_company_settings_v1';
const STORAGE_KEY_PASSWORDS = 'magazzino_role_passwords_v1';

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
  companyName: 'EDILMAGAZZINO SRL',
  legalName: 'EdilMagazzino Forniture & Materiali Edili S.r.l.',
  address: 'Via dell’Edilizia 42, 20100 Milano (MI)',
  vatNumber: 'IT 01234567890',
  phone: '+39 02 9876543',
  email: 'ordini@edilmagazzino.it',
  notes: 'Materiale caricato su automezzo del cliente. Documento di trasporto interno per emissione bolla / fattura.',
};

// Default passwords
const DEFAULT_PASSWORDS = {
  magazzino: '1234',
  ufficio: 'ufficio2026',
};

// Initialize BroadcastChannel listener
if (broadcastChannel) {
  broadcastChannel.onmessage = async (event) => {
    const { type, payload } = event.data || {};
    if (type === 'NEW_ORDER') {
      const orders = getLocalOrders();
      orderListeners.forEach(listener => listener(orders, payload));
      // Play chime in other tabs if office
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

export async function fetchProducts(): Promise<Product[]> {
  if (cachedProducts !== null && cachedProducts.length > 0) {
    return cachedProducts;
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('code', { ascending: true });

      if (!error && data && data.length > 0) {
        cachedProducts = data;
        await idbSaveAllProducts(data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetch products error, using local catalog:', err);
    }
  }

  // Load from IndexedDB
  const idbProducts = await idbGetAllProducts();
  if (idbProducts && idbProducts.length > 0) {
    cachedProducts = idbProducts;
    return idbProducts;
  }

  // First time launch fallback
  cachedProducts = INITIAL_PRODUCTS;
  await idbSaveAllProducts(INITIAL_PRODUCTS);
  return INITIAL_PRODUCTS;
}

export async function importExcelProductsToDb(
  parsedRows: ExcelImportRow[]
): Promise<{ added: number; updated: number; total: number }> {
  // Ensure we have current catalog loaded
  const currentProducts = await fetchProducts();
  const productMap = new Map<string, Product>();

  for (const p of currentProducts) {
    productMap.set(p.code, p);
  }

  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  const toUpsertSupabase: Partial<Product>[] = [];

  for (const row of parsedRows) {
    if (!row.code || !row.description) continue;

    const existing = productMap.get(row.code);
    if (existing) {
      // Update description, UM (if provided), alternative_code
      const updatedItem: Product = {
        ...existing,
        description: row.description,
        unit_of_measure: row.unit_of_measure || existing.unit_of_measure,
        alternative_code: row.alternative_code !== null ? row.alternative_code : existing.alternative_code,
        updated_at: now,
      };
      productMap.set(row.code, updatedItem);
      toUpsertSupabase.push(updatedItem);
      updated++;
    } else {
      const newItem: Product = {
        id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        code: row.code,
        description: row.description,
        unit_of_measure: row.unit_of_measure || 'PZ',
        alternative_code: row.alternative_code || null,
        created_at: now,
        updated_at: now,
      };
      productMap.set(row.code, newItem);
      toUpsertSupabase.push(newItem);
      added++;
    }
  }

  const newCatalog = Array.from(productMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );

  // Save to IndexedDB (unlimited quota, supports 100,000+ items)
  cachedProducts = newCatalog;
  await idbSaveAllProducts(newCatalog);

  // Notify listeners and other open tabs
  catalogListeners.forEach(listener => listener(newCatalog));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'CATALOG_UPDATED' });
  }

  // Sync to Supabase in batches of 250 in background if configured
  const supabase = getSupabaseClient();
  if (supabase && toUpsertSupabase.length > 0) {
    try {
      const BATCH_SIZE = 250;
      for (let i = 0; i < toUpsertSupabase.length; i += BATCH_SIZE) {
        const batch = toUpsertSupabase.slice(i, i + BATCH_SIZE);
        await supabase.from('products').upsert(batch, { onConflict: 'code' });
      }
    } catch (err) {
      console.warn('Background Supabase upsert error:', err);
    }
  }

  return { added, updated, total: newCatalog.length };
}

export async function clearAllProducts(): Promise<void> {
  cachedProducts = [];
  await idbClearProducts();
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

export async function fetchOrders(): Promise<Order[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: false });

      if (!ordersErr && ordersData) {
        saveLocalOrders(ordersData);
        return ordersData;
      }
    } catch (err) {
      console.warn('Supabase fetch orders error, fallback to local:', err);
    }
  }

  if (cachedOrders === null) {
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

  const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  const now = new Date().toISOString();
  const orderNumber = getNextOrderNumber();

  const formattedItems: OrderItem[] = orderInput.items.map((item, index) => ({
    id: `${orderId}-item-${index + 1}`,
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

  // 4. If online and Supabase is configured, push to Supabase
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const supabase = getSupabaseClient();

  if (isOnline && supabase) {
    try {
      const { data: dbOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          id: newOrder.id,
          order_number: newOrder.order_number,
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
          console.warn('Supabase items insert error:', itemsErr);
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
      const { error: ordErr } = await supabase.from('orders').upsert({
        id: order.id,
        order_number: order.order_number,
        customer_reference: order.customer_reference,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
      });

      if (ordErr) {
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

      await supabase.from('order_items').upsert(dbItems);
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
            console.log('Supabase Realtime orders update received:', payload);
            const freshOrders = await fetchOrders();
            callback(freshOrders);
            if (payload.eventType === 'INSERT') {
              playOrderNotificationChime();
            }
          }
        )
        .subscribe();
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

export function verifyRoleLogin(role: 'magazzino' | 'ufficio', inputSecret: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PASSWORDS);
    const passwords = raw ? JSON.parse(raw) : DEFAULT_PASSWORDS;
    const required = passwords[role] || DEFAULT_PASSWORDS[role];
    return inputSecret.trim() === required;
  } catch {
    return inputSecret.trim() === DEFAULT_PASSWORDS[role];
  }
}

export function changeRolePassword(role: 'magazzino' | 'ufficio', newPass: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PASSWORDS);
    const passwords = raw ? JSON.parse(raw) : { ...DEFAULT_PASSWORDS };
    passwords[role] = newPass.trim();
    localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(passwords));
  } catch (err) {
    console.error('Error changing password:', err);
  }
}
