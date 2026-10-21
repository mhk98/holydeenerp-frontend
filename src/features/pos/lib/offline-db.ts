import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PosBootstrap, PosCatalog, PosCustomer, ReceiptData, SalePayload } from '../types';

/**
 * The POS device cache (IndexedDB): what it needs to keep selling without the server, and the sales
 * waiting to be synced. Everything is keyed per user so a shared till never mixes cashiers' data.
 */
export interface QueuedSale {
  clientUuid: string;
  payload: SalePayload;
  /** What the receipt printed offline showed (re-printable until synced). */
  receipt: ReceiptData;
  queuedAt: string;
  attempts: number;
  lastError: string | null;
  /** The server refused it (validation) — needs attention instead of more retries. */
  failed: boolean;
}

interface PosDB extends DBSchema {
  meta: { key: string; value: { key: string; value: unknown } };
  catalog: { key: string; value: PosCatalog };
  customers: { key: string; value: { key: string; rows: PosCustomer[] } };
  queue: { key: string; value: QueuedSale; indexes: { byQueuedAt: string } };
}

let dbPromise: Promise<IDBPDatabase<PosDB>> | null = null;

function db() {
  dbPromise ??= openDB<PosDB>('holydeen-pos', 1, {
    upgrade(database) {
      database.createObjectStore('meta', { keyPath: 'key' });
      database.createObjectStore('catalog', { keyPath: 'registerId' });
      database.createObjectStore('customers', { keyPath: 'key' });
      const queue = database.createObjectStore('queue', { keyPath: 'clientUuid' });
      queue.createIndex('byQueuedAt', 'queuedAt');
    },
  });
  return dbPromise;
}

/** IndexedDB can be missing (private mode, some embedded browsers): the POS then runs online-only. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const offlineDb = {
  getMeta: <T>(key: string) =>
    safe(async () => ((await (await db()).get('meta', key))?.value as T) ?? null, null),
  setMeta: (key: string, value: unknown) =>
    safe(async () => void (await (await db()).put('meta', { key, value })), undefined),

  bootstrap: (userId: string) => offlineDb.getMeta<PosBootstrap>(`bootstrap:${userId}`),
  saveBootstrap: (userId: string, data: PosBootstrap) => offlineDb.setMeta(`bootstrap:${userId}`, data),

  catalog: (registerId: string) =>
    safe(async () => (await (await db()).get('catalog', registerId)) ?? null, null),
  saveCatalog: (data: PosCatalog) =>
    safe(async () => void (await (await db()).put('catalog', data)), undefined),

  customers: (userId: string) =>
    safe(async () => (await (await db()).get('customers', userId))?.rows ?? [], [] as PosCustomer[]),
  saveCustomers: (userId: string, rows: PosCustomer[]) =>
    safe(async () => void (await (await db()).put('customers', { key: userId, rows })), undefined),

  queue: () => safe(async () => (await db()).getAllFromIndex('queue', 'byQueuedAt'), [] as QueuedSale[]),
  enqueue: (sale: QueuedSale) => safe(async () => void (await (await db()).put('queue', sale)), undefined),
  dequeue: (clientUuid: string) =>
    safe(async () => void (await (await db()).delete('queue', clientUuid)), undefined),
};
