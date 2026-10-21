import type { StatusTone } from '@/components/common/status-badge';
import type { PurchaseLine } from '@/types';

/** Badge colour for every purchase document status. */
export const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  approved: 'info',
  rejected: 'danger',
  ordered: 'success',
  sent: 'info',
  awarded: 'success',
  partially_received: 'warning',
  received: 'info',
  billed: 'success',
  closed: 'neutral',
  posted: 'success',
  unpaid: 'warning',
  partially_paid: 'info',
  paid: 'success',
  void: 'danger',
  cancelled: 'neutral',
  invited: 'neutral',
  quoted: 'info',
  declined: 'neutral',
  accepted: 'success',
  converted: 'success',
  confirmed: 'info',
  partially_delivered: 'warning',
  delivered: 'info',
  invoiced: 'success',
};

export const PO_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'partially_received',
  'received',
  'billed',
  'closed',
  'cancelled',
] as const;

/** Route of a purchase document. */
export const DOC_ROUTES = {
  requisition: '/purchases/requisitions',
  rfq: '/purchases/rfqs',
  order: '/purchases/orders',
  receipt: '/purchases/receipts',
  bill: '/purchases/bills',
  payment: '/purchases/payments',
  return: '/purchases/returns',
} as const;

export const lineName = (l: Pick<PurchaseLine, 'product' | 'variant'>) =>
  l.variant ? `${l.product.name} — ${l.variant.name}` : l.product.name;

/** Today in the company's timezone (YYYY-MM-DD). */
export const todayIn = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

const nullIfEmpty = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
export { nullIfEmpty };
