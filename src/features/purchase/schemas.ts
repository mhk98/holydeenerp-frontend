import { z } from 'zod';
import { v } from '@/lib/form';
import type { ItemUnit, PurchaseLine, StockItem } from '@/types';
import { nullIfEmpty } from './lib';

const decimal = (scale = 4) =>
  z
    .string()
    .trim()
    .refine((s) => !s || new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`).test(s), 'validation.decimal');

/**
 * One line of a purchase document. Item details are kept in the form so lines render without
 * re-fetching; only the editable fields and the links to source lines are sent to the API.
 */
export const purchaseLineSchema = z
  .object({
    key: z.string(),
    productId: z.string(),
    variantId: z.string().nullable(),
    name: z.string(),
    variantName: z.string().nullable(),
    sku: z.string(),
    baseUnitId: z.string(),
    baseUnitCode: z.string(),
    units: z.array(z.object({ unitId: z.string(), code: z.string(), name: z.string(), factor: z.string() })),
    lotTracked: z.boolean(),
    trackSerial: z.boolean(),
    trackExpiry: z.boolean(),
    unitId: z.string(),
    quantity: v.decimal({ scale: 4 }),
    unitPrice: decimal(),
    discountPercent: decimal().refine((s) => !s || Number(s) <= 100, 'validation.tooLarge'),
    taxGroupId: z.string(),
    notes: z.string().max(500, 'validation.tooLong'),
    requisitionItemId: z.string().nullable(),
    orderItemId: z.string().nullable(),
    receiptItemId: z.string().nullable(),
    billItemId: z.string().nullable(),
    batchId: z.string(),
    batchNo: z.string().max(60, 'validation.tooLong'),
    expiryDate: z.string(),
    serialNumbers: z.array(z.string()),
    /** Price comes from the source line (e.g. a GRN against a PO). */
    priceLocked: z.boolean(),
    /** Context shown under the item, e.g. "Ordered 10 · received 6". */
    info: z.string(),
  })
  .superRefine((l, ctx) => {
    if (l.trackSerial && l.serialNumbers.length) {
      const factor = Number(l.units.find((u) => u.unitId === l.unitId)?.factor ?? 1);
      if (l.serialNumbers.length !== Number(l.quantity) * factor) {
        ctx.addIssue({
          code: 'custom',
          path: ['serialNumbers'],
          message: 'inventory.validation.serialCount',
        });
      }
    }
  });
export type PurchaseLineValues = z.infer<typeof purchaseLineSchema>;

const blank = {
  discountPercent: '',
  taxGroupId: '',
  notes: '',
  requisitionItemId: null,
  orderItemId: null,
  receiptItemId: null,
  billItemId: null,
  batchId: '',
  batchNo: '',
  expiryDate: '',
  serialNumbers: [],
  priceLocked: false,
  info: '',
};

/** New line for an item picked in the item picker (price = purchase price × unit factor). */
export function lineFromItem(item: StockItem): PurchaseLineValues {
  const unitId = item.matchedUnitId ?? item.baseUnit.id;
  const factor = Number(item.units.find((u) => u.unitId === unitId)?.factor ?? 1);
  return {
    ...blank,
    key: `${item.key}:${Date.now()}`,
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    variantName: item.variantName,
    sku: item.sku,
    baseUnitId: item.baseUnit.id,
    baseUnitCode: item.baseUnit.code,
    units: item.units as ItemUnit[],
    lotTracked: item.lotTracked,
    trackSerial: item.trackSerial,
    trackExpiry: item.trackExpiry,
    unitId,
    quantity: '1',
    unitPrice: String(Number((Number(item.purchasePrice) * factor).toFixed(4))),
    taxGroupId: item.taxGroupId ?? '',
  };
}

const num = (s: string | null | undefined) => (s == null ? '' : String(Number(s)));

/** Form line from a saved document line. */
export function lineFromSaved(l: PurchaseLine, extra: Partial<PurchaseLineValues> = {}): PurchaseLineValues {
  const units: ItemUnit[] = [
    {
      unitId: l.product.baseUnitId,
      code: l.product.baseUnit?.code ?? '',
      name: l.product.baseUnit?.name ?? '',
      factor: '1',
    },
  ];
  if (l.unitId && l.unitId !== l.product.baseUnitId && l.unit) {
    units.push({
      unitId: l.unitId,
      code: l.unit.code,
      name: l.unit.name,
      factor: String(Number(l.unitFactor)),
    });
  }
  return {
    ...blank,
    key: l.id,
    productId: l.productId,
    variantId: l.variantId,
    name: l.product.name,
    variantName: l.variant?.name ?? null,
    sku: l.variant?.sku ?? l.product.sku,
    baseUnitId: l.product.baseUnitId,
    baseUnitCode: l.product.baseUnit?.code ?? '',
    units,
    lotTracked: l.product.trackBatch || l.product.trackExpiry,
    trackSerial: l.product.trackSerial,
    trackExpiry: l.product.trackExpiry,
    unitId: l.unitId ?? l.product.baseUnitId,
    quantity: num(l.quantity),
    unitPrice: num(l.unitPrice ?? l.estimatedPrice ?? null),
    discountPercent: Number(l.discountPercent ?? 0) ? num(l.discountPercent) : '',
    taxGroupId: l.taxGroupId ?? '',
    notes: l.notes ?? '',
    requisitionItemId: l.requisitionItemId ?? null,
    orderItemId: l.orderItemId ?? null,
    receiptItemId: l.receiptItemId ?? null,
    billItemId: l.billItemId ?? null,
    batchId: l.batchId ?? '',
    batchNo: l.batchNo ?? '',
    expiryDate: l.expiryDate ?? '',
    serialNumbers: l.serialNumbers ?? [],
    ...extra,
  };
}

/** API payload of a line; `fields` picks which optional parts the document takes. */
export function linePayload(
  l: PurchaseLineValues,
  fields: { price?: boolean; estimate?: boolean; batch?: 'new' | 'existing'; serials?: boolean } = {},
) {
  return {
    productId: l.productId,
    variantId: l.variantId,
    unitId: l.unitId,
    quantity: l.quantity,
    notes: nullIfEmpty(l.notes),
    ...(l.requisitionItemId && { requisitionItemId: l.requisitionItemId }),
    ...(l.orderItemId && { orderItemId: l.orderItemId }),
    ...(l.receiptItemId && { receiptItemId: l.receiptItemId }),
    ...(l.billItemId && { billItemId: l.billItemId }),
    ...(fields.price && {
      unitPrice: l.unitPrice || '0',
      discountPercent: l.discountPercent || '0',
      taxGroupId: l.taxGroupId || null,
    }),
    ...(fields.estimate && { estimatedPrice: nullIfEmpty(l.unitPrice) }),
    ...(fields.batch === 'new' && {
      batchId: l.batchId || null,
      batchNo: l.batchId ? null : nullIfEmpty(l.batchNo),
      expiryDate: l.batchId ? null : nullIfEmpty(l.expiryDate),
    }),
    ...(fields.batch === 'existing' && { batchId: l.batchId || null }),
    ...(fields.serials && l.trackSerial && { serialNumbers: l.serialNumbers }),
  };
}

export const linesSchema = z.array(purchaseLineSchema).min(1, 'inventory.validation.items');
