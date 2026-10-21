import type { CustomerRef, SalesInvoice, UserRef } from '@/types';

export interface PosRegister {
  id: string;
  name: string;
  code: string;
  branchId: string;
  warehouseId: string;
  defaultCustomerId: string | null;
  receiptPaper: 'thermal_80' | 'a4';
  isActive: boolean;
  notes: string | null;
  branch: { id: string; name: string; code: string };
  warehouse: { id: string; name: string; code: string };
  defaultCustomer: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  openSession?: { id: string; number: string; openedAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRow {
  methodId: string;
  name: string;
  type: string;
  received: string;
  refunded: string;
  net: string;
}

export interface SessionReport {
  sales: {
    count: number;
    gross: string;
    discounts: string;
    tax: string;
    roundOff: string;
    total: string;
    cost: string;
    changeGiven: string;
    onAccount: string;
    itemsQuantity: string;
    products: number;
  };
  returns: { count: number; total: string };
  payments: PaymentRow[];
  cash: {
    opening: string;
    received: string;
    refunded: string;
    cashIn: string;
    cashOut: string;
    expected: string;
    counted?: string;
    variance?: string;
  };
  closedAt?: string;
}

export interface PosSession {
  id: string;
  number: string;
  status: 'open' | 'closed';
  registerId: string;
  branchId: string;
  openedAt: string;
  openingCash: string;
  openingNotes: string | null;
  closedAt: string | null;
  expectedCash: string;
  countedCash: string;
  variance: string;
  denominations: Record<string, number> | null;
  closingNotes: string | null;
  register: { id: string; name: string; code: string; warehouseId: string; branchId: string };
  opener: UserRef | null;
  closer: UserRef | null;
  cashMovements?: {
    id: string;
    type: 'in' | 'out';
    amount: string;
    reason: string;
    createdAt: string;
    creator: UserRef | null;
  }[];
  report?: SessionReport;
}

export interface PosSettings {
  denominations: number[];
  quickCash: number[];
  allowPriceEdit: boolean;
  maxDiscountPercent: number;
  autoPrint: boolean;
  receiptFooter: string;
  offlineEnabled: boolean;
}

export interface TaxGroupRates {
  id: string;
  name: string;
  rates: { name: string; rate: string; isCompound: boolean; sequence: number }[];
}

export interface PaymentMethodOption {
  id: string;
  name: string;
  code: string;
  type: 'cash' | 'card' | 'mobile_wallet' | 'bank_transfer' | 'cheque' | 'other';
  requiresReference: boolean;
}

export interface PosBootstrap {
  registers: PosRegister[];
  register: PosRegister | null;
  session: PosSession | null;
  settings: {
    pos: PosSettings;
    rounding: { roundTo: 'none' | '0.5' | '1' | '5' | '10'; roundingMode: 'nearest' | 'up' | 'down' };
    creditCheck: boolean;
    amountDecimals: number;
    currency: string;
  };
  paymentMethods: PaymentMethodOption[];
  taxGroups: TaxGroupRates[];
  categories: { id: string; name: string; parentId: string | null; sortOrder: number }[];
  company: ReceiptData['company'];
  serverTime: string;
}

export interface CatalogItem {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  image: string | null;
  baseUnit: { id: string; code: string; name: string; allowDecimal?: boolean };
  units: { unitId: string; code: string; factor: string; barcode: string | null; salePrice: string | null }[];
  price: string;
  taxGroupId: string | null;
  priceIncludesTax: boolean;
  lotTracked: boolean;
  trackSerial: boolean;
  stock: string;
}

export interface PosCatalog {
  registerId: string;
  warehouseId: string;
  items: CatalogItem[];
  generatedAt: string;
}

export interface PosCustomer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  customerGroupId: string | null;
  creditLimit: string;
}

export interface CartLine {
  id: string;
  item: CatalogItem;
  unitId: string;
  quantity: string;
  unitPrice: string;
  discountType: 'percent' | 'amount';
  discountValue: string;
  notes: string;
  serialNumbers: string[];
}

export interface PaymentLine {
  id: string;
  paymentMethodId: string;
  amount: string;
  reference: string;
}

/** Body of POST /pos/sales (also what the offline queue stores). */
export interface SalePayload {
  clientUuid: string;
  registerId: string;
  sessionId: string;
  customerId: string | null;
  discountType: 'percent' | 'amount';
  discountValue: string;
  notes: string | null;
  items: {
    productId: string;
    variantId: string | null;
    unitId: string;
    quantity: string;
    unitPrice: string;
    discountType: 'percent' | 'amount';
    discountValue: string;
    taxGroupId: string | null;
    priceIncludesTax: boolean;
    serialNumbers?: string[];
    notes: string | null;
  }[];
  payments: { paymentMethodId: string; amount: string; reference: string | null }[];
  credits: { returnId: string; amount: string }[];
  offline?: { number: string; soldAt: string };
}

export interface ReceiptData {
  invoice: SalesInvoice & {
    channel: 'pos' | 'backoffice';
    offlineNumber: string | null;
    tendered: string;
    changeAmount: string;
    stockWarning: boolean;
    posSession?: { id: string; number: string; registerId: string } | null;
  };
  payments: { method: string; type: string; amount: string; reference: string | null }[];
  paid: string;
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    binNo: string | null;
    logoUrl: string | null;
  };
  amountInWords: { en: string; bn: string };
  footer: string;
  returnable?: { invoiceItemId: string; returnableBaseQuantity: string; unitRefund: string }[];
}

export interface HeldOrder {
  id: string;
  label: string;
  customerId: string | null;
  customer: { id: string; code: string; name: string } | null;
  cart: HeldCart;
  total: string;
  createdAt: string;
  creator: UserRef | null;
}

export interface HeldCart {
  lines: CartLine[];
  customer: PosCustomer | null;
  discountType: 'percent' | 'amount';
  discountValue: string;
  notes: string;
}

export interface PosReturnResult {
  id: string;
  number: string;
  total: string;
  refundedAmount: string;
  credit: string;
  customerId: string;
  refundMethod: { id: string; name: string; type: string } | null;
}

export type { CustomerRef };
