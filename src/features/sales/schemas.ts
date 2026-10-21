import { z } from 'zod';
import { v } from '@/lib/form';
import type { ItemUnit, SalesLine, StockItem } from '@/types';
import { nullIfEmpty } from '@/features/purchase/lib';

const decimal = (scale = 4) =>
  z
    .string()
    .trim()
    .refine((s) => !s || new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`).test(s), 'validation.decimal');

/** One sales document line; item details are kept so lines render without re-fetching. */
export const salesLineSchema = z
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
    discountType: z.enum(['percent', 'amount']),
    discountValue: decimal(),
    taxGroupId: z.string(),
    priceIncludesTax: z.boolean(),
    notes: z.string().max(500, 'validation.tooLong'),
    orderItemId: z.string().nullable(),
    challanItemId: z.string().nullable(),
    invoiceItemId: z.string().nullable(),
    batchId: z.string(),
    serialNumbers: z.array(z.string()),
    /** "Wholesale list" when the price came from a price list. */
    priceSource: z.string(),
    info: z.string(),
  })
  .superRefine((l, ctx) => {
    if (l.discountType === 'percent' && Number(l.discountValue) > 100) {
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'validation.tooLarge' });
    }
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
export type SalesLineValues = z.infer<typeof salesLineSchema>;
export const salesLinesSchema = z.array(salesLineSchema).min(1, 'inventory.validation.items');

/** The part of every sales form the line editor and totals work with. */
export type SalesLinesForm = {
  items: SalesLineValues[];
  discountType: 'percent' | 'amount';
  discountValue: string;
};

const blank = {
  discountType: 'percent' as const,
  discountValue: '',
  taxGroupId: '',
  priceIncludesTax: false,
  notes: '',
  orderItemId: null,
  challanItemId: null,
  invoiceItemId: null,
  batchId: '',
  serialNumbers: [],
  priceSource: '',
  info: '',
};

export function lineFromItem(item: StockItem): SalesLineValues {
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
    unitId: item.matchedUnitId ?? item.baseUnit.id,
    quantity: '1',
    unitPrice: '',
    taxGroupId: item.taxGroupId ?? '',
  };
}

const num = (s: string | null | undefined) => (s == null ? '' : String(Number(s)));

export function lineFromSaved(l: SalesLine, extra: Partial<SalesLineValues> = {}): SalesLineValues {
  const units: ItemUnit[] = [
    {
      unitId: l.product.baseUnitId,
      code: l.product.baseUnit?.code ?? '',
      name: l.product.baseUnit?.name ?? '',
      factor: '1',
    },
  ];
  if (l.unitId && l.unitId !== l.product.baseUnitId && l.unit)
    units.push({
      unitId: l.unitId,
      code: l.unit.code,
      name: l.unit.name,
      factor: String(Number(l.unitFactor)),
    });
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
    unitPrice: num(l.unitPrice),
    discountType: l.discountType ?? 'percent',
    discountValue: Number(l.discountValue ?? 0) ? num(l.discountValue) : '',
    taxGroupId: l.taxGroupId ?? '',
    priceIncludesTax: Boolean(l.priceIncludesTax),
    notes: l.notes ?? '',
    orderItemId: l.orderItemId ?? null,
    challanItemId: l.challanItemId ?? null,
    invoiceItemId: l.invoiceItemId ?? null,
    batchId: l.batchId ?? '',
    serialNumbers: l.serialNumbers ?? [],
    ...extra,
  };
}

/** Payload of a line; `fields` picks the optional parts a document takes. */
export function linePayload(l: SalesLineValues, fields: { price?: boolean; stock?: boolean } = {}) {
  return {
    productId: l.productId,
    variantId: l.variantId,
    unitId: l.unitId,
    quantity: l.quantity,
    notes: nullIfEmpty(l.notes),
    ...(l.orderItemId && { orderItemId: l.orderItemId }),
    ...(l.challanItemId && { challanItemId: l.challanItemId }),
    ...(l.invoiceItemId && { invoiceItemId: l.invoiceItemId }),
    ...(fields.price && {
      unitPrice: l.unitPrice || '0',
      discountType: l.discountType,
      discountValue: l.discountValue || '0',
      taxGroupId: l.taxGroupId || null,
      priceIncludesTax: l.priceIncludesTax,
    }),
    ...(fields.stock &&
      !l.challanItemId && {
        batchId: l.batchId || null,
        ...(l.trackSerial && { serialNumbers: l.serialNumbers }),
      }),
  };
}

/** Body for /sales/calculate. */
export const calculateBody = (items: SalesLineValues[], discountType: string, discountValue: string) =>
  items.length
    ? {
        discountType,
        discountValue: discountValue || '0',
        items: items.map((l) => ({
          quantity: /^\d+(\.\d{1,4})?$/.test(l.quantity) ? l.quantity : '0',
          unitPrice: /^\d+(\.\d{1,4})?$/.test(l.unitPrice) ? l.unitPrice : '0',
          discountType: l.discountType,
          discountValue: /^\d+(\.\d{1,4})?$/.test(l.discountValue) ? l.discountValue : '0',
          taxGroupId: l.taxGroupId || null,
          priceIncludesTax: l.priceIncludesTax,
        })),
      }
    : null;
