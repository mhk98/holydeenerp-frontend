/** Route of a sales document. */
export const SALES_ROUTES = {
  quotation: '/sales/quotations',
  order: '/sales/orders',
  challan: '/sales/challans',
  invoice: '/sales/invoices',
  receipt: '/sales/receipts',
  return: '/sales/returns',
  priceList: '/sales/price-lists',
  recurring: '/sales/recurring',
  aging: '/sales/receivables',
  ledger: '/sales/customers',
} as const;

export const QUOTATION_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'converted',
  'cancelled',
] as const;
export const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'partially_delivered',
  'delivered',
  'invoiced',
  'closed',
  'cancelled',
] as const;
export const CHALLAN_STATUSES = ['draft', 'posted', 'cancelled'] as const;
export const INVOICE_STATUSES = ['draft', 'unpaid', 'partially_paid', 'paid', 'cancelled'] as const;
export const RETURN_STATUSES = ['draft', 'posted', 'cancelled'] as const;

/** The API error says the credit limit would be exceeded (field `creditOverride`). */
export function isCreditLimitError(err: unknown) {
  const e = err as { status?: number; errors?: { field?: string; path?: string }[] } | null;
  return e?.status === 422 && Boolean(e.errors?.some((x) => (x.field ?? x.path) === 'creditOverride'));
}

export { lineName, nullIfEmpty, todayIn } from '@/features/purchase/lib';
