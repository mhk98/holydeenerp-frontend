import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend } from '@/lib/api';
import { createResource } from '@/lib/resource';
import type {
  Account,
  AccountInput,
  AccountMapping,
  AccountNode,
  AccountOption,
  FiscalYear,
  JournalEntry,
  JournalInput,
  Reconciliation,
} from '../types';

/** Every accounting query key starts with "accounting". */
const KEY = 'accounting';
const A = '/accounting';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

/** Mutation that refreshes every accounting query afterwards. */
function useAccountingMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: invalidate });
}

// ── Chart of accounts ─────────────────────────────────────────────────────

export const accountsResource = createResource<Account, AccountInput>(`${KEY}-accounts`, `${A}/accounts`, {
  related: [KEY],
});

export function useAccountTree(params: { balances?: boolean; includeInactive?: boolean; asOf?: string }) {
  return useQuery({
    queryKey: [KEY, 'tree', params],
    queryFn: async () =>
      (
        await apiGet<AccountNode[]>(`${A}/accounts/tree`, {
          balances: params.balances ? 'true' : undefined,
          includeInactive: params.includeInactive ? 'true' : undefined,
          asOf: params.asOf || undefined,
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

/** Postable accounts for pickers (cached; small list). */
export function useAccountOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: async () => (await apiGet<AccountOption[]>(`${A}/accounts/options`)).data,
    staleTime: 5 * 60_000,
  });
}

// ── Journals ──────────────────────────────────────────────────────────────

export function useJournals(params: object) {
  return useQuery({
    queryKey: [KEY, 'journals', params],
    queryFn: () => apiList<JournalEntry>(`${A}/journals`, params),
    placeholderData: keepPreviousData,
  });
}

export function useJournal(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'journal', id],
    queryFn: async () => (await apiGet<JournalEntry>(`${A}/journals/${id}`)).data,
    enabled: Boolean(id),
  });
}

export const useSaveJournal = () =>
  useAccountingMutation(
    async ({ id, data }: { id?: string; data: JournalInput }) =>
      (await apiSend<JournalEntry>(id ? 'put' : 'post', id ? `${A}/journals/${id}` : `${A}/journals`, data))
        .data,
  );
export const usePostJournal = () =>
  useAccountingMutation(
    async (id: string) => (await apiSend<JournalEntry>('post', `${A}/journals/${id}/post`)).data,
  );
export const useDeleteJournal = () =>
  useAccountingMutation((id: string) => apiSend('delete', `${A}/journals/${id}`));
export const useReverseJournal = () =>
  useAccountingMutation(
    async ({ id, date, narration }: { id: string; date?: string; narration?: string | null }) =>
      (await apiSend<JournalEntry>('post', `${A}/journals/${id}/reverse`, { date, narration })).data,
  );

// ── Opening balances ──────────────────────────────────────────────────────

export function useOpeningBalances() {
  return useQuery({
    queryKey: [KEY, 'opening'],
    queryFn: async () => (await apiGet<JournalEntry | null>(`${A}/opening-balances`)).data,
  });
}

export const useSaveOpeningBalances = () =>
  useAccountingMutation(
    async (data: { date: string; lines: { accountId: string; debit: string; credit: string }[] }) =>
      (await apiSend<JournalEntry | null>('put', `${A}/opening-balances`, data)).data,
  );

// ── Fiscal years ──────────────────────────────────────────────────────────

export function useFiscalYears() {
  return useQuery({
    queryKey: [KEY, 'fiscal-years'],
    queryFn: async () => (await apiGet<FiscalYear[]>(`${A}/fiscal-years`)).data,
  });
}

export const useCreateFiscalYear = () =>
  useAccountingMutation(
    async (data: { startDate: string; endDate?: string; name?: string }) =>
      (await apiSend<FiscalYear>('post', `${A}/fiscal-years`, data)).data,
  );
export const useDeleteFiscalYear = () =>
  useAccountingMutation((id: string) => apiSend('delete', `${A}/fiscal-years/${id}`));
export const useYearAction = () =>
  useAccountingMutation(
    async ({ id, action }: { id: string; action: 'close' | 'reopen' }) =>
      (await apiSend<FiscalYear>('post', `${A}/fiscal-years/${id}/${action}`)).data,
  );
export const useSetPeriodStatus = () =>
  useAccountingMutation(({ id, status }: { id: string; status: 'open' | 'locked' }) =>
    apiSend('patch', `${A}/periods/${id}`, { status }),
  );

// ── Mapping, health check ─────────────────────────────────────────────────

export function useAccountMapping() {
  return useQuery({
    queryKey: [KEY, 'mapping'],
    queryFn: async () => (await apiGet<AccountMapping>(`${A}/mapping`)).data,
  });
}

export const useSaveAccountMapping = () =>
  useAccountingMutation(
    async (data: {
      accounts?: Record<string, string | null>;
      paymentMethods?: Record<string, string | null>;
    }) => (await apiSend<AccountMapping>('put', `${A}/mapping`, data)).data,
  );

export function useReconciliation() {
  return useQuery({
    queryKey: [KEY, 'reconciliation'],
    queryFn: async () => (await apiGet<Reconciliation>(`${A}/reconciliation`)).data,
  });
}

export const useBackfill = () =>
  useAccountingMutation(
    async () => (await apiSend<{ posted: Record<string, number> }>('post', `${A}/backfill`)).data,
  );

/** Journal entries a document posted (for "Accounting entries" panels on documents). */
export function useSourceJournals(sourceType: string, sourceId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'source-journals', sourceType, sourceId],
    queryFn: async () =>
      (await apiGet<JournalEntry[]>(`${A}/journals/source/${sourceType}/${sourceId}`)).data,
    enabled: Boolean(sourceId),
  });
}
