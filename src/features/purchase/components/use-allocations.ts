import { useState } from 'react';

/** Allocation inputs for open bills, oldest due first; "Auto" fills up to `available`. */
export function useAllocations() {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const total = Object.values(amounts).reduce((s, a) => s + (Number(a) || 0), 0);
  const autoFill = (bills: { id: string; balance: string }[], available: number) => {
    let left = available;
    const next: Record<string, string> = {};
    for (const b of bills) {
      if (left <= 0) break;
      const take = Math.min(left, Number(b.balance));
      next[b.id] = String(Number(take.toFixed(4)));
      left -= take;
    }
    setAmounts(next);
  };
  /** Allocations for the API; the id key is `billId` (purchase) or `invoiceId` (sales). */
  function list(): { billId: string; amount: string }[];
  function list<K extends string>(key: K): ({ amount: string } & Record<K, string>)[];
  function list(key = 'billId') {
    return Object.entries(amounts)
      .filter(([, a]) => Number(a) > 0)
      .map(([id, amount]) => ({ [key]: id, amount }));
  }
  return { amounts, setAmounts, total, autoFill, list };
}
