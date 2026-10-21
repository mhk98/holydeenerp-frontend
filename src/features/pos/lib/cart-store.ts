import { create } from 'zustand';
import Decimal from 'decimal.js';
import type { CartLine, CatalogItem, HeldCart, PosCustomer } from '../types';

/** Price of one `unitId` of an item: the pack's own price, else base price × factor. */
export function unitPrice(item: CatalogItem, unitId: string) {
  const unit = item.units.find((u) => u.unitId === unitId) ?? item.units[0];
  if (unit?.salePrice != null) return new Decimal(unit.salePrice).toFixed(4);
  return new Decimal(item.price || 0).times(unit?.factor ?? 1).toFixed(4);
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const clean = (v: Decimal) => v.toDecimalPlaces(4).toString();

interface CartState {
  lines: CartLine[];
  customer: PosCustomer | null;
  discountType: 'percent' | 'amount';
  discountValue: string;
  notes: string;
  /** Store credit from a return, spent on this sale (exchange). */
  credit: { returnId: string; number: string; amount: string } | null;
  selectedId: string | null;
  add: (item: CatalogItem, unitId?: string | null, quantity?: string) => void;
  setQuantity: (id: string, quantity: string) => void;
  bump: (id: string, delta: number) => void;
  update: (id: string, patch: Partial<Omit<CartLine, 'id' | 'item'>>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  setCustomer: (customer: PosCustomer | null) => void;
  setDiscount: (type: 'percent' | 'amount', value: string) => void;
  setNotes: (notes: string) => void;
  setCredit: (credit: CartState['credit']) => void;
  load: (cart: HeldCart) => void;
  snapshot: () => HeldCart;
  clear: () => void;
}

const empty = {
  lines: [] as CartLine[],
  customer: null,
  discountType: 'percent' as const,
  discountValue: '',
  notes: '',
  credit: null,
  selectedId: null,
};

export const useCart = create<CartState>()((set, get) => ({
  ...empty,
  add: (item, unitId, quantity = '1') =>
    set((s) => {
      const unit = unitId ?? item.baseUnit.id;
      // Scanning the same plain item again adds to its line; serial items always get a new line.
      const existing = item.trackSerial
        ? undefined
        : s.lines.find((l) => l.item.key === item.key && l.unitId === unit && !l.notes);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.id === existing.id ? { ...l, quantity: clean(new Decimal(l.quantity).plus(quantity)) } : l,
          ),
          selectedId: existing.id,
        };
      }
      const line: CartLine = {
        id: newId(),
        item,
        unitId: unit,
        quantity,
        unitPrice: unitPrice(item, unit),
        discountType: 'percent',
        discountValue: '',
        notes: '',
        serialNumbers: [],
      };
      return { lines: [...s.lines, line], selectedId: line.id };
    }),
  setQuantity: (id, quantity) =>
    set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, quantity } : l)) })),
  bump: (id, delta) =>
    set((s) => ({
      lines: s.lines.flatMap((l) => {
        if (l.id !== id) return [l];
        const next = new Decimal(l.quantity || 0).plus(delta);
        return next.lte(0) ? [] : [{ ...l, quantity: clean(next) }];
      }),
    })),
  update: (id, patch) =>
    set((s) => ({
      lines: s.lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        if (patch.unitId && patch.unitId !== l.unitId && patch.unitPrice === undefined)
          next.unitPrice = unitPrice(l.item, patch.unitId);
        return next;
      }),
    })),
  remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id), selectedId: null })),
  select: (selectedId) => set({ selectedId }),
  setCustomer: (customer) => set({ customer }),
  setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),
  setNotes: (notes) => set({ notes }),
  setCredit: (credit) => set({ credit }),
  load: (cart) =>
    set({
      ...empty,
      lines: cart.lines,
      customer: cart.customer,
      discountType: cart.discountType,
      discountValue: cart.discountValue,
      notes: cart.notes,
    }),
  snapshot: () => {
    const { lines, customer, discountType, discountValue, notes } = get();
    return { lines, customer, discountType, discountValue, notes };
  },
  clear: () => set(empty),
}));
