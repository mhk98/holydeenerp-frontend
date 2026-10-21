import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export const REPORTS = [
  'trial-balance',
  'profit-loss',
  'balance-sheet',
  'cash-flow',
  'general-ledger',
  'day-book',
  'vat',
] as const;
export type ReportName = (typeof REPORTS)[number];

/** A financial report for the given filters (empty values are left out). */
export function useReport<T>(name: ReportName, params: Record<string, string | undefined>, enabled = true) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  return useQuery({
    queryKey: ['accounting', 'report', name, clean],
    queryFn: async () => (await apiGet<T>(`/accounting/reports/${name}`, clean)).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ── Shapes ────────────────────────────────────────────────────────────────

export interface AccountRow {
  accountId: string | null;
  code: string | null;
  name: string;
  nameBn: string | null;
}
export interface AmountRow extends AccountRow {
  amount: string;
  compare: string | null;
}
export interface Section {
  key: string;
  rows: AmountRow[];
  total: string;
  compareTotal: string | null;
}
export interface Figure {
  amount: string;
  compare: string | null;
}

export interface TrialBalance {
  from: string;
  to: string;
  balanced: boolean;
  rows: (AccountRow & { type: string; opening: string; debit: string; credit: string; closing: string })[];
  totals: Record<
    'openingDebit' | 'openingCredit' | 'debit' | 'credit' | 'closingDebit' | 'closingCredit',
    string
  >;
}
export interface ProfitLoss {
  from: string;
  to: string;
  compare: { from: string; to: string } | null;
  sections: Section[];
  netSales: Figure;
  grossProfit: Figure;
  operatingProfit: Figure;
  netProfit: Figure;
}
export interface BalanceSheet {
  asOf: string;
  compareAsOf: string | null;
  sections: Section[];
  totalAssets: string;
  totalLiabilitiesEquity: string;
  compareTotalAssets: string | null;
  compareTotalLiabilitiesEquity: string | null;
  balanced: boolean;
}
export interface CashFlow {
  from: string;
  to: string;
  operating: { rows: { key: string; amount: string }[]; total: string };
  investing: { rows: { key: string; amount: string }[]; total: string };
  financing: { rows: { key: string; amount: string }[]; total: string };
  netChange: string;
  openingCash: string;
  closingCash: string;
  balanced: boolean;
}
export interface GeneralLedger {
  from: string;
  to: string;
  accounts: (AccountRow & {
    type: string;
    opening: string;
    debit: string;
    credit: string;
    closing: string;
    rows: {
      date: string;
      journalId: string;
      number: string;
      narration: string | null;
      description: string | null;
      reference: string | null;
      sourceNo: string | null;
      partyName: string | null;
      debit: string;
      credit: string;
      balance: string;
    }[];
  })[];
}
export interface DayBook {
  from: string;
  to: string;
  totalDebit: string;
  meta: { page: number; limit: number; total: number; totalPages: number };
  entries: {
    id: string;
    number: string;
    entryDate: string;
    entryType: string;
    narration: string | null;
    sourceNo: string | null;
    totalDebit: string;
    branch: { id: string; name: string } | null;
    lines: {
      id: string;
      debit: string;
      credit: string;
      description: string | null;
      account: { id: string; code: string; name: string; nameBn: string | null };
      party: { id: string; name: string } | null;
    }[];
  }[];
}
export interface VatBlock {
  rows: { taxGroup: string; taxable: string; tax: string }[];
  taxable: string;
  tax: string;
}
export interface VatReport {
  from: string;
  to: string;
  output: VatBlock;
  input: VatBlock;
  netPayable: string;
}
