import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend } from '@/lib/api';
import type {
  CustomerLedger,
  CustomerOpenItems,
  CustomerReceipt,
  DeliveryChallan,
  PriceList,
  ReceivablesAging,
  RecurringInvoice,
  ResolvedPrice,
  SalesInvoice,
  SalesOrder,
  SalesQuotation,
  SalesReturn,
  SalesSettings,
  SalesTotals,
} from '@/types';
import type { PreviewCompany } from '@/components/common/document-preview';
import { documentHooks } from '@/features/purchase/api/purchase-api';

const KEY = 'sales';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export const quotationsApi = documentHooks<SalesQuotation>('quotations', 'sales');
export const salesOrdersApi = documentHooks<SalesOrder>('orders', 'sales');
export const challansApi = documentHooks<DeliveryChallan>('challans', 'sales');
export const invoicesApi = documentHooks<SalesInvoice>('invoices', 'sales');
export const salesReturnsApi = documentHooks<SalesReturn>('returns', 'sales');
export const priceListsApi = documentHooks<PriceList>('price-lists', 'sales');

export interface SalesLookups {
  taxGroups: { id: string; name: string; code: string; rate: string }[];
  paymentMethods: { id: string; name: string; code: string; type: string; requiresReference: boolean }[];
  customerGroups: { id: string; name: string; code: string }[];
  settings: SalesSettings;
}

export function useSalesLookups() {
  return useQuery({
    queryKey: [KEY, 'lookups'],
    queryFn: async () => (await apiGet<SalesLookups>('/sales/lookups')).data,
    staleTime: 5 * 60_000,
  });
}

// ── Pricing ────────────────────────────────────────────────────────────────
export const fetchPrices = async (body: {
  customerId?: string | null;
  items: { productId: string; variantId?: string | null; unitId?: string | null; quantity?: string }[];
}) => (await apiSend<ResolvedPrice[]>('post', '/sales/prices', body)).data;

export interface SalesCalculation {
  lines: {
    discountAmount: string;
    documentDiscount: string;
    lineSubtotal: string;
    taxAmount: string;
    lineTotal: string;
  }[];
  totals: SalesTotals & { taxes: { name: string; amount: string }[]; pricesIncludeTax: boolean };
}

/** Server-side totals preview (discounts, tax, rounding) while a form is edited. */
export function useSalesCalculate(
  body: { discountType?: string; discountValue?: string; items: object[] } | null,
) {
  return useQuery({
    queryKey: [KEY, 'calculate', body],
    queryFn: async () => (await apiSend<SalesCalculation>('post', '/sales/calculate', body)).data,
    enabled: Boolean(body?.items.length),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}

// ── Receipts ───────────────────────────────────────────────────────────────
export function useReceipts(params: object) {
  return useQuery({
    queryKey: [KEY, 'receipts', 'list', params],
    queryFn: () => apiList<CustomerReceipt>('/sales/receipts', params),
    placeholderData: keepPreviousData,
  });
}
export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'receipts', 'detail', id],
    queryFn: async () => (await apiGet<CustomerReceipt>(`/sales/receipts/${id}`)).data,
    enabled: Boolean(id),
  });
}
export function useCreateReceipt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (data: unknown) =>
      (await apiSend<CustomerReceipt>('post', '/sales/receipts', data)).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export function useVoidReceipt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiSend<CustomerReceipt>('post', `/sales/receipts/${id}/void`, { reason })).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export function useApplyCustomerCredit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: {
      sourceType: 'receipt' | 'credit_note';
      sourceId: string;
      allocations: { invoiceId: string; amount: string }[];
    }) => apiSend('post', '/sales/receivables/apply-credit', data),
    onSuccess: invalidate,
    onError: () => {},
  });
}

// ── Receivables ────────────────────────────────────────────────────────────
export function useCustomerOpenItems(customerId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'open-items', customerId],
    queryFn: async () => (await apiGet<CustomerOpenItems>(`/sales/customers/${customerId}/open-items`)).data,
    enabled: Boolean(customerId),
  });
}
export function useCustomerLedger(customerId: string | undefined, params: object) {
  return useQuery({
    queryKey: [KEY, 'ledger', customerId, params],
    queryFn: async () => (await apiGet<CustomerLedger>(`/sales/customers/${customerId}/ledger`, params)).data,
    enabled: Boolean(customerId),
    placeholderData: keepPreviousData,
  });
}
export function useReceivablesAging(params: object) {
  return useQuery({
    queryKey: [KEY, 'aging', params],
    queryFn: async () => (await apiGet<ReceivablesAging>('/sales/receivables/aging', params)).data,
    placeholderData: keepPreviousData,
  });
}

// ── Recurring ──────────────────────────────────────────────────────────────
export function useRecurringList(params: object) {
  return useQuery({
    queryKey: [KEY, 'recurring', 'list', params],
    queryFn: () => apiList<RecurringInvoice>('/sales/recurring', params),
    placeholderData: keepPreviousData,
  });
}
export function useRecurring(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'recurring', 'detail', id],
    queryFn: async () => (await apiGet<RecurringInvoice>(`/sales/recurring/${id}`)).data,
    enabled: Boolean(id),
  });
}
export function useUpdateRecurring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: object }) =>
      (await apiSend<RecurringInvoice>('patch', `/sales/recurring/${id}`, data)).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export function useRunRecurring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await apiSend<{ invoiceId: string | null; schedule: RecurringInvoice }>(
          'post',
          `/sales/recurring/${id}/run`,
        )
      ).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export function useDeleteRecurring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiSend('delete', `/sales/recurring/${id}`),
    onSuccess: invalidate,
  });
}

// ── Print ──────────────────────────────────────────────────────────────────
export interface InvoicePrintData {
  invoice: SalesInvoice;
  company: PreviewCompany & { website?: string | null };
  customerAddress: string | null;
  warehouseName: string | null;
  template: {
    options: Record<string, unknown> & {
      title?: string;
      accentColor?: string;
      showLogo?: boolean;
      showSignature?: boolean;
    };
    terms: string | null;
    footerNote: string | null;
  };
  amountInWords: { en: string; bn: string };
  qrCode: string;
  qrText: string;
}
export const fetchInvoicePrint = async (id: string) =>
  (await apiGet<InvoicePrintData>(`/sales/invoices/${id}/print`)).data;
