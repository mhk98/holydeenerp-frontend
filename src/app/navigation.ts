import {
  Activity,
  CalendarRange,
  GitCompareArrows,
  ReceiptText,
  ArrowLeftRight,
  BellRing,
  FileCheck2,
  FileMinus,
  Repeat,
  Vault,
  Tags,
  Scale,
  Undo2,
  HandCoins,
  PackageCheck,
  FileQuestion,
  ClipboardPen,
  BarChart3,
  BookOpen,
  Boxes,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  FolderTree,
  History,
  Landmark,
  Layers,
  Cog,
  SquareKanban,
  ChartGantt,
  FileChartColumn,
  LayoutDashboard,
  ListOrdered,
  type LucideIcon,
  MonitorSmartphone,
  Package,
  PackageSearch,
  Receipt,
  ScanBarcode,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  SlidersVertical,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';

export interface NavItem {
  /** i18n key under "nav." */
  key: string;
  path: string;
  icon: LucideIcon;
  /** Permission required to see the item and open the route ("<module>.view"). */
  permission?: string;
  /** Custom active-state test (default: path prefix). */
  activeMatch?: (pathname: string) => boolean;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar, command palette and placeholder routes.
 * When a module is built, give its route a real page in app/router.tsx.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    items: [
      { key: 'dashboard', path: '/', icon: LayoutDashboard },
      { key: 'reports', path: '/reports', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    key: 'sales',
    items: [
      { key: 'pos', path: '/pos', icon: MonitorSmartphone, permission: 'pos.view' },
      { key: 'customers', path: '/sales/customers', icon: Users, permission: 'sales.view' },
      { key: 'quotations', path: '/sales/quotations', icon: FileText, permission: 'sales.view' },
      { key: 'salesOrders', path: '/sales/orders', icon: FileCheck2, permission: 'sales.view' },
      { key: 'challans', path: '/sales/challans', icon: Truck, permission: 'sales.view' },
      { key: 'invoices', path: '/sales/invoices', icon: Receipt, permission: 'sales.view' },
      { key: 'moneyReceipts', path: '/sales/receipts', icon: Wallet, permission: 'sales.view' },
      { key: 'salesReturns', path: '/sales/returns', icon: FileMinus, permission: 'sales.view' },
      { key: 'receivables', path: '/sales/receivables', icon: BellRing, permission: 'sales.view' },
      { key: 'priceLists', path: '/sales/price-lists', icon: Tags, permission: 'sales.view' },
      { key: 'recurringInvoices', path: '/sales/recurring', icon: Repeat, permission: 'sales.view' },
      { key: 'posSessions', path: '/sales/pos-sessions', icon: Vault, permission: 'pos.view' },
    ],
  },
  {
    key: 'purchases',
    items: [
      { key: 'suppliers', path: '/purchases/suppliers', icon: Truck, permission: 'purchase.view' },
      {
        key: 'requisitions',
        path: '/purchases/requisitions',
        icon: ClipboardPen,
        permission: 'purchase.view',
      },
      { key: 'rfqs', path: '/purchases/rfqs', icon: FileQuestion, permission: 'purchase.view' },
      { key: 'purchaseOrders', path: '/purchases/orders', icon: ShoppingCart, permission: 'purchase.view' },
      { key: 'goodsReceipts', path: '/purchases/receipts', icon: PackageCheck, permission: 'purchase.view' },
      { key: 'bills', path: '/purchases/bills', icon: ClipboardList, permission: 'purchase.view' },
      { key: 'supplierPayments', path: '/purchases/payments', icon: HandCoins, permission: 'purchase.view' },
      { key: 'purchaseReturns', path: '/purchases/returns', icon: Undo2, permission: 'purchase.view' },
      { key: 'payables', path: '/purchases/payables', icon: Scale, permission: 'purchase.view' },
    ],
  },
  {
    key: 'inventory',
    items: [
      { key: 'products', path: '/inventory/products', icon: Package, permission: 'products.view' },
      { key: 'categories', path: '/inventory/categories', icon: FolderTree, permission: 'products.view' },
      { key: 'brands', path: '/inventory/brands', icon: Tag, permission: 'products.view' },
      {
        key: 'attributes',
        path: '/inventory/attributes',
        icon: SlidersHorizontal,
        permission: 'products.view',
      },
      { key: 'barcodeLabels', path: '/inventory/labels', icon: ScanBarcode, permission: 'products.print' },
      { key: 'stockOverview', path: '/inventory/stock', icon: PackageSearch, permission: 'inventory.view' },
      { key: 'warehouses', path: '/inventory/warehouses', icon: Warehouse, permission: 'inventory.view' },
      {
        key: 'stockAdjustments',
        path: '/inventory/adjustments',
        icon: SlidersVertical,
        permission: 'inventory.view',
      },
      {
        key: 'stockTransfers',
        path: '/inventory/transfers',
        icon: ArrowLeftRight,
        permission: 'inventory.view',
      },
      { key: 'stockCounts', path: '/inventory/counts', icon: ClipboardCheck, permission: 'inventory.view' },
      {
        key: 'stockMovements',
        path: '/inventory/movements',
        icon: ListOrdered,
        permission: 'inventory.view',
      },
      { key: 'serialNumbers', path: '/inventory/serials', icon: Fingerprint, permission: 'inventory.view' },
      {
        key: 'inventoryReports',
        path: '/inventory/reports',
        icon: ChartColumn,
        permission: 'inventory.view',
      },
    ],
  },
  {
    key: 'manufacturing',
    items: [
      {
        key: 'productionOrders',
        path: '/manufacturing/orders',
        icon: Factory,
        permission: 'manufacturing.view',
      },
      { key: 'billOfMaterials', path: '/manufacturing/boms', icon: Layers, permission: 'manufacturing.view' },
      {
        key: 'workCenters',
        path: '/manufacturing/work-centers',
        icon: Cog,
        permission: 'manufacturing.view',
      },
      {
        key: 'productionBoard',
        path: '/manufacturing/board',
        icon: SquareKanban,
        permission: 'manufacturing.view',
      },
      {
        key: 'productionSchedule',
        path: '/manufacturing/schedule',
        icon: ChartGantt,
        permission: 'manufacturing.view',
      },
      { key: 'mrp', path: '/manufacturing/mrp', icon: PackageSearch, permission: 'manufacturing.view' },
      {
        key: 'manufacturingReports',
        path: '/manufacturing/reports',
        icon: FileChartColumn,
        permission: 'manufacturing.view',
      },
    ],
  },
  {
    key: 'accounting',
    items: [
      { key: 'chartOfAccounts', path: '/accounting/accounts', icon: BookOpen, permission: 'accounting.view' },
      {
        key: 'journalEntries',
        path: '/accounting/journals',
        icon: ScrollText,
        permission: 'accounting.view',
      },
      {
        key: 'bankAccounts',
        path: '/accounting/bank-accounts',
        icon: Landmark,
        permission: 'accounting.view',
      },
      { key: 'vouchers', path: '/accounting/vouchers', icon: ReceiptText, permission: 'accounting.view' },
      { key: 'expenses', path: '/accounting/expenses', icon: Wallet, permission: 'accounting.view' },
      { key: 'cheques', path: '/accounting/cheques', icon: FileCheck2, permission: 'accounting.view' },
      {
        key: 'reconciliations',
        path: '/accounting/reconciliations',
        icon: GitCompareArrows,
        permission: 'accounting.view',
      },
      {
        key: 'openingBalances',
        path: '/accounting/opening-balances',
        icon: Scale,
        permission: 'accounting.view',
      },
      {
        key: 'fiscalYears',
        path: '/accounting/fiscal-years',
        icon: CalendarRange,
        permission: 'accounting.view',
      },
      { key: 'ledgerHealth', path: '/accounting/health', icon: Activity, permission: 'accounting.view' },
      { key: 'fixedAssets', path: '/assets', icon: Landmark, permission: 'assets.view' },
      {
        key: 'financialReports',
        path: '/accounting/reports',
        icon: FileSpreadsheet,
        permission: 'accounting.view',
      },
    ],
  },
  {
    key: 'hr',
    items: [
      { key: 'employees', path: '/hr/employees', icon: UserRound, permission: 'hr.view' },
      { key: 'payroll', path: '/hr/payroll', icon: Wallet, permission: 'hr.view' },
    ],
  },
  {
    key: 'settings',
    items: [
      {
        key: 'generalSettings',
        path: '/settings',
        icon: Settings2,
        permission: 'settings.view',
        // The whole Settings area except the pages that have their own sidebar entries.
        activeMatch: (p) => p.startsWith('/settings') && !/^\/settings\/(users|roles|audit-logs)/.test(p),
      },
      { key: 'users', path: '/settings/users', icon: UserCog, permission: 'users.view' },
      { key: 'roles', path: '/settings/roles', icon: ShieldCheck, permission: 'users.view' },
      { key: 'auditLogs', path: '/settings/audit-logs', icon: History, permission: 'audit_logs.view' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g.key })));

/** Icon used for the brand mark. */
export const BrandIcon = Boxes;
