import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiList, apiSend, toApiError } from '@/lib/api';
import { createResource } from '@/lib/resource';
import type {
  Attachment,
  BankAccount,
  Cheque,
  Expense,
  ExpenseCategory,
  Reconciliation,
  StatementMapping,
  Voucher,
  VoucherType,
} from '../types';

/** Cash & bank queries live under the "accounting" key so ledger views refresh with them. */
const KEY = 'accounting';
const A = '/accounting';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY] });
    queryClient.invalidateQueries({ queryKey: [`${KEY}-bank-accounts`] });
    queryClient.invalidateQueries({ queryKey: [`${KEY}-expense-categories`] });
    // Cheque bounces void receipts / payments.
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['purchase'] });
  };
}
function useAction<V, R>(fn: (vars: V) => Promise<R>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: invalidate });
}

// ── Money accounts, expense categories ────────────────────────────────────

export const bankAccountsResource = createResource<BankAccount>(
  `${KEY}-bank-accounts`,
  `${A}/bank-accounts`,
  {
    related: [KEY],
  },
);
export const expenseCategoriesResource = createResource<ExpenseCategory>(
  `${KEY}-expense-categories`,
  `${A}/expense-categories`,
  { related: [KEY] },
);

export function useBankAccountOptions() {
  return useQuery({
    queryKey: [KEY, 'bank-options'],
    queryFn: async () => (await apiGet<BankAccount[]>(`${A}/bank-accounts/options`)).data,
    staleTime: 60_000,
  });
}

// ── Vouchers ──────────────────────────────────────────────────────────────

export interface VoucherInput {
  voucherType: VoucherType;
  voucherDate: string;
  bankAccountId: string;
  toBankAccountId?: string | null;
  amount?: string;
  partyName: string | null;
  reference: string | null;
  narration: string | null;
  lines?: { accountId: string; amount: string; description: string | null }[];
  post?: boolean;
}

export function useVouchers(params: object) {
  return useQuery({
    queryKey: [KEY, 'vouchers', params],
    queryFn: () => apiList<Voucher>(`${A}/vouchers`, params),
    placeholderData: keepPreviousData,
  });
}
export function useVoucher(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'voucher', id],
    queryFn: async () => (await apiGet<Voucher>(`${A}/vouchers/${id}`)).data,
    enabled: Boolean(id),
  });
}
export const useSaveVoucher = () =>
  useAction(
    async ({ id, data }: { id?: string; data: VoucherInput }) =>
      (await apiSend<Voucher>(id ? 'put' : 'post', id ? `${A}/vouchers/${id}` : `${A}/vouchers`, data)).data,
  );
export const useVoucherAction = () =>
  useAction(
    async ({ id, action, reason }: { id: string; action: 'post' | 'void' | 'delete'; reason?: string }) =>
      action === 'delete'
        ? (await apiSend<null>('delete', `${A}/vouchers/${id}`)).data
        : (
            await apiSend<Voucher>(
              'post',
              `${A}/vouchers/${id}/${action}`,
              action === 'void' ? { reason } : undefined,
            )
          ).data,
  );

// ── Expenses and files ────────────────────────────────────────────────────

export interface ExpenseInput {
  expenseDate: string;
  categoryId: string;
  bankAccountId: string;
  amount: string;
  taxAmount: string;
  payee: string | null;
  reference: string | null;
  description: string | null;
  post?: boolean;
}

export function useExpenses(params: object) {
  return useQuery({
    queryKey: [KEY, 'expenses', params],
    queryFn: () => apiList<Expense>(`${A}/expenses`, params),
    placeholderData: keepPreviousData,
  });
}
export function useExpense(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'expense', id],
    queryFn: async () => (await apiGet<Expense>(`${A}/expenses/${id}`)).data,
    enabled: Boolean(id),
  });
}
export const useSaveExpense = () =>
  useAction(
    async ({ id, data }: { id?: string; data: ExpenseInput }) =>
      (await apiSend<Expense>(id ? 'put' : 'post', id ? `${A}/expenses/${id}` : `${A}/expenses`, data)).data,
  );
export const useExpenseAction = () =>
  useAction(
    async ({ id, action, reason }: { id: string; action: 'post' | 'void' | 'delete'; reason?: string }) =>
      action === 'delete'
        ? (await apiSend<null>('delete', `${A}/expenses/${id}`)).data
        : (
            await apiSend<Expense>(
              'post',
              `${A}/expenses/${id}/${action}`,
              action === 'void' ? { reason } : undefined,
            )
          ).data,
  );

export const useUploadAttachments = () =>
  useAction(
    async ({ entityType, entityId, files }: { entityType: string; entityId: string; files: File[] }) => {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      try {
        return (await api.post<{ data: Attachment[] }>(`${A}/attachments/${entityType}/${entityId}`, form))
          .data.data;
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
export const useRemoveAttachment = () =>
  useAction((id: string) => apiSend('delete', `${A}/attachments/${id}`));

/** Open a private attachment (fetched with the session, shown as a blob URL). */
export async function openAttachment(file: Attachment, download = false) {
  try {
    const res = await api.get<Blob>(`${A}/attachments/${file.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      a.click();
    } else {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    throw toApiError(err);
  }
}

// ── Cheques ───────────────────────────────────────────────────────────────

export function useCheques(params: object) {
  return useQuery({
    queryKey: [KEY, 'cheques', params],
    queryFn: () => apiList<Cheque>(`${A}/cheques`, params),
    placeholderData: keepPreviousData,
  });
}
export const useChequeAction = () =>
  useAction(
    async ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'deposit' | 'clear' | 'bounce';
      body: { bankAccountId?: string; date?: string; reason?: string };
    }) => (await apiSend<Cheque>('post', `${A}/cheques/${id}/${action}`, body)).data,
  );

// ── Bank reconciliation ───────────────────────────────────────────────────

export function useReconciliations() {
  return useQuery({
    queryKey: [KEY, 'reconciliations'],
    queryFn: async () => (await apiGet<Reconciliation[]>(`${A}/reconciliations`)).data,
  });
}
export function useReconciliation(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'reconciliation', id],
    queryFn: async () => (await apiGet<Reconciliation>(`${A}/reconciliations/${id}`)).data,
    enabled: Boolean(id),
  });
}
export const useCreateReconciliation = () =>
  useAction(
    async (data: { bankAccountId: string; statementDate: string; statementBalance: string }) =>
      (await apiSend<Reconciliation>('post', `${A}/reconciliations`, data)).data,
  );

/** Every workspace action returns the refreshed reconciliation. */
export const useReconAction = (id: string) =>
  useAction(
    async ({
      path,
      method = 'post',
      body,
    }: {
      path: string;
      method?: 'post' | 'patch' | 'delete';
      body?: unknown;
    }) => {
      const res = await apiSend<Reconciliation | { matched: number; reconciliation: Reconciliation }>(
        method,
        `${A}/reconciliations/${id}${path}`,
        body,
      );
      return res.data;
    },
  );

export interface StatementPreview {
  preview: (string | number)[][];
  columns: number;
  mapping: StatementMapping | null;
}

/** Upload a statement: without a mapping → preview; with one → import. */
export const useImportStatement = (id: string) =>
  useAction(async ({ file, mapping }: { file: File; mapping?: StatementMapping }) => {
    const form = new FormData();
    form.append('file', file);
    if (mapping) form.append('mapping', JSON.stringify(mapping));
    try {
      return (
        await api.post<{
          data:
            | StatementPreview
            | {
                imported: number;
                skipped: { row: number; message: string }[];
                reconciliation: Reconciliation;
              };
        }>(`${A}/reconciliations/${id}/statement`, form)
      ).data.data;
    } catch (err) {
      throw toApiError(err);
    }
  });
