import { z } from 'zod';
import { v } from '@/lib/form';
import type { Product, ProductType } from '@/types';

export const PRODUCT_TYPES: ProductType[] = ['finished_good', 'raw_material', 'consumable', 'service'];
export const NONE = '__none__';

const money = v.decimal({ scale: 4, allowZero: true });
const optionalMoney = z
  .string()
  .trim()
  .refine((s) => !s || /^\d+(\.\d{1,4})?$/.test(s), 'validation.decimal');
const barcode = z.string().trim().max(64, 'validation.tooLong');
const sku = z
  .string()
  .trim()
  .max(60, 'validation.tooLong')
  .regex(/^[A-Za-z0-9._\-/]*$/, 'validation.code');

const unitRow = z.object({
  unitId: z.string().min(1, 'validation.required'),
  factor: v.decimal({ scale: 6 }),
  barcode,
  purchasePrice: optionalMoney,
  salePrice: optionalMoney,
  isDefaultPurchase: z.boolean(),
  isDefaultSale: z.boolean(),
});

const variantRow = z.object({
  id: z.string().optional(),
  attributeValueIds: z.array(z.string()).min(1),
  sku,
  barcode,
  purchasePrice: optionalMoney,
  salePrice: optionalMoney,
  isActive: z.boolean(),
});

export const productSchema = z
  .object({
    sku,
    name: v.required().max(200, 'validation.tooLong'),
    type: z.enum(PRODUCT_TYPES as [ProductType, ...ProductType[]]),
    barcode,
    barcodeType: z.enum(['EAN13', 'CODE128']),
    categoryId: z.string(),
    brandId: z.string(),
    baseUnitId: z.string().min(1, 'validation.required'),
    taxGroupId: z.string(),
    purchasePrice: money,
    salePrice: money,
    priceIncludesTax: z.boolean(),
    reorderLevel: money,
    trackBatch: z.boolean(),
    trackSerial: z.boolean(),
    trackExpiry: z.boolean(),
    hasVariants: z.boolean(),
    description: z.string().max(5000, 'validation.tooLong'),
    isActive: z.boolean(),
    units: z.array(unitRow),
    variants: z.array(variantRow),
  })
  .refine((p) => !p.barcode || p.barcodeType !== 'EAN13' || isEan13(p.barcode), {
    message: 'validation.ean13',
    path: ['barcode'],
  })
  .refine((p) => new Set(p.units.map((u) => u.unitId)).size === p.units.length, {
    message: 'products.errors.duplicateUnit',
    path: ['units'],
  })
  .refine((p) => !p.units.some((u) => u.unitId === p.baseUnitId), {
    message: 'products.errors.baseUnitPack',
    path: ['units'],
  });

export type ProductValues = z.infer<typeof productSchema>;

export function isEan13(code: string) {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

export const emptyProduct = (baseUnitId = ''): ProductValues => ({
  sku: '',
  name: '',
  type: 'finished_good',
  barcode: '',
  barcodeType: 'EAN13',
  categoryId: NONE,
  brandId: NONE,
  baseUnitId,
  taxGroupId: NONE,
  purchasePrice: '0',
  salePrice: '0',
  priceIncludesTax: false,
  reorderLevel: '0',
  trackBatch: false,
  trackSerial: false,
  trackExpiry: false,
  hasVariants: false,
  description: '',
  isActive: true,
  units: [],
  variants: [],
});

/** Strip trailing zeros of DECIMAL strings for editing ("245.5000" → "245.5"). */
const trim = (s: string | null | undefined) =>
  s == null ? '' : s.includes('.') ? s.replace(/\.?0+$/, '') : s;

export function toFormValues(p: Product): ProductValues {
  return {
    sku: p.sku,
    name: p.name,
    type: p.type,
    barcode: p.barcode ?? '',
    barcodeType: p.barcodeType,
    categoryId: p.categoryId ?? NONE,
    brandId: p.brandId ?? NONE,
    baseUnitId: p.baseUnitId,
    taxGroupId: p.taxGroupId ?? NONE,
    purchasePrice: trim(p.purchasePrice),
    salePrice: trim(p.salePrice),
    priceIncludesTax: p.priceIncludesTax,
    reorderLevel: trim(p.reorderLevel),
    trackBatch: p.trackBatch,
    trackSerial: p.trackSerial,
    trackExpiry: p.trackExpiry,
    hasVariants: p.hasVariants,
    description: p.description ?? '',
    isActive: p.isActive,
    units: (p.units ?? []).map((u) => ({
      unitId: u.unitId,
      factor: trim(u.factor),
      barcode: u.barcode ?? '',
      purchasePrice: trim(u.purchasePrice),
      salePrice: trim(u.salePrice),
      isDefaultPurchase: u.isDefaultPurchase,
      isDefaultSale: u.isDefaultSale,
    })),
    variants: (p.variants ?? []).map((x) => ({
      id: x.id,
      attributeValueIds: x.attributeValueIds,
      sku: x.sku,
      barcode: x.barcode ?? '',
      purchasePrice: trim(x.purchasePrice),
      salePrice: trim(x.salePrice),
      isActive: x.isActive,
    })),
  };
}

const orNull = (s: string) => (s === NONE || !s.trim() ? null : s.trim());

export function toPayload(values: ProductValues) {
  const isService = values.type === 'service';
  return {
    ...values,
    sku: values.sku.trim() || undefined,
    barcode: orNull(values.barcode),
    categoryId: orNull(values.categoryId),
    brandId: orNull(values.brandId),
    taxGroupId: orNull(values.taxGroupId),
    description: orNull(values.description),
    trackBatch: !isService && values.trackBatch,
    trackSerial: !isService && values.trackSerial,
    trackExpiry: !isService && values.trackExpiry,
    units: values.units.map((u) => ({
      ...u,
      barcode: orNull(u.barcode),
      purchasePrice: orNull(u.purchasePrice),
      salePrice: orNull(u.salePrice),
    })),
    variants: values.hasVariants
      ? values.variants.map((x) => ({
          ...x,
          sku: x.sku.trim() || undefined,
          barcode: orNull(x.barcode),
          purchasePrice: orNull(x.purchasePrice),
          salePrice: orNull(x.salePrice),
        }))
      : [],
  };
}
