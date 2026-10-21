import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiList, apiSend, toApiError } from '@/lib/api';
import { createResource } from '@/lib/resource';
import { useAuthStore } from '@/stores/auth-store';
import type { PosSettings } from '@/features/pos/types';
import type {
  ApiResponse,
  AppConfig,
  Backup,
  BackupSchedule,
  BranchRecord,
  CompanyProfile,
  Currency,
  DocumentSequence,
  ExchangeRate,
  FinancialSettings,
  InventorySettings,
  PurchaseSettings,
  SalesSettings,
  PaymentMethod,
  PrintTemplate,
  SmtpSettings,
  SystemSettings,
  TaxBreakdown,
  TaxGroup,
  TaxRate,
  Unit,
  UnitConversion,
  Warehouse,
} from '@/types';

// ── CRUD resources ─────────────────────────────────────────────────────────
export const branchesResource = createResource<BranchRecord>('settings-branches', '/settings/branches', {
  related: ['branches', 'settings-warehouses'],
});
export const warehousesResource = createResource<Warehouse>('settings-warehouses', '/settings/warehouses');
export const currenciesResource = createResource<Currency>('settings-currencies', '/settings/currencies', {
  related: ['app-config'],
});
export const taxRatesResource = createResource<TaxRate>('settings-tax-rates', '/settings/tax-rates', {
  related: ['settings-tax-groups'],
});
export const taxGroupsResource = createResource<TaxGroup>('settings-tax-groups', '/settings/tax-groups');
export const sequencesResource = createResource<DocumentSequence>(
  'settings-sequences',
  '/settings/document-sequences',
);
export const unitsResource = createResource<Unit>('settings-units', '/settings/units', {
  related: ['settings-unit-conversions'],
});
export const conversionsResource = createResource<UnitConversion>(
  'settings-unit-conversions',
  '/settings/unit-conversions',
);
export const paymentMethodsResource = createResource<PaymentMethod>(
  'settings-payment-methods',
  '/settings/payment-methods',
);
export const printTemplatesResource = createResource<PrintTemplate>(
  'settings-print-templates',
  '/settings/print-templates',
);

// ── App config & preferences ───────────────────────────────────────────────
export function useAppConfig() {
  const authenticated = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => (await apiGet<AppConfig>('/settings/app-config')).data,
    enabled: authenticated,
    staleTime: 5 * 60_000,
  });
}

type PreferenceGroups = {
  financial: FinancialSettings;
  system: SystemSettings;
  smtp: SmtpSettings;
  inventory: InventorySettings;
  purchase: PurchaseSettings;
  sales: SalesSettings;
  pos: PosSettings;
};

export function usePreferences<G extends keyof PreferenceGroups>(group: G) {
  return useQuery({
    queryKey: ['preferences', group],
    queryFn: async () => (await apiGet<PreferenceGroups[G]>(`/settings/preferences/${group}`)).data,
  });
}

export function useSavePreferences<G extends keyof PreferenceGroups>(group: G) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PreferenceGroups[G]> & { password?: string }) =>
      (await apiSend<PreferenceGroups[G]>('put', `/settings/preferences/${group}`, data)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['preferences', group], data);
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      if (group === 'financial') queryClient.invalidateQueries({ queryKey: ['settings-currencies'] });
      // Thresholds change alerts and reports.
      if (group === 'inventory') queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (group === 'purchase') queryClient.invalidateQueries({ queryKey: ['purchase'] });
      if (group === 'sales') queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: () => {},
  });
}

export function useSmtpTest() {
  return useMutation({
    mutationFn: (to: string) => apiSend('post', '/settings/preferences/smtp/test', { to }),
    onError: () => {},
  });
}

// ── Company ────────────────────────────────────────────────────────────────
export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: async () => (await apiGet<CompanyProfile>('/settings/company')).data,
  });
}

function useCompanyWrite<A>(fn: (arg: A) => Promise<CompanyProfile>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(['company'], data);
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
    },
  });
}

export const useUpdateCompany = () =>
  useCompanyWrite(
    async (data: Partial<CompanyProfile>) =>
      (await apiSend<CompanyProfile>('patch', '/settings/company', data)).data,
  );

export const useUploadLogo = () =>
  useCompanyWrite(async (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    try {
      return (await api.post<ApiResponse<CompanyProfile>>('/settings/company/logo', form)).data.data;
    } catch (err) {
      throw toApiError(err);
    }
  });

export const useRemoveLogo = () =>
  useCompanyWrite(async () => (await apiSend<CompanyProfile>('delete', '/settings/company/logo')).data);

// ── Exchange rates ─────────────────────────────────────────────────────────
export function useExchangeRates(currencyId: string | null) {
  return useQuery({
    queryKey: ['exchange-rates', currencyId],
    queryFn: () => apiList<ExchangeRate>(`/settings/currencies/${currencyId}/rates`, { limit: 50 }),
    enabled: Boolean(currencyId),
  });
}

export function useSaveRate(currencyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { rate: string; effectiveDate: string }) =>
      apiSend<ExchangeRate>('post', `/settings/currencies/${currencyId}/rates`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates', currencyId] });
      queryClient.invalidateQueries({ queryKey: ['settings-currencies'] });
    },
    onError: () => {},
  });
}

export function useDeleteRate(currencyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rateId: string) => apiSend('delete', `/settings/currencies/${currencyId}/rates/${rateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates', currencyId] });
      queryClient.invalidateQueries({ queryKey: ['settings-currencies'] });
    },
  });
}

// ── Taxes & numbering previews ─────────────────────────────────────────────
export function useTaxCalculation(groupId: string | null, amount: string, inclusive: boolean) {
  return useQuery({
    queryKey: ['tax-calc', groupId, amount, inclusive],
    queryFn: async () =>
      (
        await apiSend<TaxBreakdown>('post', `/settings/tax-groups/${groupId}/calculate`, {
          amount,
          inclusive,
        })
      ).data,
    enabled: Boolean(groupId) && /^\d+(\.\d{1,4})?$/.test(amount),
    placeholderData: keepPreviousData,
  });
}

export function useSequencePreview(draft: {
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
  branchId: string | null;
}) {
  return useQuery({
    queryKey: ['sequence-preview', draft],
    queryFn: async () =>
      (await apiSend<{ next: string }>('post', '/settings/document-sequences/preview', draft)).data.next,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

// ── Backups ────────────────────────────────────────────────────────────────
export function useBackups(params: object) {
  return useQuery({
    queryKey: ['backups', params],
    queryFn: () => apiList<Backup>('/settings/backups', params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiSend<Backup>('post', '/settings/backups')).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend('delete', `/settings/backups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });
}

/** Download through axios so the bearer token is sent, then save the blob. */
export async function downloadBackup(backup: Backup) {
  try {
    const res = await api.get(`/settings/backups/${backup.id}/download`, {
      responseType: 'blob',
      timeout: 0,
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    throw toApiError(err);
  }
}

export function useBackupSchedule() {
  return useQuery({
    queryKey: ['backup-schedule'],
    queryFn: async () => (await apiGet<BackupSchedule>('/settings/backups/schedule')).data,
  });
}

export function useSaveBackupSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<BackupSchedule>) =>
      (await apiSend<BackupSchedule & { cron: string | null }>('put', '/settings/backups/schedule', data))
        .data,
    onSuccess: (data) => queryClient.setQueryData(['backup-schedule'], data),
    onError: () => {},
  });
}
