import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  type LucideIcon,
  Smartphone,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { formatDate } from '@/lib/format';
import type { StatusTone } from '@/components/common/status-badge';
import type { Language } from '@/types';
import type { Account, AccountNode, EntryType, JournalStatus, MoneyKind, VoucherType } from './types';

export const ACCOUNTING_ROUTES = {
  accounts: '/accounting/accounts',
  journals: '/accounting/journals',
  fiscalYears: '/accounting/fiscal-years',
  openingBalances: '/accounting/opening-balances',
  health: '/accounting/health',
  bankAccounts: '/accounting/bank-accounts',
  vouchers: '/accounting/vouchers',
  expenses: '/accounting/expenses',
  expenseCategories: '/accounting/expense-categories',
  cheques: '/accounting/cheques',
  reconciliations: '/accounting/reconciliations',
  reports: '/accounting/reports',
} as const;

/** Account name in the UI language (Bangla name when there is one). */
export const accountName = (a: Pick<Account, 'name' | 'nameBn'>, language: Language) =>
  language === 'bn' && a.nameBn ? a.nameBn : a.name;

export const accountLabel = (a: Pick<Account, 'code' | 'name' | 'nameBn'>, language: Language) =>
  `${a.code} · ${accountName(a, language)}`;

export const STATUS_TONE: Record<JournalStatus, StatusTone> = { draft: 'neutral', posted: 'success' };
export const ENTRY_TONE: Record<EntryType, StatusTone> = {
  manual: 'info',
  auto: 'neutral',
  opening: 'info',
  closing: 'warning',
  reversal: 'danger',
};

/** Where the document behind an automatic journal lives (null: no page of its own). */
const SOURCE_ROUTES: Record<string, string> = {
  sales_invoice: '/sales/invoices',
  sales_return: '/sales/returns',
  customer_receipt: '/sales/receipts',
  delivery_challan: '/sales/challans',
  supplier_bill: '/purchases/bills',
  supplier_payment: '/purchases/payments',
  purchase_return: '/purchases/returns',
  goods_receipt: '/purchases/receipts',
  stock_adjustment: '/inventory/adjustments',
  stock_transfer: '/inventory/transfers',
  stock_count: '/inventory/counts',
  voucher: '/accounting/vouchers',
  expense: '/accounting/expenses',
  manufacturing_order: '/manufacturing/orders',
};

/** Badge colour of voucher / expense / cheque statuses. */
export const DOC_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  posted: 'success',
  void: 'danger',
  in_hand: 'warning',
  deposited: 'info',
  issued: 'info',
  cleared: 'success',
  bounced: 'danger',
  cancelled: 'neutral',
  in_progress: 'warning',
  completed: 'success',
};

export const sourceRoute = (sourceType: string | null, sourceId: string | null) =>
  sourceType && sourceId && SOURCE_ROUTES[sourceType] ? `${SOURCE_ROUTES[sourceType]}/${sourceId}` : null;

/** Depth-first list of tree nodes with their depth (for indented tables and pickers). */
export function flattenAccounts(nodes: AccountNode[], depth = 0): (AccountNode & { depth: number })[] {
  return nodes.flatMap((n) => [{ ...n, depth }, ...flattenAccounts(n.children, depth + 1)]);
}

/** Two-decimal money arithmetic on strings without float drift (×100 integers). */
export const cents = (v: string | number | null | undefined) => Math.round(Number(v || 0) * 100);

export const KIND_ICON: Record<MoneyKind, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  mobile_wallet: Smartphone,
};
export const VOUCHER_ICON: Record<VoucherType, LucideIcon> = {
  receipt: ArrowDownLeft,
  payment: ArrowUpRight,
  contra: ArrowLeftRight,
};

/** "1 Jul 2026 – 19 Oct 2026", or "as of 19 Oct 2026". */
export function rangeLabel(t: TFunction, from?: string, to?: string, asOf?: string) {
  if (asOf) return t('accounting.reports.asOfLabel', { date: formatDate(asOf) });
  return `${formatDate(from)} – ${formatDate(to)}`;
}
