import { useEffect, useRef } from 'react';
import { pingServer, usePos } from './pos-store';

/**
 * Online/offline tracking: browser events plus a ping every 20 s while offline (the browser says
 * "online" when Wi-Fi is up but the server isn't reachable). Coming back online syncs the queue.
 */
export function useConnection() {
  const online = usePos((s) => s.online);
  useEffect(() => {
    const goOnline = async () => {
      if (!(await pingServer())) return;
      usePos.getState().setOnline(true);
      await usePos.getState().sync();
      void usePos.getState().refreshCatalog();
    };
    const goOffline = () => usePos.getState().setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = window.setInterval(() => {
      const s = usePos.getState();
      if (!s.online) void goOnline();
      else if (s.queue.some((q) => !q.failed)) void s.sync();
    }, 20_000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(timer);
    };
  }, []);
  return online;
}

const editable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Keyboard-wedge barcode scanners "type" the code very fast and press Enter. Keys arriving < 40 ms
 * apart are collected; Enter after ≥ 4 such keys is a scan. Typing in a field is left alone (the
 * search box handles Enter itself).
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  });
  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (now - last > 40) buffer = '';
      last = now;
      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          handler.current(buffer);
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** F-key shortcuts of the POS screen (work even while typing in a field). */
export function useShortcuts(
  map: Partial<Record<'F2' | 'F4' | 'F8' | 'F9' | 'Escape', () => void>>,
  enabled = true,
) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const fn = ref.current[e.key as keyof typeof map];
      if (!fn) return;
      // Escape inside an open dialog closes the dialog (Radix handles it).
      if (e.key === 'Escape' && document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
