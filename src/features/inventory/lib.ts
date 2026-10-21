import type { StatusTone } from '@/components/common/status-badge';
import type { AdjustmentStatus, CountStatus, StockStatus, TransferStatus } from '@/types';

type DocStatus = AdjustmentStatus | TransferStatus | CountStatus;

export const DOC_STATUS_TONE: Record<DocStatus, StatusTone> = {
  draft: 'neutral',
  counting: 'info',
  pending_approval: 'warning',
  in_transit: 'info',
  posted: 'success',
  received: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

export const STOCK_STATUS_TONE: Record<StockStatus, StatusTone> = {
  in_stock: 'success',
  low: 'warning',
  out: 'danger',
  negative: 'danger',
};

/** "Product — Variant" display name. */
export const itemLabel = (i: { name: string; variantName?: string | null }) =>
  i.variantName ? `${i.name} — ${i.variantName}` : i.name;

/** Where a movement came from, as a link to its document. */
export function referenceLink(referenceType: string, referenceId: string) {
  const route = {
    stock_adjustment: '/inventory/adjustments',
    stock_transfer: '/inventory/transfers',
    stock_count: '/inventory/counts',
    goods_receipt: '/purchases/receipts',
    purchase_return: '/purchases/returns',
    manufacturing_order: '/manufacturing/orders',
  }[referenceType];
  return route ? `${route}/${referenceId}` : null;
}
