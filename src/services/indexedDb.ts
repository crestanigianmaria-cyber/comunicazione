import { Product, Order } from '../types';

const DB_NAME = 'MagazzinoEdileWMS_DB';
const DB_VERSION = 1;

const STORE_PRODUCTS = 'products';
const STORE_ORDERS = 'orders';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non è supportato in questo browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Products Store
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const prodStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'code' });
        prodStore.createIndex('code', 'code', { unique: true });
        prodStore.createIndex('description', 'description', { unique: false });
        prodStore.createIndex('alternative_code', 'alternative_code', { unique: false });
      }

      // Orders Store
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const orderStore = db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
        orderStore.createIndex('order_number', 'order_number', { unique: true });
        orderStore.createIndex('created_at', 'created_at', { unique: false });
        orderStore.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Impossibile aprire IndexedDB.'));
    };
  });

  return dbPromise;
}

// --------------------------------------------------------------------------
// PRODUCTS (Tens of thousands of catalog items without quota limits)
// --------------------------------------------------------------------------

export async function idbGetAllProducts(): Promise<Product[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('IDB idbGetAllProducts error:', err);
    return [];
  }
}

export async function idbSaveAllProducts(products: Product[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);

    // Clear existing before bulk save to keep in sync
    store.clear();

    for (const item of products) {
      store.put(item);
    }

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error);
    };
  });
}

export async function idbClearProducts(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --------------------------------------------------------------------------
// ORDERS
// --------------------------------------------------------------------------

export async function idbGetAllOrders(): Promise<Order[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ORDERS, 'readonly');
      const store = tx.objectStore(STORE_ORDERS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('IDB idbGetAllOrders error:', err);
    return [];
  }
}

export async function idbSaveOrder(order: Order): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_ORDERS);
    const request = store.put(order);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function idbSaveAllOrders(orders: Order[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_ORDERS);

    store.clear();
    for (const order of orders) {
      store.put(order);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
