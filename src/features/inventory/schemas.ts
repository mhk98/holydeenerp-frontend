import { z } from 'zod';
import { v } from '@/lib/form';
import type {
  AdjustmentKind,
  AdjustmentReason,
  ItemUnit,
  StockAdjustment,
  StockAdjustmentItem,
  StockItem,
  StockTransfer,
  StockTransferItem,
} from '@/types';

export const ADJUSTMENT_KINDS: AdjustmentKind[] = ['adjustment', 'opening', 'damage', 'scrap'];
export const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  'found',
  'lost',
  'theft',
  'damaged',
  'expired',
  'count_correction',
  'data_entry_error',
  'internal_use',
  'sample',
  'other',
];
export const MOVEMENT_TYPES = [
  'opening',
  'adjustment_in',
  'adjustment_out',
  'damage',
  'scrap',
  'transfer_out',
  'transfer_in',
  'transfer_return',
  'count_gain',
  'count_loss',
  'purchase_receipt',
  'purchase_return',
  'sale',
  'sales_return',
  'production_issue',
  'production_return',
  'production_receipt',
  'production_byproduct',
];

const unitSchema = z.object({ unitId: z.string(), code: z.string(), name: z.string(), factor: z.string() });
const optionalCost = z
  .string()
  .trim()
  .refine((s) => !s || /^\d+(\.\d{1,4})?$/.test(s), 'validation.decimal');

/**
 * One document line. Item details (name, units, tracking) are kept in the form so the line can
 * render without re-fetching; only the editable fields are sent to the API.
 */
export const lineSchema = z
  .object({
    key: z.string(),
    productId: z.string(),
    variantId: z.string().nullable(),
    name: z.string(),
    variantName: z.string().nullable(),
    sku: z.string(),
    baseUnitId: z.string(),
    baseUnitCode: z.string(),
    units: z.array(unitSchema),
    lotTracked: z.boolean(),
    trackSerial: z.boolean(),
    trackExpiry: z.boolean(),
    avgCost: z.string().optional(),
    direction: z.enum(['in', 'out']),
    /** Existing batch, or '' with batchNo for a new batch (stock-in only). */
    batchId: z.string(),
    batchNo: z.string().trim().max(60, 'validation.tooLong'),
    expiryDate: z.string(),
    mfgDate: z.string(),
    unitId: z.string(),
    quantity: v.decimal({ scale: 4 }),
    unitCost: optionalCost,
    reason: z.string(),
    serialNumbers: z.array(z.string()),
    notes: z.string().max(500, 'validation.tooLong'),
  })
  .superRefine((l, ctx) => {
    if (l.lotTracked) {
      if (l.direction === 'out' && !l.batchId)
        ctx.addIssue({ code: 'custom', path: ['batchId'], message: 'inventory.validation.batch' });
      if (l.direction === 'in' && !l.batchId && !l.batchNo)
        ctx.addIssue({ code: 'custom', path: ['batchNo'], message: 'inventory.validation.batchNo' });
      if (l.direction === 'in' && !l.batchId && l.trackExpiry && !l.expiryDate) {
        ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'inventory.validation.expiry' });
      }
    }
    if (l.trackSerial) {
      const factor = Number(l.units.find((u) => u.unitId === l.unitId)?.factor ?? 1);
      const base = Number(l.quantity) * factor;
      if (!Number.isInteger(base))
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'inventory.validation.wholeUnits' });
      else if (l.serialNumbers.length !== base) {
        ctx.addIssue({
          code: 'custom',
          path: ['serialNumbers'],
          message: 'inventory.validation.serialCount',
        });
      }
    }
  });

export type LineValues = z.infer<typeof lineSchema>;

/** A new line for an item picked in the item picker. */
export function lineFromItem(item: StockItem, direction: 'in' | 'out'): LineValues {
  return {
    key: item.key,
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
    avgCost: item.avgCost,
    direction,
    batchId: '',
    batchNo: '',
    expiryDate: '',
    mfgDate: '',
    unitId: item.matchedUnitId ?? item.baseUnit.id,
    quantity: '1',
    unitCost: '',
    reason: '',
    serialNumbers: [],
    notes: '',
  };
}

type SavedLine = StockAdjustmentItem | StockTransferItem;

function lineFromSaved(i: SavedLine, extra: Partial<LineValues> = {}): LineValues {
  const baseUnit = i.product.baseUnit;
  const units: ItemUnit[] = [
    { unitId: i.product.baseUnitId, code: baseUnit?.code ?? '', name: baseUnit?.name ?? '', factor: '1' },
  ];
  if (i.unitId && i.unitId !== i.product.baseUnitId && i.unit) {
    units.push({ unitId: i.unitId, code: i.unit.code, name: i.unit.name, factor: i.unitFactor });
  }
  return {
    key: `${i.productId}:${i.variantId ?? ''}`,
    productId: i.productId,
    variantId: i.variantId,
    name: i.product.name,
    variantName: i.variant?.name ?? null,
    sku: i.variant?.sku ?? i.product.sku,
    baseUnitId: i.product.baseUnitId,
    baseUnitCode: baseUnit?.code ?? '',
    units,
    lotTracked: i.product.trackBatch || i.product.trackExpiry,
    trackSerial: i.product.trackSerial,
    trackExpiry: i.product.trackExpiry,
    direction: 'out',
    batchId: i.batchId ?? '',
    batchNo: '',
    expiryDate: '',
    mfgDate: '',
    unitId: i.unitId ?? i.product.baseUnitId,
    quantity: String(Number(i.quantity)),
    unitCost: '',
    reason: '',
    serialNumbers: i.serialNumbers ?? [],
    notes: i.notes ?? '',
    ...extra,
  };
}

const nullIfEmpty = (s: string) => (s && s.trim() ? s.trim() : null);

// ── Adjustments ────────────────────────────────────────────────────────────
export const adjustmentSchema = z.object({
  kind: z.enum(['opening', 'adjustment', 'damage', 'scrap']),
  warehouseId: v.required(),
  adjustmentDate: v.required(),
  reason: z.string(),
  notes: z.string().max(2000, 'validation.tooLong'),
  items: z.array(lineSchema).min(1, 'inventory.validation.items'),
});
export type AdjustmentValues = z.infer<typeof adjustmentSchema>;

export function adjustmentToForm(doc: StockAdjustment): AdjustmentValues {
  return {
    kind: doc.kind,
    warehouseId: doc.warehouseId,
    adjustmentDate: doc.adjustmentDate,
    reason: doc.reason ?? '',
    notes: doc.notes ?? '',
    items: (doc.items ?? []).map((i) =>
      lineFromSaved(i, {
        direction: i.direction,
        // An unsaved new batch stays "new"; once posted the line points at the created batch.
        batchNo: i.batchId ? '' : (i.batchNo ?? ''),
        expiryDate: i.expiryDate ?? '',
        mfgDate: i.mfgDate ?? '',
        unitCost: i.direction === 'in' && Number(i.unitCost) > 0 ? String(Number(i.unitCost)) : '',
        reason: i.reason ?? '',
      }),
    ),
  };
}

export function adjustmentPayload(values: AdjustmentValues) {
  return {
    kind: values.kind,
    warehouseId: values.warehouseId,
    adjustmentDate: values.adjustmentDate,
    reason: nullIfEmpty(values.reason),
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      direction: l.direction,
      batchId: l.batchId || null,
      batchNo: l.batchId ? null : nullIfEmpty(l.batchNo),
      expiryDate: l.batchId ? null : nullIfEmpty(l.expiryDate),
      mfgDate: l.batchId ? null : nullIfEmpty(l.mfgDate),
      unitId: l.unitId,
      quantity: l.quantity,
      unitCost: l.direction === 'in' ? nullIfEmpty(l.unitCost) : null,
      reason: nullIfEmpty(l.reason),
      serialNumbers: l.trackSerial ? l.serialNumbers : undefined,
      notes: nullIfEmpty(l.notes),
    })),
  };
}

// ── Transfers ──────────────────────────────────────────────────────────────
export const transferSchema = z
  .object({
    fromWarehouseId: v.required(),
    toWarehouseId: v.required(),
    transferDate: v.required(),
    notes: z.string().max(2000, 'validation.tooLong'),
    items: z.array(lineSchema).min(1, 'inventory.validation.items'),
  })
  .refine((t) => t.fromWarehouseId !== t.toWarehouseId, {
    path: ['toWarehouseId'],
    message: 'inventory.validation.sameWarehouse',
  });
export type TransferValues = z.infer<typeof transferSchema>;

export function transferToForm(doc: StockTransfer): TransferValues {
  return {
    fromWarehouseId: doc.fromWarehouseId,
    toWarehouseId: doc.toWarehouseId,
    transferDate: doc.transferDate,
    notes: doc.notes ?? '',
    items: (doc.items ?? []).map((i) => lineFromSaved(i)),
  };
}

export function transferPayload(values: TransferValues) {
  return {
    fromWarehouseId: values.fromWarehouseId,
    toWarehouseId: values.toWarehouseId,
    transferDate: values.transferDate,
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      batchId: l.batchId || null,
      unitId: l.unitId,
      quantity: l.quantity,
      serialNumbers: l.trackSerial ? l.serialNumbers : undefined,
      notes: nullIfEmpty(l.notes),
    })),
  };
}

/** Today in the company's timezone as YYYY-MM-DD. */
export function todayIn(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}
