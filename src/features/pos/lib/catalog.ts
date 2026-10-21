import type { CatalogItem } from '../types';

/** Exact barcode / SKU match, including pack barcodes (returns the pack's unit). */
export function findByCode(items: CatalogItem[], code: string) {
  const term = code.trim().toLowerCase();
  if (!term) return null;
  for (const item of items) {
    if (item.barcode?.toLowerCase() === term || item.sku.toLowerCase() === term)
      return { item, unitId: null };
    const pack = item.units.find((u) => u.barcode?.toLowerCase() === term);
    if (pack) return { item, unitId: pack.unitId };
  }
  return null;
}
