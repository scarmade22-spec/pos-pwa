import { createClient } from '@supabase/supabase-js';
import { openDB } from 'idb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// IndexedDB
export const DB_NAME = 'pos-offline';
export const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cart')) db.createObjectStore('cart', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pendingSales')) db.createObjectStore('pendingSales', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
    }
  });
}

export async function saveCart(cart) {
  const db = await getDB();
  await db.put('cart', { id: 'current', items: cart });
}

export async function loadCart() {
  const db = await getDB();
  return (await db.get('cart', 'current'))?.items || [];
}

export async function queueSale(sale) {
  const db = await getDB();
  await db.put('pendingSales', sale);
}

export async function getPendingSales() {
  const db = await getDB();
  return await db.getAll('pendingSales');
}

export async function clearPendingSale(id) {
  const db = await getDB();
  await db.delete('pendingSales', id);
}
