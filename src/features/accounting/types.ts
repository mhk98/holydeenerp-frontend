export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

/** Categories per type (mirrors the API's ACCOUNT_SUBTYPES). */
export const ACCOUNT_SUBTYPES: Record<AccountType, string[]> = {
  asset: ['cash', 'bank', 'receivable', 'inventory', 'tax', 'current_asset', 'fixed_asset', 'contra_asset'],
  liability: ['payable', 'tax', 'current_liability', 'long_term_liability'],
  equity: ['equity', 'retained_earnings'],
  income: ['revenue', 'contra_revenue', 'other_income'],
  expense: ['cogs', 'expense', 'other_expense'],
};

export interface Account {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  nameBn: string | null;
  type: AccountType;
  subtype: string;
  isGroup: boolean;
  systemKey: string | null;
  isSystem: boolean;
  isActive: boolean;
  description: string | null;
}

export interface AccountNode extends Account {
  /** Natural-sign balance (when asked for). */
  balance?: string;
  children: AccountNode[];
}

export type AccountOption = Pick<
  Account,
  'id' | 'code' | 'name' | 'nameBn' | 'type' | 'subtype' | 'systemKey'
>;

export interface AccountInput {
  code: string;
  name: string;
  nameBn: string | null;
  parentId: string | null;
  type?: AccountType;
  subtype?: string;
  isGroup?: boolean;
  isActive?: boolean;
  description: string | null;
}

type Ref = { id: string; name: string; code?: string } | null;

export interface JournalLine {
  id: string;
  accountId: string;
  partyId: string | null;
  branchId: string | null;
  debit: string;
  credit: string;
  description: string | null;
  account: { id: string; code: string; name: string; nameBn: string | null; type: AccountType };
  party: { id: string; code: string; name: string } | null;
  branch: Ref;
}

export type JournalStatus = 'draft' | 'posted';
export type EntryType = 'manual' | 'auto' | 'opening' | 'closing' | 'reversal';

export interface JournalEntry {
  id: string;
  number: string;
  entryDate: string;
  entryType: EntryType;
  status: JournalStatus;
  branchId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceNo: string | null;
  event: string | null;
  reference: string | null;
  narration: string | null;
  totalDebit: string;
  totalCredit: string;
  reversalOfId: string | null;
  reversedById: string | null;
  createdAt: string;
  postedAt: string | null;
  branch: Ref;
  creator: Ref;
  poster?: Ref;
  reversalOf?: { id: string; number: string; entryDate: string } | null;
  reversedBy?: { id: string; number: string; entryDate: string } | null;
  lines?: JournalLine[];
}

export interface JournalLineInput {
  accountId: string;
  debit: string;
  credit: string;
  partyId: string | null;
  description: string | null;
}

export interface JournalInput {
  entryDate: string;
  branchId: string | null;
  reference: string | null;
  narration: string | null;
  lines: JournalLineInput[];
  post?: boolean;
}

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'locked';
  lockedAt: string | null;
  locker: Ref;
}

export interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  closingJournalId: string | null;
  closedAt: string | null;
  closer: Ref;
  periods: FiscalPeriod[];
}

export interface MappedAccount {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
}

export interface AccountMapping {
  groups: Record<
    string,
    { key: string; types: AccountType[]; account: MappedAccount | null; isDefault: boolean }[]
  >;
  paymentMethods: {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    account: MappedAccount | null;
    defaultAccount: MappedAccount | null;
  }[];
}

export interface PartyMismatch {
  partyId: string | null;
  code: string | null;
  name: string | null;
  ledger: string;
  documents: string;
  difference: string;
}

export interface Comparison {
  ledger: string;
  documents: string;
  difference: string;
  balanced: boolean;
}

export interface Reconciliation {
  ok: boolean;
  trialBalance: { debit: string; credit: string; balanced: boolean };
  unbalancedJournals: number;
  receivables: Comparison & { mismatches: PartyMismatch[] };
  payables: Comparison & { mismatches: PartyMismatch[] };
  inventory: Comparison;
  inTransit: Comparison;
}

// ── Cash & bank ───────────────────────────────────────────────────────────

export type MoneyKind = 'cash' | 'bank' | 'mobile_wallet';
export const MONEY_KINDS: MoneyKind[] = ['cash', 'bank', 'mobile_wallet'];

export interface StatementMapping {
  headerRow: number;
  date: number;
  description?: number;
  reference?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  dateFormat: string;
}

export interface BankAccount {
  id: string;
  kind: MoneyKind;
  name: string;
  accountId: string;
  branchId: string | null;
  bankName: string | null;
  branchName: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  isActive: boolean;
  notes: string | null;
  balance: string;
  statementMapping: StatementMapping | null;
  account: { id: string; code: string; name: string; nameBn: string | null } | null;
  branch: Ref;
}

type MoneyRef = { id: string; name: string; kind: MoneyKind; accountId: string } | null;
export type VoucherType = 'receipt' | 'payment' | 'contra';
export type DocStatus = 'draft' | 'posted' | 'void';

export interface Voucher {
  id: string;
  number: string;
  voucherType: VoucherType;
  voucherDate: string;
  bankAccountId: string;
  toBankAccountId: string | null;
  partyName: string | null;
  reference: string | null;
  narration: string | null;
  amount: string;
  status: DocStatus;
  voidReason: string | null;
  createdAt: string;
  postedAt: string | null;
  voidedAt: string | null;
  bankAccount: MoneyRef;
  toBankAccount: MoneyRef;
  branch?: Ref;
  creator: Ref;
  poster?: Ref;
  voider?: Ref;
  lines?: {
    id: string;
    accountId: string;
    amount: string;
    description: string | null;
    account: { id: string; code: string; name: string; nameBn: string | null };
  }[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  accountId: string;
  description: string | null;
  isActive: boolean;
  account: { id: string; code: string; name: string; nameBn: string | null } | null;
}

export interface Attachment {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  number: string;
  expenseDate: string;
  categoryId: string;
  bankAccountId: string;
  payee: string | null;
  reference: string | null;
  description: string | null;
  amount: string;
  taxAmount: string;
  total: string;
  status: DocStatus;
  voidReason: string | null;
  createdAt: string;
  postedAt: string | null;
  voidedAt: string | null;
  category: { id: string; name: string; code: string } | null;
  bankAccount: MoneyRef;
  branch?: Ref;
  creator: Ref;
  poster?: Ref;
  voider?: Ref;
  attachments?: Attachment[];
}

export type ChequeStatus = 'in_hand' | 'deposited' | 'issued' | 'cleared' | 'bounced' | 'cancelled';

export interface Cheque {
  id: string;
  direction: 'received' | 'issued';
  chequeNo: string;
  bankName: string | null;
  chequeDate: string | null;
  amount: string;
  status: ChequeStatus;
  sourceType: 'customer_receipt' | 'supplier_payment';
  sourceId: string;
  sourceNo: string | null;
  depositedAt: string | null;
  clearedAt: string | null;
  bouncedAt: string | null;
  bounceReason: string | null;
  notes: string | null;
  party: { id: string; code: string; name: string } | null;
  depositBankAccount: { id: string; name: string } | null;
}

export interface StatementLine {
  id: string;
  lineDate: string;
  description: string | null;
  reference: string | null;
  amount: string;
  journalLineId: string | null;
}

export interface ReconLedgerLine {
  id: string;
  journalId: string;
  number: string;
  date: string;
  narration: string | null;
  reference: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceNo: string | null;
  description: string | null;
  amount: string;
  cleared: boolean;
}

export interface Reconciliation {
  id: string;
  bankAccountId: string;
  statementDate: string;
  statementBalance: string;
  openingBalance: string;
  status: 'in_progress' | 'completed';
  notes: string | null;
  completedAt: string | null;
  bankAccount: {
    id: string;
    name: string;
    kind: MoneyKind;
    accountId?: string;
    statementMapping?: StatementMapping | null;
  };
  completer?: Ref;
  statementLines?: StatementLine[];
  ledgerLines?: ReconLedgerLine[];
  summary?: {
    openingBalance: string;
    clearedDeposits: string;
    clearedPayments: string;
    clearedBalance: string;
    statementBalance: string;
    difference: string;
    ledgerBalance: string;
    outstandingDeposits: string;
    outstandingPayments: string;
  };
}
