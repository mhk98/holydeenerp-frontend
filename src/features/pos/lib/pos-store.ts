import { create } from 'zustand';
import { api } from '@/lib/api';
import { posApi } from '../api/pos-api';
import type { PosBootstrap, PosCatalog, PosCustomer, PosSession, ReceiptData, SalePayload } from '../types';
import { offlineDb, type QueuedSale } from './offline-db';

const REGISTER_KEY = 'pos:register';
const readRegister = () => {
  try {
    return localStorage.getItem(REGISTER_KEY);
  } catch {
    return null;
  }
};
const writeRegister = (id: string | null) => {
  try {
    if (id) localStorage.setItem(REGISTER_KEY, id);
    else localStorage.removeItem(REGISTER_KEY);
  } catch {
    // Storage blocked: the register is asked for again next time.
  }
};

/** A request failed without reaching the server (vs. the server refusing it). */
export const isNetworkError = (err: unknown) => (err as { status?: number })?.status === 0;

interface PosState {
  userId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  boot: PosBootstrap | null;
  session: PosSession | null;
  catalog: PosCatalog | null;
  customers: PosCustomer[];
  online: boolean;
  queue: QueuedSale[];
  syncing: boolean;
  lastReceipt: ReceiptData | null;
  init: (userId: string) => Promise<void>;
  selectRegister: (registerId: string | null) => Promise<void>;
  refreshCatalog: () => Promise<void>;
  setSession: (session: PosSession | null) => void;
  setOnline: (online: boolean) => void;
  addCustomer: (customer: PosCustomer) => void;
  setLastReceipt: (receipt: ReceiptData | null) => void;
  /** Receipt number for a sale made offline: OFF-<register>-<yymmdd>-<seq>. */
  nextOfflineNumber: () => Promise<string>;
  /** Lower the cached stock after a sale (display only; the server holds the truth). */
  takeStock: (lines: { key: string; baseQuantity: string }[]) => void;
  enqueue: (payload: SalePayload, receipt: ReceiptData) => Promise<void>;
  loadQueue: () => Promise<void>;
  sync: () => Promise<{ synced: number; failed: number } | null>;
  discard: (clientUuid: string) => Promise<void>;
}

export const usePos = create<PosState>()((set, get) => ({
  userId: null,
  status: 'idle',
  error: null,
  boot: null,
  session: null,
  catalog: null,
  customers: [],
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  queue: [],
  syncing: false,
  lastReceipt: null,

  /** Start-up: the server when reachable, else the last copy saved on this device. */
  init: async (userId) => {
    set({ userId, status: 'loading', error: null });
    await get().loadQueue();
    const registerId = readRegister();
    try {
      const boot = await posApi.bootstrap(registerId);
      await offlineDb.saveBootstrap(userId, boot);
      set({ boot, session: boot.session, online: true });
      if (registerId && !boot.register) writeRegister(null);
    } catch (err) {
      const cached = await offlineDb.bootstrap(userId);
      if (!isNetworkError(err) || !cached) {
        set({ status: 'error', error: (err as Error).message });
        return;
      }
      set({ boot: cached, session: cached.session, online: false });
    }
    const boot = get().boot!;
    const [catalog, customers, lastReceipt] = await Promise.all([
      boot.register ? offlineDb.catalog(boot.register.id) : null,
      offlineDb.customers(userId),
      boot.register ? offlineDb.getMeta<ReceiptData>(`lastReceipt:${boot.register.id}`) : null,
    ]);
    set({ catalog, customers, lastReceipt, status: 'ready' });
    if (get().online) {
      void get().refreshCatalog();
      void get().sync();
    }
  },

  selectRegister: async (registerId) => {
    writeRegister(registerId);
    const { userId } = get();
    if (userId) await get().init(userId);
  },

  refreshCatalog: async () => {
    const { boot, userId } = get();
    if (!boot?.register || !userId) return;
    try {
      const [catalog, customers] = await Promise.all([posApi.catalog(boot.register.id), posApi.customers()]);
      set({ catalog, customers, online: true });
      await Promise.all([offlineDb.saveCatalog(catalog), offlineDb.saveCustomers(userId, customers)]);
    } catch (err) {
      if (isNetworkError(err)) set({ online: false });
    }
  },

  setSession: (session) => {
    set((s) => ({ session, boot: s.boot ? { ...s.boot, session } : s.boot }));
    const { boot, userId } = get();
    if (boot && userId) void offlineDb.saveBootstrap(userId, boot);
  },
  setOnline: (online) => set({ online }),
  addCustomer: (customer) => {
    const customers = [...get().customers.filter((c) => c.id !== customer.id), customer];
    set({ customers });
    const { userId } = get();
    if (userId) void offlineDb.saveCustomers(userId, customers);
  },
  setLastReceipt: (lastReceipt) => {
    set({ lastReceipt });
    const registerId = get().boot?.register?.id;
    if (registerId) void offlineDb.setMeta(`lastReceipt:${registerId}`, lastReceipt);
  },
  nextOfflineNumber: async () => {
    const register = get().boot?.register;
    const key = `offlineSeq:${register?.id}`;
    const next = ((await offlineDb.getMeta<number>(key)) ?? 0) + 1;
    await offlineDb.setMeta(key, next);
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `OFF-${register?.code ?? 'POS'}-${stamp}-${String(next).padStart(4, '0')}`;
  },
  takeStock: (lines) =>
    set((s) => {
      if (!s.catalog) return {};
      const used = new Map<string, number>();
      for (const l of lines) used.set(l.key, (used.get(l.key) ?? 0) + Number(l.baseQuantity));
      return {
        catalog: {
          ...s.catalog,
          items: s.catalog.items.map((i) =>
            used.has(i.key) ? { ...i, stock: String(Number(i.stock) - used.get(i.key)!) } : i,
          ),
        },
      };
    }),

  enqueue: async (payload, receipt) => {
    await offlineDb.enqueue({
      clientUuid: payload.clientUuid,
      payload,
      receipt,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      failed: false,
    });
    await get().loadQueue();
  },
  loadQueue: async () => set({ queue: await offlineDb.queue() }),

  /** Send queued sales (oldest first, in batches). Refused ones stay, marked failed, for review. */
  sync: async () => {
    if (get().syncing) return null;
    const pending = (await offlineDb.queue()).filter((q) => !q.failed);
    if (!pending.length) {
      await get().loadQueue();
      return { synced: 0, failed: 0 };
    }
    set({ syncing: true });
    let synced = 0;
    let failed = 0;
    try {
      for (let i = 0; i < pending.length; i += 25) {
        const batch = pending.slice(i, i + 25);
        const res = await posApi.sync(batch.map((q) => q.payload));
        for (const r of res.results) {
          const entry = batch.find((q) => q.clientUuid === r.clientUuid);
          if (!entry) continue;
          if (r.ok) {
            synced += 1;
            await offlineDb.dequeue(r.clientUuid);
          } else {
            failed += 1;
            await offlineDb.enqueue({
              ...entry,
              attempts: entry.attempts + 1,
              lastError: r.error ?? null,
              failed: r.retry === false,
            });
          }
        }
      }
      set({ online: true });
      if (synced) void get().refreshCatalog();
    } catch (err) {
      if (isNetworkError(err)) set({ online: false });
    } finally {
      set({ syncing: false });
      await get().loadQueue();
    }
    return { synced, failed };
  },
  discard: async (clientUuid) => {
    await offlineDb.dequeue(clientUuid);
    await get().loadQueue();
  },
}));

/** Cheap reachability check used while offline. */
export async function pingServer() {
  try {
    await api.get('/health', { timeout: 5000, skipAuthRefresh: true });
    return true;
  } catch (err) {
    return Boolean((err as { response?: unknown }).response);
  }
}
