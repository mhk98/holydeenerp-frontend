/** Mirrors the server's standard response envelope. */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
}

/** Query params accepted by every list endpoint (see backend src/utils/pagination.js). */
export interface ListParams {
  page?: number;
  limit?: number;
  /** "field" for ASC, "-field" for DESC, comma-separated for multiple. */
  sort?: string;
  search?: string;
  [filter: string]: string | number | undefined;
}

export interface Paginated<T> {
  rows: T[];
  meta: PaginationMeta;
}

export type Language = 'en' | 'bn';
export type UserStatus = 'active' | 'inactive';

export interface Branch {
  id: string;
  name: string;
  code: string;
  isHeadOffice?: boolean;
  isDefault?: boolean;
}

export interface RoleRef {
  id: string;
  name: string;
  slug: string;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
}

/** The signed-in user (POST /auth/login, /auth/refresh, GET /auth/me). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  language: Language;
  status: UserStatus;
  companyId: string;
  company: Company;
  roles: RoleRef[];
  /** Permission keys like "sales.create"; "*" grants everything (Super Admin). */
  permissions: string[];
  branches: Branch[];
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
}

/** A user as managed on the Users page. */
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  language: Language;
  twoFactorEnabled: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleRef[];
  branches: Branch[];
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isSuperAdmin: boolean;
  usersCount: number;
  permissionsCount: number;
  permissionKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PermissionCatalog {
  modules: string[];
  actions: string[];
  permissions: { key: string; module: string; action: string }[];
}

// ── Settings ───────────────────────────────────────────────────────────────

/** Columns every tenant record carries. */
export interface Audited {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string | null;
  code: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  binNo: string | null;
  tinNo: string | null;
  vatRegNo: string | null;
  logoUrl: string | null;
  timezone: string;
  updatedAt: string;
}

export interface BranchRecord extends Audited {
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
}

export interface Warehouse extends Audited {
  branchId: string;
  branch: { id: string; name: string; code: string };
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface Currency extends Audited {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBase: boolean;
  isActive: boolean;
  latestRate: { rate: string; effectiveDate: string } | null;
}

export interface ExchangeRate extends Audited {
  currencyId: string;
  rate: string;
  effectiveDate: string;
}

export type TaxType = 'vat' | 'sd' | 'ait' | 'other';

export interface TaxRate extends Audited {
  name: string;
  code: string;
  type: TaxType;
  rate: string;
  description: string | null;
  isActive: boolean;
}

export interface TaxGroupRate {
  id: string;
  name: string;
  code: string;
  type: TaxType;
  rate: string;
  sequence: number;
  isCompound: boolean;
}

export interface TaxGroup extends Audited {
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  rates: TaxGroupRate[];
  effectiveRate: string;
}

export interface TaxBreakdown {
  inclusive: boolean;
  netAmount: string;
  totalTax: string;
  total: string;
  effectiveRate: string;
  taxes: {
    id: string | null;
    name: string | null;
    rate: string;
    isCompound: boolean;
    taxableAmount: string;
    amount: string;
  }[];
}

export interface DocumentSequence extends Audited {
  docType: string;
  name: string;
  branchId: string | null;
  branch: { id: string; name: string; code: string } | null;
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
  resetYearly: boolean;
  currentYear: number | null;
  isActive: boolean;
}

export type UnitCategory = 'count' | 'weight' | 'volume' | 'length' | 'area' | 'time' | 'other';

export interface Unit extends Audited {
  name: string;
  code: string;
  category: UnitCategory;
  allowDecimal: boolean;
  isActive: boolean;
}

export interface UnitConversion extends Audited {
  fromUnitId: string;
  toUnitId: string;
  factor: string;
  fromUnit: { id: string; name: string; code: string };
  toUnit: { id: string; name: string; code: string };
}

export type PaymentType = 'cash' | 'card' | 'mobile_wallet' | 'bank_transfer' | 'cheque' | 'other';

export interface PaymentMethod extends Audited {
  name: string;
  code: string;
  type: PaymentType;
  provider: string | null;
  accountNumber: string | null;
  requiresReference: boolean;
  sortOrder: number;
  isActive: boolean;
}

export type PaperSize = 'a4' | 'thermal_80';

export interface PrintTemplateOptions {
  title: string;
  showLogo: boolean;
  showCompanyAddress: boolean;
  showBin: boolean;
  showVatRegNo: boolean;
  showMushakRef: boolean;
  showCustomerDetails: boolean;
  showTaxBreakdown: boolean;
  showAmountInWords: boolean;
  showSignature: boolean;
  showBarcode: boolean;
  accentColor: string;
  fontSize: 'sm' | 'md' | 'lg';
  headerText: string;
}

export interface PrintTemplate extends Audited {
  name: string;
  docType: string;
  paper: PaperSize;
  isDefault: boolean;
  options: PrintTemplateOptions;
  terms: string | null;
  footerNote: string | null;
}

export interface Backup {
  id: string;
  fileName: string;
  sizeBytes: string;
  type: 'manual' | 'scheduled';
  status: 'running' | 'completed' | 'failed';
  tablesCount: number;
  rowsCount: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  fileExists: boolean;
  creator: { id: string; name: string } | null;
}

export interface FinancialSettings {
  baseCurrency: string;
  multiCurrency: boolean;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  amountDecimals: number;
  quantityDecimals: number;
  pricesIncludeTax: boolean;
}

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD MMM YYYY' | 'DD-MM-YYYY';
export type ThemeColor = 'neutral' | 'blue' | 'emerald' | 'violet' | 'orange' | 'rose';

export interface SystemSettings {
  dateFormat: DateFormat;
  timeFormat: '12h' | '24h';
  timezone: string;
  language: Language;
  themeColor: ThemeColor;
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
}

export interface BackupSchedule {
  scheduleEnabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string;
  weekday: number;
  retention: number;
}

export interface InventorySettings {
  costingMethod: 'fifo' | 'weighted_average';
  allowNegativeStock: boolean;
  requireApproval: boolean;
  nearExpiryDays: number;
  slowMovingDays: number;
  deadStockDays: number;
}

export interface AppConfig {
  company: { id: string; name: string; code: string; logoUrl: string | null; binNo: string | null } | null;
  financial: FinancialSettings;
  system: SystemSettings;
  inventory: InventorySettings;
  baseCurrency: { code: string; symbol: string; decimalPlaces: number } | null;
}

// ── Master data ────────────────────────────────────────────────────────────

export interface Ref {
  id: string;
  name: string;
  code: string;
}

export interface ProductCategory extends Audited {
  name: string;
  code: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryNode extends ProductCategory {
  productCount: number;
  children: CategoryNode[];
}

export interface Brand extends Audited {
  name: string;
  code: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

export interface ProductAttribute extends Audited {
  name: string;
  sortOrder: number;
  values: { id: string; value: string; sortOrder: number }[];
}

export type ProductType = 'raw_material' | 'finished_good' | 'consumable' | 'service';
export type BarcodeType = 'EAN13' | 'CODE128';

export interface ProductUnit {
  id: string;
  unitId: string;
  unit?: Ref;
  factor: string;
  barcode: string | null;
  purchasePrice: string | null;
  salePrice: string | null;
  isDefaultPurchase: boolean;
  isDefaultSale: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  purchasePrice: string | null;
  salePrice: string | null;
  isActive: boolean;
  attributeValueIds: string[];
  values: { id: string; value: string; attributeId: string; attribute: string }[];
}

export interface ProductImage {
  id: string;
  path: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product extends Audited {
  sku: string;
  name: string;
  type: ProductType;
  barcode: string | null;
  barcodeType: BarcodeType;
  categoryId: string | null;
  brandId: string | null;
  baseUnitId: string;
  taxGroupId: string | null;
  purchasePrice: string;
  salePrice: string;
  priceIncludesTax: boolean;
  reorderLevel: string;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  hasVariants: boolean;
  description: string | null;
  isActive: boolean;
  imageUrl: string | null;
  category: Ref | null;
  brand: Ref | null;
  baseUnit: Ref | null;
  taxGroup: Ref | null;
  units?: ProductUnit[];
  variants?: ProductVariant[];
  images?: ProductImage[];
}

export interface LabelProduct {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  barcodeType: BarcodeType;
  salePrice: string;
  hasVariants: boolean;
  variants: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    salePrice: string | null;
    isActive: boolean;
  }[];
}

export type PartyType = 'customer' | 'supplier';
export type AddressType = 'billing' | 'shipping' | 'other';

export interface PartyGroup extends Audited {
  type: PartyType;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

export interface PartyAddress {
  id?: string;
  type: AddressType;
  label: string | null;
  addressLine: string;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  isDefault: boolean;
}

export interface Party extends Audited {
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  binNo: string | null;
  tinNo: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  groupId: string | null;
  group: Ref | null;
  creditLimit: string;
  paymentTermsDays: number;
  openingBalance: string;
  openingBalanceType: 'debit' | 'credit';
  notes: string | null;
  isActive: boolean;
  alsoOtherRole: boolean;
  addresses: PartyAddress[];
  defaultAddress: PartyAddress | null;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  toCreate: number;
  toUpdate: number;
  errors: { row: number; messages: string[] }[];
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: { row: number; messages: string[] }[];
}

// ── Inventory ──────────────────────────────────────────────────────────────

export type StockStatus = 'in_stock' | 'low' | 'out' | 'negative';
export type AdjustmentKind = 'opening' | 'adjustment' | 'damage' | 'scrap';
export type AdjustmentStatus = 'draft' | 'pending_approval' | 'posted' | 'rejected' | 'cancelled';
export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';
export type CountStatus = 'counting' | 'pending_approval' | 'posted' | 'rejected' | 'cancelled';
export type SerialStatus = 'in_stock' | 'in_transit' | 'issued' | 'damaged' | 'scrapped' | 'written_off';
export type AdjustmentReason =
  | 'opening_balance'
  | 'found'
  | 'lost'
  | 'theft'
  | 'damaged'
  | 'expired'
  | 'scrap'
  | 'count_correction'
  | 'data_entry_error'
  | 'internal_use'
  | 'sample'
  | 'other';

export interface InventoryWarehouse {
  id: string;
  name: string;
  code: string;
  branchId: string;
  isDefault?: boolean;
  isActive?: boolean;
  branch: { id: string; name: string; code: string };
}

export interface UserRef {
  id: string;
  name: string;
}

/** One item (product or variant) in the stock overview. */
export interface StockRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  barcode: string | null;
  unitCode: string | null;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  reorderLevel: string;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  quantity: string;
  totalValue: string;
  avgCost: string;
  lastMovementAt: string | null;
  status: StockStatus;
}

export interface WarehouseStockSummary {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  branchId: string;
  branchName: string;
  itemsInStock: number;
  totalValue: string;
  lowCount: number;
  outCount: number;
  negativeCount: number;
  incomingValue: string;
}

export interface StockSummary {
  warehouses: WarehouseStockSummary[];
  totals: { totalValue: string; incomingValue: string; lowCount: number; outCount: number };
}

export interface ItemUnit {
  unitId: string;
  code: string;
  name: string;
  factor: string;
}

/** Result of /inventory/items/search — what a document line needs to know about an item. */
export interface StockItem {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  barcode: string | null;
  baseUnit: { id: string; code: string; name: string; allowDecimal?: boolean };
  units: ItemUnit[];
  matchedUnitId: string | null;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  lotTracked: boolean;
  purchasePrice: string;
  taxGroupId?: string | null;
  available?: string;
  avgCost?: string;
}

export interface StockBatchOption {
  id: string;
  batchNo: string;
  expiryDate: string | null;
  mfgDate: string | null;
  quantity: string;
}

interface LineProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  hasVariants: boolean;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  baseUnitId: string;
  baseUnit: { id: string; code: string; name: string } | null;
}

interface DocumentLine {
  id: string;
  productId: string;
  variantId: string | null;
  batchId: string | null;
  quantity: string;
  notes: string | null;
  product: LineProduct;
  variant: { id: string; name: string; sku: string } | null;
  batch: { id: string; batchNo: string; expiryDate: string | null; mfgDate: string | null } | null;
}

export interface StockAdjustmentItem extends DocumentLine {
  direction: 'in' | 'out';
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  unitId: string | null;
  unitFactor: string;
  baseQuantity: string;
  unitCost: string;
  totalCost: string;
  reason: AdjustmentReason | null;
  serialNumbers: string[];
  unit: { id: string; code: string; name: string } | null;
}

interface Workflow {
  creator: UserRef | null;
  submitter: UserRef | null;
  approver: UserRef | null;
  rejecter: UserRef | null;
  canceller: UserRef | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
}

export interface StockAdjustment extends Audited, Workflow {
  number: string;
  kind: AdjustmentKind;
  adjustmentDate: string;
  reason: AdjustmentReason | null;
  status: AdjustmentStatus;
  notes: string | null;
  totalValue: string;
  warehouseId: string;
  branchId: string;
  warehouse: { id: string; name: string; code: string; branchId: string };
  branch?: { id: string; name: string; code: string };
  itemsCount?: number;
  items?: StockAdjustmentItem[];
}

export interface StockTransferItem extends DocumentLine {
  unitId: string | null;
  unitFactor: string;
  baseQuantity: string;
  unitCost: string;
  totalCost: string;
  serialNumbers: string[];
  unit: { id: string; code: string; name: string } | null;
}

export interface StockTransfer extends Audited {
  number: string;
  transferDate: string;
  status: TransferStatus;
  notes: string | null;
  totalValue: string;
  branchId: string;
  toBranchId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse: { id: string; name: string; code: string; branchId: string };
  toWarehouse: { id: string; name: string; code: string; branchId: string };
  fromBranch?: { id: string; name: string; code: string };
  toBranch?: { id: string; name: string; code: string };
  creator: UserRef | null;
  dispatcher?: UserRef | null;
  receiver?: UserRef | null;
  canceller?: UserRef | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  itemsCount?: number;
  items?: StockTransferItem[];
}

export interface StockCountItem extends Omit<DocumentLine, 'quantity'> {
  systemQuantity: string;
  countedQuantity: string | null;
  varianceQuantity: string;
  unitCost: string;
  varianceValue: string;
}

export interface StockCount extends Audited, Workflow {
  number: string;
  countDate: string;
  status: CountStatus;
  notes: string | null;
  includeZero: boolean;
  varianceValue: string;
  warehouseId: string;
  branchId: string;
  warehouse: { id: string; name: string; code: string; branchId: string };
  category: { id: string; name: string } | null;
  itemsCount?: number;
  countedCount?: number;
  items?: StockCountItem[];
}

export interface StockMovement {
  id: string;
  movementDate: string;
  createdAt: string;
  movementType: string;
  referenceType: string;
  referenceId: string;
  referenceNo: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  balanceQuantity: string;
  balanceValue: string;
  notes: string | null;
  product: { id: string; name: string; sku: string };
  variant: { id: string; name: string; sku: string } | null;
  warehouse: { id: string; name: string; code: string };
  batch: { id: string; batchNo: string; expiryDate: string | null } | null;
  creator: UserRef | null;
}

export interface StockCardRow {
  id: string;
  movementDate: string;
  createdAt: string;
  movementType: string;
  referenceType: string;
  referenceId: string;
  referenceNo: string | null;
  warehouseId: string;
  warehouseName: string;
  variantId: string | null;
  variantName: string | null;
  batchId: string | null;
  batchNo: string | null;
  expiryDate: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  runningQuantity: string;
  runningValue: string;
  notes: string | null;
  userName: string | null;
}

export interface StockCard {
  product: ProductStock['product'];
  opening: { quantity: string; value: string };
  closing: { quantity: string; value: string };
  inQuantity: string;
  outQuantity: string;
  rows: StockCardRow[];
}

export interface ProductStock {
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    type: ProductType;
    hasVariants: boolean;
    trackBatch: boolean;
    trackSerial: boolean;
    trackExpiry: boolean;
    reorderLevel: string;
    purchasePrice: string;
    salePrice: string;
    isActive: boolean;
    baseUnit: { id: string; code: string; name: string } | null;
    variants: { id: string; name: string; sku: string; barcode: string | null; isActive: boolean }[];
  };
  totals: { quantity: string; totalValue: string; avgCost: string; status: StockStatus };
  balances: {
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
    variantId: string | null;
    variantName: string | null;
    quantity: string;
    avgCost: string;
    totalValue: string;
    lastMovementAt: string | null;
  }[];
  batches: {
    batchId: string;
    batchNo: string;
    expiryDate: string | null;
    mfgDate: string | null;
    warehouseId: string;
    warehouseName: string;
    variantId: string | null;
    quantity: string;
    totalValue: string;
  }[];
  serials: { warehouseId: string | null; status: SerialStatus; count: number }[];
}

export interface StockSerialRow {
  id: string;
  serialNo: string;
  status: SerialStatus;
  unitCost: string;
  updatedAt: string;
  product: { id: string; name: string; sku: string };
  variant: { id: string; name: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  batch: { id: string; batchNo: string; expiryDate: string | null } | null;
}

export interface ExpiringBatch {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  productId: string;
  name: string;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  unitCode: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: string;
  totalValue: string;
  daysLeft: number;
}

export interface StockAlerts {
  settings: { nearExpiryDays: number };
  counts: {
    lowStock: number;
    outOfStock: number;
    nearExpiry: number;
    expired: number;
    pendingApprovals: number;
    incomingTransfers: number;
  };
  lowStock: StockRow[];
  outOfStock: StockRow[];
  nearExpiry: ExpiringBatch[];
  expired: ExpiringBatch[];
}

export interface Report<Row, Summary> {
  rows: Row[];
  summary: Summary;
}

// ── Purchase ───────────────────────────────────────────────────────────────

export type RequisitionStatus =
  'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'cancelled';
export type RfqStatus = 'draft' | 'sent' | 'awarded' | 'cancelled';
export type PoStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'partially_received'
  | 'received'
  | 'billed'
  | 'closed'
  | 'cancelled';
export type ReceiptStatus = 'draft' | 'posted' | 'cancelled';
export type BillStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
export type PaymentStatus = 'posted' | 'void';
export type ReturnStatus = 'draft' | 'posted' | 'cancelled';
export type ReturnType = 'return' | 'debit_note';
export type LandedCostType = 'freight' | 'duty' | 'insurance' | 'handling' | 'other';

export interface SupplierRef {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  paymentTermsDays?: number;
}

/** A line of any purchase document (fields present depend on the document). */
export interface PurchaseLine {
  id: string;
  productId: string;
  variantId: string | null;
  unitId: string | null;
  unitFactor: string;
  quantity: string;
  baseQuantity: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    hasVariants: boolean;
    trackBatch: boolean;
    trackSerial: boolean;
    trackExpiry: boolean;
    baseUnitId: string;
    baseUnit: { id: string; code: string; name: string } | null;
  };
  variant: { id: string; name: string; sku: string } | null;
  unit: { id: string; code: string; name: string } | null;
  taxGroup?: { id: string; name: string; code: string } | null;
  unitPrice?: string;
  discountPercent?: string;
  taxGroupId?: string | null;
  taxAmount?: string;
  lineSubtotal?: string;
  lineTotal?: string;
  estimatedPrice?: string | null;
  requisitionItemId?: string | null;
  orderItemId?: string | null;
  receiptItemId?: string | null;
  billItemId?: string | null;
  receivedBaseQuantity?: string;
  billedBaseQuantity?: string;
  remainingBaseQuantity?: string;
  unbilledBaseQuantity?: string;
  orderedBaseQuantity?: string;
  returnedBaseQuantity?: string;
  lineValue?: string;
  landedCost?: string;
  unitCost?: string;
  stockCost?: string;
  batchId?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  mfgDate?: string | null;
  serialNumbers?: string[];
  batch?: { id: string; batchNo: string; expiryDate: string | null } | null;
}

interface PurchaseDocBase extends Audited {
  number: string;
  branchId: string;
  notes: string | null;
  creator: UserRef | null;
  branch?: { id: string; name: string; code: string };
  items?: PurchaseLine[];
}

export interface PurchaseTotals {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
}

export interface PurchaseApprovalEntry {
  id: string;
  level: number;
  levelName: string | null;
  action: 'approved' | 'rejected';
  note: string | null;
  createdAt: string;
  user: UserRef | null;
}

export interface ApprovalLevel {
  level?: number;
  name: string;
  minAmount: string;
  roleId: string | null;
}

export interface PurchaseRequisition extends PurchaseDocBase {
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string } | null;
  requisitionDate: string;
  requiredBy: string | null;
  status: RequisitionStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  submitter?: UserRef | null;
  approver?: UserRef | null;
  rejecter?: UserRef | null;
  canceller?: UserRef | null;
  itemsCount?: number;
}

export interface RfqQuote {
  id: string;
  rfqItemId: string;
  unitPrice: string;
  discountPercent: string;
  taxGroupId: string | null;
  notes: string | null;
}

export interface RfqSupplier {
  id: string;
  supplierId: string;
  status: 'invited' | 'quoted' | 'declined' | 'awarded';
  quoteDate: string | null;
  validUntil: string | null;
  deliveryDays: number | null;
  total: string;
  notes: string | null;
  supplier: SupplierRef;
  quotes: RfqQuote[];
}

export interface PurchaseRfq extends PurchaseDocBase {
  rfqDate: string;
  quoteDeadline: string | null;
  status: RfqStatus;
  sentAt: string | null;
  awardedAt: string | null;
  requisitionId: string | null;
  requisition: { id: string; number: string } | null;
  suppliers?: RfqSupplier[];
  bestQuotes?: Record<string, { unitPrice: string; rfqSupplierId: string }>;
  itemsCount?: number;
  suppliersCount?: number;
  quotedCount?: number;
}

export interface PurchaseOrder extends PurchaseDocBase, PurchaseTotals {
  supplierId: string;
  supplier: SupplierRef;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  orderDate: string;
  expectedDate: string | null;
  paymentTermsDays: number;
  supplierReference: string | null;
  status: PoStatus;
  terms: string | null;
  approvalPlan?: ApprovalLevel[];
  approvalLevel: number;
  nextApprovalLevel?: ApprovalLevel | null;
  approvals?: PurchaseApprovalEntry[];
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  emailedAt: string | null;
  submitter?: UserRef | null;
  closer?: UserRef | null;
  canceller?: UserRef | null;
  requisition?: { id: string; number: string } | null;
  rfq?: { id: string; number: string } | null;
  receipts?: { id: string; number: string; receiptDate: string; status: ReceiptStatus; totalCost: string }[];
  bills?: {
    id: string;
    number: string;
    billDate: string;
    status: BillStatus;
    total: string;
    paidAmount: string;
  }[];
  receivedPercent?: string;
}

export interface LandedCost {
  id: string;
  costType: LandedCostType;
  description: string | null;
  amount: string;
  allocation: 'value' | 'quantity';
}

export interface GoodsReceipt extends PurchaseDocBase {
  supplierId: string;
  supplier: SupplierRef;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  orderId: string | null;
  order: { id: string; number: string; status?: PoStatus } | null;
  receiptDate: string;
  supplierReference: string | null;
  status: ReceiptStatus;
  goodsValue: string;
  landedCostTotal: string;
  totalCost: string;
  postedAt: string | null;
  poster?: UserRef | null;
  costs?: LandedCost[];
}

export interface BillAllocation {
  id: string;
  sourceType: 'payment' | 'debit_note';
  sourceId: string;
  sourceNumber: string;
  sourceDate: string;
  amount: string;
}

export interface SupplierBill extends PurchaseDocBase, PurchaseTotals {
  supplierId: string;
  supplier: SupplierRef;
  orderId: string | null;
  receiptId: string | null;
  order: { id: string; number: string } | null;
  receipt?: { id: string; number: string } | null;
  supplierInvoiceNo: string | null;
  billDate: string;
  dueDate: string;
  status: BillStatus;
  paidAmount: string;
  balance: string;
  postedAt: string | null;
  poster?: UserRef | null;
  allocations?: BillAllocation[];
}

export interface SupplierPayment extends Audited {
  number: string;
  supplierId: string;
  supplier: SupplierRef;
  paymentMethodId: string;
  paymentMethod: { id: string; name: string; type: string; requiresReference?: boolean };
  paymentDate: string;
  amount: string;
  allocatedAmount: string;
  unallocated: string;
  reference: string | null;
  status: PaymentStatus;
  notes: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  creator: UserRef | null;
  voider?: UserRef | null;
  allocations?: {
    id: string;
    amount: string;
    bill: {
      id: string;
      number: string;
      billDate: string;
      dueDate: string;
      total: string;
      supplierInvoiceNo: string | null;
    };
  }[];
}

export interface PurchaseReturn extends PurchaseDocBase, PurchaseTotals {
  type: ReturnType;
  supplierId: string;
  supplier: SupplierRef;
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string } | null;
  receiptId: string | null;
  billId: string | null;
  receipt: { id: string; number: string } | null;
  bill: { id: string; number: string; total: string; paidAmount: string } | null;
  returnDate: string;
  reason: string | null;
  status: ReturnStatus;
  appliedAmount: string;
  unapplied: string;
  postedAt: string | null;
  poster?: UserRef | null;
}

export interface PurchaseLookups {
  taxGroups: { id: string; name: string; code: string; rate: string }[];
  paymentMethods: { id: string; name: string; code: string; type: string; requiresReference: boolean }[];
  roles: { id: string; name: string; slug: string }[];
  settings: {
    approvalLevels: ApprovalLevel[];
    requisitionApproval: boolean;
    overReceiptPercent: number;
    defaultPaymentTermsDays: number;
  };
}

export interface PurchaseSettings {
  approvalLevels: ApprovalLevel[];
  requisitionApproval: boolean;
  overReceiptPercent: number;
  defaultPaymentTermsDays: number;
  defaultTerms: string;
}

export interface SupplierLedgerEntry {
  type: 'bill' | 'payment' | 'return' | 'debit_note';
  id: string;
  number: string;
  date: string;
  reference: string | null;
  credit: string;
  debit: string;
  balance: string;
}

export interface SupplierLedger {
  supplier: SupplierRef & {
    creditLimit: string;
    openingBalance: string;
    openingBalanceType: 'debit' | 'credit';
  };
  opening: string;
  totalCredit: string;
  totalDebit: string;
  closing: string;
  entries: SupplierLedgerEntry[];
}

export interface AgingRow {
  supplierId: string;
  code: string;
  name: string;
  opening: string;
  credits: string;
  current: string;
  d0_30: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
  total: string;
  bills: number;
}

export interface PayablesAging {
  asOf: string;
  basis: 'due_date' | 'bill_date';
  rows: AgingRow[];
  totals: Record<
    'opening' | 'credits' | 'current' | 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus' | 'total',
    string
  >;
}

export interface OpenItems {
  supplier: SupplierRef;
  bills: {
    id: string;
    number: string;
    supplierInvoiceNo: string | null;
    billDate: string;
    dueDate: string;
    total: string;
    paidAmount: string;
    balance: string;
    status: BillStatus;
  }[];
  credits: {
    sourceType: 'payment' | 'debit_note';
    id: string;
    number: string;
    date: string;
    total: string;
    available: string;
  }[];
}

// ── Sales ──────────────────────────────────────────────────────────────────

export type DiscountType = 'percent' | 'amount';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted' | 'cancelled';
export type SalesOrderStatus = 'draft' | 'confirmed' | 'partially_delivered' | 'delivered' | 'invoiced' | 'closed' | 'cancelled';
export type ChallanStatus = 'draft' | 'posted' | 'cancelled';
export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
export type SalesReturnType = 'return' | 'credit_note';

export interface CustomerRef {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  paymentTermsDays?: number;
  creditLimit?: string;
  binNo?: string | null;
}

/** A line of any sales document (fields present depend on the document). */
export interface SalesLine extends Omit<PurchaseLine, 'discountPercent'> {
  discountType?: DiscountType;
  discountValue?: string;
  discountAmount?: string;
  documentDiscount?: string;
  priceIncludesTax?: boolean;
  challanItemId?: string | null;
  invoiceItemId?: string | null;
  deliveredBaseQuantity?: string;
  invoicedBaseQuantity?: string;
  undeliveredBaseQuantity?: string;
  uninvoicedBaseQuantity?: string;
  orderItem?: { id: string; baseQuantity: string; deliveredBaseQuantity: string } | null;
}

export interface SalesTotals {
  discountType: DiscountType;
  discountValue: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  roundOff: string;
  total: string;
}

interface SalesDocBase extends Audited {
  number: string;
  branchId: string;
  customerId: string;
  customer: CustomerRef;
  notes: string | null;
  creator: UserRef | null;
  branch?: { id: string; name: string; code: string };
  items?: SalesLine[];
}

export interface CreditOverrideEntry {
  id: string;
  creditLimit: string;
  outstanding: string;
  documentAmount: string;
  reason: string;
  createdAt: string;
  user?: UserRef | null;
}

export interface SalesQuotation extends SalesDocBase, SalesTotals {
  quotationDate: string;
  validUntil: string | null;
  status: QuotationStatus;
  customerReference: string | null;
  terms: string | null;
  sentAt: string | null;
  orders?: { id: string; number: string; status: SalesOrderStatus }[];
  invoices?: { id: string; number: string; status: InvoiceStatus }[];
}

export interface SalesOrder extends SalesDocBase, SalesTotals {
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  quotationId: string | null;
  quotation?: { id: string; number: string } | null;
  orderDate: string;
  deliveryDate: string | null;
  paymentTermsDays: number;
  customerReference: string | null;
  shippingAddress: string | null;
  status: SalesOrderStatus;
  terms: string | null;
  confirmedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  confirmer?: UserRef | null;
  closer?: UserRef | null;
  canceller?: UserRef | null;
  challans?: { id: string; number: string; challanDate: string; status: ChallanStatus }[];
  invoices?: { id: string; number: string; invoiceDate: string; status: InvoiceStatus; total: string }[];
  creditOverrides?: CreditOverrideEntry[];
  deliveredPercent?: string;
}

export interface DeliveryChallan extends SalesDocBase {
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  orderId: string | null;
  order: { id: string; number: string; status?: SalesOrderStatus } | null;
  challanDate: string;
  shippingAddress: string | null;
  vehicleNo: string | null;
  driverName: string | null;
  status: ChallanStatus;
  costTotal: string;
  postedAt: string | null;
  poster?: UserRef | null;
  invoices?: { id: string; number: string; status: InvoiceStatus; total: string }[];
  itemsCount?: number;
}

export interface ReceivableAllocationEntry {
  id: string;
  sourceType: 'receipt' | 'credit_note';
  sourceId: string;
  sourceNumber: string;
  sourceDate: string;
  amount: string;
}

export interface SalesInvoice extends SalesDocBase, SalesTotals {
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string } | null;
  orderId: string | null;
  challanId: string | null;
  quotationId: string | null;
  recurringId: string | null;
  order: { id: string; number: string } | null;
  challan?: { id: string; number: string } | null;
  quotation?: { id: string; number: string } | null;
  invoiceDate: string;
  dueDate: string;
  customerReference: string | null;
  status: InvoiceStatus;
  paidAmount: string;
  balance: string;
  costTotal: string;
  terms: string | null;
  postedAt: string | null;
  emailedAt: string | null;
  lastReminderAt: string | null;
  poster?: UserRef | null;
  allocations?: ReceivableAllocationEntry[];
  creditOverrides?: CreditOverrideEntry[];
  reminders?: { id: string; kind: 'manual' | 'before_due' | 'after_due'; offsetDays: number | null; sentTo: string; status: 'sent' | 'failed'; error: string | null; createdAt: string }[];
  returns?: { id: string; number: string; type: SalesReturnType; status: string; total: string }[];
}

export interface CustomerReceipt extends Audited {
  number: string;
  customerId: string;
  customer: CustomerRef;
  paymentMethodId: string;
  paymentMethod: { id: string; name: string; type: string; requiresReference?: boolean };
  receiptDate: string;
  amount: string;
  allocatedAmount: string;
  unallocated: string;
  reference: string | null;
  status: 'posted' | 'void';
  notes: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  creator: UserRef | null;
  voider?: UserRef | null;
  allocations?: { id: string; amount: string; invoice: { id: string; number: string; invoiceDate: string; dueDate: string; total: string } }[];
}

export interface SalesReturn extends SalesDocBase, SalesTotals {
  type: SalesReturnType;
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string } | null;
  invoiceId: string | null;
  invoice: { id: string; number: string; total: string; paidAmount: string; status: InvoiceStatus } | null;
  returnDate: string;
  reason: string | null;
  status: 'draft' | 'posted' | 'cancelled';
  appliedAmount: string;
  unapplied: string;
  postedAt: string | null;
  poster?: UserRef | null;
}

export interface PriceListItemRow {
  id: string;
  productId: string;
  variantId: string | null;
  unitId: string | null;
  price: string | null;
  discountPercent: string | null;
  minQuantity: string;
  product: PurchaseLine['product'];
  variant: { id: string; name: string; sku: string } | null;
  unit: { id: string; code: string; name: string } | null;
}

export interface PriceList extends Audited {
  name: string;
  code: string;
  customerGroupId: string | null;
  customerGroup: { id: string; name: string; code: string } | null;
  validFrom: string | null;
  validTo: string | null;
  priority: number;
  isActive: boolean;
  notes: string | null;
  itemsCount?: number;
  items?: PriceListItemRow[];
}

export interface RecurringInvoice extends Audited {
  name: string;
  customerId: string;
  customer: CustomerRef;
  branchId: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  intervalCount: number;
  nextRunDate: string;
  endDate: string | null;
  autoPost: boolean;
  autoEmail: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  lastInvoiceId: string | null;
  runsCount: number;
  lastError: string | null;
  total: string | null;
  itemsCount: number;
  sourceInvoiceId: string | null;
  creator: UserRef | null;
  invoices?: { id: string; number: string; invoiceDate: string; status: InvoiceStatus; total: string }[];
}

export interface SalesSettings {
  roundTo: 'none' | '0.5' | '1' | '5' | '10';
  roundingMode: 'nearest' | 'up' | 'down';
  creditCheck: boolean;
  defaultPaymentTermsDays: number;
  quotationValidityDays: number;
  defaultTerms: string;
  remindersEnabled: boolean;
  reminderDaysBefore: number[];
  reminderDaysAfter: number[];
}

export interface CustomerLedgerEntry {
  type: 'invoice' | 'receipt' | 'return' | 'credit_note' | 'refund';
  id: string;
  number: string;
  date: string;
  reference: string | null;
  debit: string;
  credit: string;
  balance: string;
}

export interface CustomerLedger {
  customer: CustomerRef & { openingBalance: string; openingBalanceType: 'debit' | 'credit' };
  opening: string;
  totalDebit: string;
  totalCredit: string;
  closing: string;
  creditAvailable: string | null;
  entries: CustomerLedgerEntry[];
}

export interface ReceivablesAgingRow {
  customerId: string;
  code: string;
  name: string;
  email: string | null;
  creditLimit: string;
  opening: string;
  credits: string;
  current: string;
  d0_30: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
  total: string;
  invoices: number;
}

export interface ReceivablesAging {
  asOf: string;
  basis: 'due_date' | 'invoice_date';
  rows: ReceivablesAgingRow[];
  totals: Record<'opening' | 'credits' | 'current' | 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus' | 'total', string>;
}

export interface CustomerOpenItems {
  customer: CustomerRef;
  invoices: { id: string; number: string; customerReference: string | null; invoiceDate: string; dueDate: string; total: string; paidAmount: string; balance: string; status: InvoiceStatus }[];
  credits: { sourceType: 'receipt' | 'credit_note'; id: string; number: string; date: string; total: string; available: string }[];
}

export interface ResolvedPrice {
  productId: string;
  variantId: string | null;
  unitId: string;
  unitPrice: string;
  standardPrice: string;
  taxGroupId: string | null;
  priceIncludesTax: boolean;
  source: { type: 'standard' } | { type: 'price_list'; id: string; name: string };
}
