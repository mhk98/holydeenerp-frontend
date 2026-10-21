import { lazy, Suspense, type ReactNode } from 'react';
import { FullScreenLoader } from '@/components/common/full-screen-loader';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { SettingsLayout } from '@/features/settings/components/settings-layout';
import RouteErrorPage from '@/features/system/pages/route-error-page';
import { ALL_NAV_ITEMS } from './navigation';
import { GuestRoute, ProtectedRoute } from './protected-route';
import { RequirePermission } from './require-permission';

const LoginPage = lazy(() => import('@/features/auth/pages/login-page'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/forgot-password-page'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/reset-password-page'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/dashboard-page'));
const ProfilePage = lazy(() => import('@/features/profile/pages/profile-page'));
const UsersPage = lazy(() => import('@/features/users/pages/users-page'));
const RolesPage = lazy(() => import('@/features/roles/pages/roles-page'));
const RolePermissionsPage = lazy(() => import('@/features/roles/pages/role-permissions-page'));
const ComingSoonPage = lazy(() => import('@/features/system/pages/coming-soon-page'));
const NotFoundPage = lazy(() => import('@/features/system/pages/not-found-page'));

// Settings area
const CompanyPage = lazy(() => import('@/features/settings/pages/company-page'));
const BranchesPage = lazy(() => import('@/features/settings/pages/branches-page'));
const WarehousesPage = lazy(() => import('@/features/settings/pages/warehouses-page'));
const FinancialPage = lazy(() => import('@/features/settings/pages/financial-page'));
const CurrenciesPage = lazy(() => import('@/features/settings/pages/currencies-page'));
const TaxesPage = lazy(() => import('@/features/settings/pages/taxes-page'));
const PaymentMethodsPage = lazy(() => import('@/features/settings/pages/payment-methods-page'));
const NumberingPage = lazy(() => import('@/features/settings/pages/numbering-page'));
const UnitsPage = lazy(() => import('@/features/settings/pages/units-page'));
const PrintTemplatesPage = lazy(() => import('@/features/settings/pages/print-templates-page'));
const EmailPage = lazy(() => import('@/features/settings/pages/email-page'));
const PreferencesPage = lazy(() => import('@/features/settings/pages/preferences-page'));
const BackupsPage = lazy(() => import('@/features/settings/pages/backups-page'));

// Master data
const ProductsPage = lazy(() => import('@/features/products/pages/products-page'));
const ProductFormPage = lazy(() => import('@/features/products/pages/product-form-page'));
const CategoriesPage = lazy(() => import('@/features/products/pages/categories-page'));
const BrandsPage = lazy(() => import('@/features/products/pages/brands-page'));
const AttributesPage = lazy(() => import('@/features/products/pages/attributes-page'));
const LabelsPage = lazy(() => import('@/features/products/pages/labels-page'));
const PartiesPage = lazy(() => import('@/features/parties/pages/parties-page'));

// Inventory
const StockPage = lazy(() => import('@/features/inventory/pages/stock-page'));
const StockCardPage = lazy(() => import('@/features/inventory/pages/stock-card-page'));
const WarehousesStockPage = lazy(() => import('@/features/inventory/pages/warehouses-stock-page'));
const AdjustmentsPage = lazy(() => import('@/features/inventory/pages/adjustments-page'));
const AdjustmentFormPage = lazy(() => import('@/features/inventory/pages/adjustment-form-page'));
const TransfersPage = lazy(() => import('@/features/inventory/pages/transfers-page'));
const TransferFormPage = lazy(() => import('@/features/inventory/pages/transfer-form-page'));
const CountsPage = lazy(() => import('@/features/inventory/pages/counts-page'));
const CountSheetPage = lazy(() => import('@/features/inventory/pages/count-sheet-page'));
const MovementsPage = lazy(() => import('@/features/inventory/pages/movements-page'));
const SerialsPage = lazy(() => import('@/features/inventory/pages/serials-page'));
const InventoryReportsPage = lazy(() => import('@/features/inventory/pages/reports-page'));
const InventorySettingsPage = lazy(() => import('@/features/settings/pages/inventory-settings-page'));
const PurchaseSettingsPage = lazy(() => import('@/features/settings/pages/purchase-settings-page'));
const SalesSettingsPage = lazy(() => import('@/features/settings/pages/sales-settings-page'));
const PosSettingsPage = lazy(() => import('@/features/settings/pages/pos-settings-page'));
// POS
const PosPage = lazy(() => import('@/features/pos/pages/pos-page'));
const PosSessionsPage = lazy(() => import('@/features/pos/pages/sessions-page'));

// Sales
const QuotationsPage = lazy(() => import('@/features/sales/pages/quotations-page'));
const QuotationFormPage = lazy(() => import('@/features/sales/pages/quotation-form-page'));
const SalesOrdersPage = lazy(() => import('@/features/sales/pages/orders-page'));
const SalesOrderFormPage = lazy(() => import('@/features/sales/pages/order-form-page'));
const ChallansPage = lazy(() => import('@/features/sales/pages/challans-page'));
const ChallanFormPage = lazy(() => import('@/features/sales/pages/challan-form-page'));
const InvoicesPage = lazy(() => import('@/features/sales/pages/invoices-page'));
const InvoiceFormPage = lazy(() => import('@/features/sales/pages/invoice-form-page'));
const CustomerReceiptsPage = lazy(() => import('@/features/sales/pages/receipts-page'));
const CustomerReceiptPage = lazy(() => import('@/features/sales/pages/receipt-page'));
const SalesReturnsPage = lazy(() => import('@/features/sales/pages/returns-page'));
const SalesReturnFormPage = lazy(() => import('@/features/sales/pages/return-form-page'));
const ReceivablesPage = lazy(() => import('@/features/sales/pages/receivables-page'));
const CustomerLedgerPage = lazy(() => import('@/features/sales/pages/customer-ledger-page'));
const PriceListsPage = lazy(() => import('@/features/sales/pages/price-lists-page'));
const PriceListFormPage = lazy(() => import('@/features/sales/pages/price-list-form-page'));
const RecurringPage = lazy(() => import('@/features/sales/pages/recurring-page'));

// Purchase
const RequisitionsPage = lazy(() => import('@/features/purchase/pages/requisitions-page'));
const RequisitionFormPage = lazy(() => import('@/features/purchase/pages/requisition-form-page'));
const RfqsPage = lazy(() => import('@/features/purchase/pages/rfqs-page'));
const RfqPage = lazy(() => import('@/features/purchase/pages/rfq-page'));
const OrdersPage = lazy(() => import('@/features/purchase/pages/orders-page'));
const OrderFormPage = lazy(() => import('@/features/purchase/pages/order-form-page'));
const ReceiptsPage = lazy(() => import('@/features/purchase/pages/receipts-page'));
const ReceiptFormPage = lazy(() => import('@/features/purchase/pages/receipt-form-page'));
const BillsPage = lazy(() => import('@/features/purchase/pages/bills-page'));
const BillFormPage = lazy(() => import('@/features/purchase/pages/bill-form-page'));
const PaymentsPage = lazy(() => import('@/features/purchase/pages/payments-page'));
const PaymentPage = lazy(() => import('@/features/purchase/pages/payment-page'));
const ReturnsPage = lazy(() => import('@/features/purchase/pages/returns-page'));
const ReturnFormPage = lazy(() => import('@/features/purchase/pages/return-form-page'));
const PayablesPage = lazy(() => import('@/features/purchase/pages/payables-page'));
const SupplierLedgerPage = lazy(() => import('@/features/purchase/pages/supplier-ledger-page'));

// Accounting
const AccountsPage = lazy(() => import('@/features/accounting/pages/accounts-page'));
const JournalsPage = lazy(() => import('@/features/accounting/pages/journals-page'));
const JournalPage = lazy(() => import('@/features/accounting/pages/journal-page'));
const OpeningBalancesPage = lazy(() => import('@/features/accounting/pages/opening-balances-page'));
const FiscalYearsPage = lazy(() => import('@/features/accounting/pages/fiscal-years-page'));
const LedgerHealthPage = lazy(() => import('@/features/accounting/pages/ledger-health-page'));
const AccountingSettingsPage = lazy(() => import('@/features/settings/pages/accounting-settings-page'));
const BankAccountsPage = lazy(() => import('@/features/accounting/pages/bank-accounts-page'));
const VouchersPage = lazy(() => import('@/features/accounting/pages/vouchers-page'));
const VoucherPage = lazy(() => import('@/features/accounting/pages/voucher-page'));
const ExpensesPage = lazy(() => import('@/features/accounting/pages/expenses-page'));
const ExpensePage = lazy(() => import('@/features/accounting/pages/expense-page'));
const ExpenseCategoriesPage = lazy(() => import('@/features/accounting/pages/expense-categories-page'));
const ChequesPage = lazy(() => import('@/features/accounting/pages/cheques-page'));
const ReconciliationsPage = lazy(() => import('@/features/accounting/pages/reconciliations-page'));
const ReconciliationPage = lazy(() => import('@/features/accounting/pages/reconciliation-page'));
const FinancialReportsPage = lazy(() => import('@/features/accounting/pages/reports-page'));
const FinancialReportPage = lazy(() => import('@/features/accounting/pages/report-page'));
const MoOrdersPage = lazy(() => import('@/features/manufacturing/pages/orders-page'));
const MoOrderPage = lazy(() => import('@/features/manufacturing/pages/order-page'));
const MoOrderFormPage = lazy(() => import('@/features/manufacturing/pages/order-form-page'));
const BomsPage = lazy(() => import('@/features/manufacturing/pages/boms-page'));
const BomPage = lazy(() => import('@/features/manufacturing/pages/bom-page'));
const WorkCentersPage = lazy(() => import('@/features/manufacturing/pages/work-centers-page'));
const MrpPage = lazy(() => import('@/features/manufacturing/pages/mrp-page'));
const ProductionBoardPage = lazy(() => import('@/features/manufacturing/pages/board-page'));
const ProductionSchedulePage = lazy(() => import('@/features/manufacturing/pages/schedule-page'));
const ManufacturingReportsPage = lazy(() => import('@/features/manufacturing/pages/reports-page'));

const guard = (permission: string | string[], element: ReactNode) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
);

const settingsRoutes: RouteObject = {
  path: 'settings',
  element: <SettingsLayout />,
  children: [
    { index: true, element: <Navigate to="company" replace /> },
    { path: 'company', element: guard('settings.view', <CompanyPage />) },
    { path: 'branches', element: guard('settings.view', <BranchesPage />) },
    { path: 'warehouses', element: guard('settings.view', <WarehousesPage />) },
    { path: 'financial', element: guard('settings.view', <FinancialPage />) },
    { path: 'currencies', element: guard('settings.view', <CurrenciesPage />) },
    { path: 'taxes', element: guard('settings.view', <TaxesPage />) },
    { path: 'payment-methods', element: guard('settings.view', <PaymentMethodsPage />) },
    { path: 'numbering', element: guard('settings.view', <NumberingPage />) },
    { path: 'units', element: guard('settings.view', <UnitsPage />) },
    { path: 'inventory', element: guard('settings.view', <InventorySettingsPage />) },
    { path: 'sales', element: guard('settings.view', <SalesSettingsPage />) },
    { path: 'pos', element: guard('settings.view', <PosSettingsPage />) },
    { path: 'purchase', element: guard('settings.view', <PurchaseSettingsPage />) },
    { path: 'accounting', element: guard(['accounting.view', 'settings.view'], <AccountingSettingsPage />) },
    { path: 'print-templates', element: guard('settings.view', <PrintTemplatesPage />) },
    { path: 'email', element: guard('settings.view', <EmailPage />) },
    { path: 'preferences', element: guard('settings.view', <PreferencesPage />) },
    {
      path: 'backups',
      element: (
        <RequirePermission superAdmin>
          <BackupsPage />
        </RequirePermission>
      ),
    },
    { path: 'users', element: guard('users.view', <UsersPage />) },
    { path: 'roles', element: guard('users.view', <RolesPage />) },
    { path: 'roles/:id', element: guard('users.view', <RolePermissionsPage />) },
  ],
};

/** Built module routes (lazy-loaded, permission-guarded). */
const moduleRoutes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: 'profile', element: <ProfilePage /> },
  settingsRoutes,
  { path: 'inventory/products', element: guard('products.view', <ProductsPage />) },
  { path: 'inventory/products/new', element: guard('products.create', <ProductFormPage />) },
  { path: 'inventory/products/:id', element: guard('products.view', <ProductFormPage />) },
  { path: 'inventory/categories', element: guard('products.view', <CategoriesPage />) },
  { path: 'inventory/brands', element: guard('products.view', <BrandsPage />) },
  { path: 'inventory/attributes', element: guard('products.view', <AttributesPage />) },
  { path: 'inventory/labels', element: guard('products.print', <LabelsPage />) },
  { path: 'inventory/stock', element: guard('inventory.view', <StockPage />) },
  { path: 'inventory/stock/:productId', element: guard('inventory.view', <StockCardPage />) },
  { path: 'inventory/warehouses', element: guard('inventory.view', <WarehousesStockPage />) },
  { path: 'inventory/adjustments', element: guard('inventory.view', <AdjustmentsPage />) },
  { path: 'inventory/adjustments/new', element: guard('inventory.create', <AdjustmentFormPage key="new" />) },
  { path: 'inventory/adjustments/:id', element: guard('inventory.view', <AdjustmentFormPage />) },
  { path: 'inventory/transfers', element: guard('inventory.view', <TransfersPage />) },
  { path: 'inventory/transfers/new', element: guard('inventory.create', <TransferFormPage key="new" />) },
  { path: 'inventory/transfers/:id', element: guard('inventory.view', <TransferFormPage />) },
  { path: 'inventory/counts', element: guard('inventory.view', <CountsPage />) },
  { path: 'inventory/counts/:id', element: guard('inventory.view', <CountSheetPage />) },
  { path: 'inventory/movements', element: guard('inventory.view', <MovementsPage />) },
  { path: 'inventory/serials', element: guard('inventory.view', <SerialsPage />) },
  { path: 'inventory/reports', element: guard('inventory.view', <InventoryReportsPage />) },
  { path: 'sales/customers', element: guard('sales.view', <PartiesPage key="customer" type="customer" />) },
  { path: 'sales/customers/:customerId/ledger', element: guard('sales.view', <CustomerLedgerPage />) },
  { path: 'sales/quotations', element: guard('sales.view', <QuotationsPage />) },
  { path: 'sales/quotations/new', element: guard('sales.create', <QuotationFormPage key="new" />) },
  { path: 'sales/quotations/:id', element: guard('sales.view', <QuotationFormPage />) },
  { path: 'sales/orders', element: guard('sales.view', <SalesOrdersPage />) },
  { path: 'sales/orders/new', element: guard('sales.create', <SalesOrderFormPage key="new" />) },
  { path: 'sales/orders/:id', element: guard('sales.view', <SalesOrderFormPage />) },
  { path: 'sales/challans', element: guard('sales.view', <ChallansPage />) },
  { path: 'sales/challans/new', element: guard('sales.create', <ChallanFormPage key="new" />) },
  { path: 'sales/challans/:id', element: guard('sales.view', <ChallanFormPage />) },
  { path: 'sales/invoices', element: guard('sales.view', <InvoicesPage />) },
  { path: 'sales/invoices/new', element: guard('sales.create', <InvoiceFormPage key="new" />) },
  { path: 'sales/invoices/:id', element: guard('sales.view', <InvoiceFormPage />) },
  { path: 'sales/receipts', element: guard(['sales.view', 'accounting.view'], <CustomerReceiptsPage />) },
  {
    path: 'sales/receipts/new',
    element: guard(['sales.create', 'accounting.create'], <CustomerReceiptPage key="new" />),
  },
  { path: 'sales/receipts/:id', element: guard(['sales.view', 'accounting.view'], <CustomerReceiptPage />) },
  { path: 'sales/returns', element: guard('sales.view', <SalesReturnsPage />) },
  { path: 'sales/returns/new', element: guard('sales.create', <SalesReturnFormPage key="new" />) },
  { path: 'sales/returns/:id', element: guard('sales.view', <SalesReturnFormPage />) },
  { path: 'sales/receivables', element: guard(['sales.view', 'accounting.view'], <ReceivablesPage />) },
  { path: 'sales/price-lists', element: guard('sales.view', <PriceListsPage />) },
  { path: 'sales/price-lists/new', element: guard('sales.create', <PriceListFormPage key="new" />) },
  { path: 'sales/price-lists/:id', element: guard('sales.view', <PriceListFormPage />) },
  { path: 'sales/recurring', element: guard('sales.view', <RecurringPage />) },
  { path: 'sales/pos-sessions', element: guard(['pos.view', 'sales.view'], <PosSessionsPage />) },
  { path: 'purchases/requisitions', element: guard('purchase.view', <RequisitionsPage />) },
  {
    path: 'purchases/requisitions/new',
    element: guard('purchase.create', <RequisitionFormPage key="new" />),
  },
  { path: 'purchases/requisitions/:id', element: guard('purchase.view', <RequisitionFormPage />) },
  { path: 'purchases/rfqs', element: guard('purchase.view', <RfqsPage />) },
  { path: 'purchases/rfqs/new', element: guard('purchase.create', <RfqPage key="new" />) },
  { path: 'purchases/rfqs/:id', element: guard('purchase.view', <RfqPage />) },
  { path: 'purchases/orders', element: guard('purchase.view', <OrdersPage />) },
  { path: 'purchases/orders/new', element: guard('purchase.create', <OrderFormPage key="new" />) },
  { path: 'purchases/orders/:id', element: guard('purchase.view', <OrderFormPage />) },
  { path: 'purchases/receipts', element: guard('purchase.view', <ReceiptsPage />) },
  { path: 'purchases/receipts/new', element: guard('purchase.create', <ReceiptFormPage key="new" />) },
  { path: 'purchases/receipts/:id', element: guard('purchase.view', <ReceiptFormPage />) },
  { path: 'purchases/bills', element: guard('purchase.view', <BillsPage />) },
  { path: 'purchases/bills/new', element: guard('purchase.create', <BillFormPage key="new" />) },
  { path: 'purchases/bills/:id', element: guard('purchase.view', <BillFormPage />) },
  { path: 'purchases/payments', element: guard('purchase.view', <PaymentsPage />) },
  { path: 'purchases/payments/new', element: guard('purchase.create', <PaymentPage key="new" />) },
  { path: 'purchases/payments/:id', element: guard('purchase.view', <PaymentPage />) },
  { path: 'purchases/returns', element: guard('purchase.view', <ReturnsPage />) },
  { path: 'purchases/returns/new', element: guard('purchase.create', <ReturnFormPage key="new" />) },
  { path: 'purchases/returns/:id', element: guard('purchase.view', <ReturnFormPage />) },
  { path: 'purchases/payables', element: guard('purchase.view', <PayablesPage />) },
  { path: 'purchases/suppliers/:supplierId/ledger', element: guard('purchase.view', <SupplierLedgerPage />) },
  {
    path: 'purchases/suppliers',
    element: guard('purchase.view', <PartiesPage key="supplier" type="supplier" />),
  },
  { path: 'accounting/accounts', element: guard('accounting.view', <AccountsPage />) },
  { path: 'accounting/journals', element: guard('accounting.view', <JournalsPage />) },
  { path: 'accounting/journals/new', element: guard('accounting.create', <JournalPage key="new" />) },
  { path: 'accounting/journals/:id', element: guard('accounting.view', <JournalPage />) },
  { path: 'accounting/opening-balances', element: guard('accounting.view', <OpeningBalancesPage />) },
  { path: 'accounting/fiscal-years', element: guard('accounting.view', <FiscalYearsPage />) },
  { path: 'accounting/health', element: guard('accounting.view', <LedgerHealthPage />) },
  { path: 'accounting/bank-accounts', element: guard('accounting.view', <BankAccountsPage />) },
  { path: 'accounting/vouchers', element: guard('accounting.view', <VouchersPage />) },
  { path: 'accounting/vouchers/new', element: guard('accounting.create', <VoucherPage key="new" />) },
  { path: 'accounting/vouchers/:id', element: guard('accounting.view', <VoucherPage />) },
  { path: 'accounting/expenses', element: guard('accounting.view', <ExpensesPage />) },
  { path: 'accounting/expenses/new', element: guard('accounting.create', <ExpensePage key="new" />) },
  { path: 'accounting/expenses/:id', element: guard('accounting.view', <ExpensePage />) },
  { path: 'accounting/expense-categories', element: guard('accounting.view', <ExpenseCategoriesPage />) },
  { path: 'accounting/cheques', element: guard('accounting.view', <ChequesPage />) },
  { path: 'accounting/reconciliations', element: guard('accounting.view', <ReconciliationsPage />) },
  { path: 'accounting/reconciliations/:id', element: guard('accounting.view', <ReconciliationPage />) },
  { path: 'accounting/reports', element: guard('accounting.view', <FinancialReportsPage />) },
  { path: 'accounting/reports/:report', element: guard('accounting.view', <FinancialReportPage />) },
  { path: 'manufacturing/orders', element: guard('manufacturing.view', <MoOrdersPage />) },
  { path: 'manufacturing/orders/new', element: guard('manufacturing.create', <MoOrderFormPage key="new" />) },
  { path: 'manufacturing/orders/:id', element: guard('manufacturing.view', <MoOrderPage />) },
  { path: 'manufacturing/orders/:id/edit', element: guard('manufacturing.update', <MoOrderFormPage />) },
  { path: 'manufacturing/boms', element: guard('manufacturing.view', <BomsPage />) },
  { path: 'manufacturing/boms/new', element: guard('manufacturing.create', <BomPage key="new" />) },
  { path: 'manufacturing/boms/:id', element: guard('manufacturing.view', <BomPage />) },
  { path: 'manufacturing/work-centers', element: guard('manufacturing.view', <WorkCentersPage />) },
  { path: 'manufacturing/mrp', element: guard('manufacturing.view', <MrpPage />) },
  { path: 'manufacturing/board', element: guard('manufacturing.view', <ProductionBoardPage />) },
  { path: 'manufacturing/schedule', element: guard('manufacturing.view', <ProductionSchedulePage />) },
  { path: 'manufacturing/reports', element: guard('manufacturing.view', <ManufacturingReportsPage />) },
];

const builtPaths = new Set([
  '/',
  '/settings',
  '/settings/users',
  '/settings/roles',
  '/inventory/products',
  '/inventory/categories',
  '/inventory/brands',
  '/inventory/attributes',
  '/inventory/labels',
  '/inventory/stock',
  '/inventory/warehouses',
  '/inventory/adjustments',
  '/inventory/transfers',
  '/inventory/counts',
  '/inventory/movements',
  '/inventory/serials',
  '/inventory/reports',
  '/sales/customers',
  '/sales/quotations',
  '/sales/orders',
  '/sales/challans',
  '/sales/invoices',
  '/sales/receipts',
  '/sales/returns',
  '/sales/receivables',
  '/sales/price-lists',
  '/sales/recurring',
  '/sales/pos-sessions',
  '/pos',
  '/purchases/suppliers',
  '/purchases/requisitions',
  '/purchases/rfqs',
  '/purchases/orders',
  '/purchases/receipts',
  '/purchases/bills',
  '/purchases/payments',
  '/purchases/returns',
  '/purchases/payables',
  '/accounting/accounts',
  '/accounting/journals',
  '/accounting/opening-balances',
  '/accounting/fiscal-years',
  '/accounting/health',
  '/accounting/bank-accounts',
  '/accounting/vouchers',
  '/accounting/expenses',
  '/accounting/cheques',
  '/accounting/reconciliations',
  '/accounting/reports',
  '/manufacturing/orders',
  '/manufacturing/boms',
  '/manufacturing/work-centers',
  '/manufacturing/mrp',
  '/manufacturing/board',
  '/manufacturing/schedule',
  '/manufacturing/reports',
]);

/** Nav items whose module isn't built yet get a "coming soon" placeholder. */
const placeholderRoutes: RouteObject[] = ALL_NAV_ITEMS.filter((item) => !builtPaths.has(item.path)).map(
  (item) => ({
    path: item.path.slice(1),
    element: (
      <RequirePermission permission={item.permission}>
        <ComingSoonPage item={item} group={item.group} />
      </RequirePermission>
    ),
  }),
);

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password/:token', element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          // Full-screen POS, outside the app layout.
          {
            path: 'pos',
            element: <Suspense fallback={<FullScreenLoader />}>{guard('pos.view', <PosPage />)}</Suspense>,
          },
          {
            path: '/',
            element: <AppLayout />,
            children: [...moduleRoutes, ...placeholderRoutes, { path: '*', element: <NotFoundPage /> }],
          },
        ],
      },
    ],
  },
]);
