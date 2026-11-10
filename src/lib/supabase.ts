import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';

const STORAGE_KEY_URL = 'magazzino_supabase_url';
const STORAGE_KEY_KEY = 'magazzino_supabase_anon_key';

export function getStoredSupabaseConfig(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  try {
    url = localStorage.getItem(STORAGE_KEY_URL) || '';
    anonKey = localStorage.getItem(STORAGE_KEY_KEY) || '';
  } catch {
    // Ignore storage issues
  }

  // Fallback to Vite environment variables if available
  if (!url && typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    url = import.meta.env.VITE_SUPABASE_URL;
  }
  if (!anonKey && typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isConnected: false,
  };
}

// Automatically sync with server config on startup
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then(res => res.json())
    .then(data => {
      if (data?.config?.supabaseUrl && data?.config?.supabaseAnonKey) {
        const current = getStoredSupabaseConfig();
        if (!current.url || !current.anonKey) {
          saveSupabaseConfig(data.config.supabaseUrl, data.config.supabaseAnonKey, false);
        }
      }
    })
    .catch(() => {
      // Ignore background config fetch error
    });
}

export function saveSupabaseConfig(url: string, anonKey: string, syncToServer = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    cachedClient = null; // Reset client
  } catch (err) {
    console.error('Failed to save Supabase config in localStorage:', err);
  }

  if (syncToServer && typeof window !== 'undefined') {
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseUrl: url.trim(), supabaseAnonKey: anonKey.trim() }),
    }).catch(err => {
      console.warn('Failed to sync config to server:', err);
    });
  }
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getStoredSupabaseConfig();
  if (config.url && config.anonKey) {
    try {
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      return cachedClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, error: 'URL o Chiave Anon mancanti.' };
    }
    const testClient = createClient(url.trim(), anonKey.trim());
    const { error } = await testClient.from('orders').select('id').limit(1);

    if (error && error.code !== 'PGRST116' && !error.message.includes('0 rows')) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connessione fallita';
    return { success: false, error: message };
  }
}
