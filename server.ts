import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Central Data Persistence Directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const productsFile = path.join(dataDir, 'products.json');
const ordersFile = path.join(dataDir, 'orders.json');
const configFile = path.join(dataDir, 'config.json');

// Helper functions for file storage
function readData<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeData<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Real-time Server-Sent Events (SSE) Client Registry
type SSEClient = { id: number; res: Response };
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastEvent(type: string, payload?: any) {
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch {
      // Ignore dead connection
    }
  });
}

// --------------------------------------------------------------------------
// API ROUTES
// --------------------------------------------------------------------------

// SSE Endpoint for Live Updates between Phone and Desktop
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = nextClientId++;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Central Products Catalog API
app.get('/api/products', (req: Request, res: Response) => {
  const products = readData<any[]>(productsFile, []);
  res.json({ success: true, products });
});

app.post('/api/products/bulk', (req: Request, res: Response) => {
  const { products } = req.body;
  if (!Array.isArray(products)) {
    res.status(400).json({ success: false, error: 'Array di prodotti richiesto.' });
    return;
  }

  // Save centrally on server
  writeData(productsFile, products);

  // Broadcast to all connected phones and computers
  broadcastEvent('CATALOG_UPDATED', { count: products.length });

  res.json({ success: true, count: products.length });
});

app.delete('/api/products', (req: Request, res: Response) => {
  writeData(productsFile, []);
  broadcastEvent('CATALOG_UPDATED', { count: 0 });
  res.json({ success: true, count: 0 });
});

// Central Orders API
app.get('/api/orders', (req: Request, res: Response) => {
  const orders = readData<any[]>(ordersFile, []);
  res.json({ success: true, orders });
});

app.post('/api/orders', (req: Request, res: Response) => {
  const newOrder = req.body;
  if (!newOrder || !newOrder.items) {
    res.status(400).json({ success: false, error: 'Dati ordine mancanti.' });
    return;
  }

  const orders = readData<any[]>(ordersFile, []);
  orders.unshift(newOrder);
  writeData(ordersFile, orders);

  // Instant real-time alert to office desktops
  broadcastEvent('NEW_ORDER', newOrder);

  res.json({ success: true, order: newOrder });
});

app.patch('/api/orders/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const orders = readData<any[]>(ordersFile, []);
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) {
    res.status(404).json({ success: false, error: 'Ordine non trovato' });
    return;
  }

  orders[index].status = status;
  orders[index].updated_at = new Date().toISOString();
  writeData(ordersFile, orders);

  broadcastEvent('ORDER_UPDATED', orders[index]);
  res.json({ success: true, order: orders[index] });
});

// Central Configuration & Supabase Keys
app.get('/api/config', (req: Request, res: Response) => {
  const config = readData<any>(configFile, {
    supabaseUrl: process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  });
  res.json({ success: true, config });
});

app.post('/api/config', (req: Request, res: Response) => {
  const newConfig = req.body;
  writeData(configFile, newConfig);
  res.json({ success: true, config: newConfig });
});

// --------------------------------------------------------------------------
// VITE DEV SERVER INTEGRATION & STATIC SERVING
// --------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Magazzino Edile] Central Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
