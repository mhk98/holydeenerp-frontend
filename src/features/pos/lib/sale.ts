import Decimal from 'decimal.js';
import type {
  CartLine,
  PaymentLine,
  PaymentMethodOption,
  PosBootstrap,
  PosCustomer,
  ReceiptData,
  SalePayload,
} from '../types';
import { priceCart, type CartTotals, type PricedLine } from './pricing';

export const uuid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export function priceLines(
  lines: CartLine[],
  header: { discountType: 'percent' | 'amount'; discountValue: string },
  boot: PosBootstrap,
) {
  return priceCart(
    lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountType: l.discountType,
      discountValue: l.discountValue,
      taxGroupId: l.item.taxGroupId,
      priceIncludesTax: l.item.priceIncludesTax,
    })),
    header,
    boot.settings,
    boot.taxGroups,
  );
}

export function buildPayload(input: {
  lines: CartLine[];
  customer: PosCustomer | null;
  discountType: 'percent' | 'amount';
  discountValue: string;
  notes: string;
  payments: PaymentLine[];
  credit: { returnId: string; amount: string } | null;
  registerId: string;
  sessionId: string;
}): SalePayload {
  return {
    clientUuid: uuid(),
    registerId: input.registerId,
    sessionId: input.sessionId,
    customerId: input.customer?.id ?? null,
    discountType: input.discountType,
    discountValue: input.discountValue || '0',
    notes: input.notes.trim() || null,
    items: input.lines.map((l) => ({
      productId: l.item.productId,
      variantId: l.item.variantId,
      unitId: l.unitId,
      quantity: l.quantity,
      unitPrice: new Decimal(l.unitPrice || 0).toFixed(4),
      discountType: l.discountType,
      discountValue: l.discountValue || '0',
      taxGroupId: l.item.taxGroupId,
      priceIncludesTax: l.item.priceIncludesTax,
      ...(l.serialNumbers.length && { serialNumbers: l.serialNumbers }),
      notes: l.notes.trim() || null,
    })),
    payments: input.payments
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        paymentMethodId: p.paymentMethodId,
        amount: p.amount,
        reference: p.reference.trim() || null,
      })),
    credits: input.credit ? [input.credit] : [],
  };
}

/** The receipt of a sale made offline, built from what the device knows. */
export function localReceipt(input: {
  payload: SalePayload;
  lines: CartLine[];
  priced: PricedLine[];
  totals: CartTotals;
  customer: PosCustomer | null;
  methods: PaymentMethodOption[];
  company: ReceiptData['company'];
  footer: string;
  number: string;
}): ReceiptData {
  const { totals } = input;
  const paid = input.payload.payments.reduce((s, p) => s.plus(p.amount), new Decimal(0));
  const credits = input.payload.credits.reduce((s, c) => s.plus(c.amount), new Decimal(0));
  const tendered = paid.plus(credits);
  const change = Decimal.max(tendered.minus(totals.total), 0);
  const now = new Date().toISOString();
  return {
    invoice: {
      id: '',
      number: '',
      offlineNumber: input.number,
      channel: 'pos',
      postedAt: now,
      createdAt: now,
      customer: input.customer
        ? {
            id: input.customer.id,
            code: input.customer.code,
            name: input.customer.name,
            email: null,
            phone: null,
          }
        : { id: '', code: '', name: '', email: null, phone: null },
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      roundOff: totals.roundOff,
      total: totals.total,
      tendered: tendered.toFixed(4),
      changeAmount: change.toFixed(4),
      stockWarning: false,
      items: input.lines.map((l, i) => {
        const unit = l.item.units.find((u) => u.unitId === l.unitId);
        return {
          id: l.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: input.priced[i].discountAmount,
          lineTotal: input.priced[i].lineTotal,
          serialNumbers: l.serialNumbers,
          product: { name: l.item.name, sku: l.item.sku, baseUnit: l.item.baseUnit },
          variant: l.item.variantId ? { name: l.item.variantName, sku: l.item.sku } : null,
          unit: unit ? { code: unit.code } : null,
        };
      }),
    } as unknown as ReceiptData['invoice'],
    payments: [
      ...input.payload.payments.map((p) => {
        const m = input.methods.find((x) => x.id === p.paymentMethodId);
        return { method: m?.name ?? '', type: m?.type ?? 'other', amount: p.amount, reference: p.reference };
      }),
      ...input.payload.credits.map((c) => ({
        method: 'Credit',
        type: 'credit',
        amount: c.amount,
        reference: null,
      })),
    ],
    paid: tendered.minus(change).toFixed(4),
    company: input.company,
    amountInWords: { en: '', bn: '' },
    footer: input.footer,
  };
}
