import {
  Banknote,
  Boxes,
  Factory,
  HandCoins,
  type LucideIcon,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { KpiKey } from './api/dashboard-api';

/** KPI cards in display order: icon, link, and whether a rise is good news. */
export const KPI_CARDS: { key: KpiKey; icon: LucideIcon; to: string; money: boolean; upIsGood: boolean }[] = [
  { key: 'sales', icon: TrendingUp, to: '/sales/invoices', money: true, upIsGood: true },
  { key: 'purchases', icon: ShoppingCart, to: '/purchases/bills', money: true, upIsGood: false },
  { key: 'grossProfit', icon: HandCoins, to: '/accounting/reports/profit-loss', money: true, upIsGood: true },
  { key: 'receivables', icon: Receipt, to: '/sales/receivables', money: true, upIsGood: false },
  { key: 'payables', icon: Wallet, to: '/purchases/payables', money: true, upIsGood: false },
  { key: 'cashBalance', icon: Banknote, to: '/accounting/bank-accounts', money: true, upIsGood: true },
  { key: 'stockValue', icon: Boxes, to: '/inventory/stock', money: true, upIsGood: true },
  {
    key: 'pendingProduction',
    icon: Factory,
    to: '/manufacturing/orders?active=true',
    money: false,
    upIsGood: true,
  },
];

/** Where each document type of the activity / approvals widgets opens. */
export const DOC_ROUTES: Record<string, string> = {
  sales_invoice: '/sales/invoices',
  customer_receipt: '/sales/receipts',
  supplier_bill: '/purchases/bills',
  supplier_payment: '/purchases/payments',
  goods_receipt: '/purchases/receipts',
  stock_adjustment: '/inventory/adjustments',
  stock_transfer: '/inventory/transfers',
  stock_count: '/inventory/counts',
  purchase_requisition: '/purchases/requisitions',
  purchase_order: '/purchases/orders',
  voucher: '/accounting/vouchers',
  expense: '/accounting/expenses',
  manufacturing_order: '/manufacturing/orders',
};

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
