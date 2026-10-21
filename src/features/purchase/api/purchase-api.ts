import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend } from '@/lib/api';
import type {
  GoodsReceipt,
  OpenItems,
  PayablesAging,
  PurchaseLookups,
  PurchaseOrder,
  PurchaseRequisition,
  PurchaseReturn,
  PurchaseRfq,
  PurchaseTotals,
  SupplierBill,
  SupplierLedger,
  SupplierPayment,
} from '@/types';
import type { PreviewCompany } from '@/components/common/document-preview';

/** Every purchase query key starts with "purchase"; posting also refreshes inventory. */
const KEY = 'purchase';

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function usePurchaseLookups() {
  return useQuery({
    queryKey: [KEY, 'lookups'],
    queryFn: async () => (await apiGet<PurchaseLookups>('/purchase/lookups')).data,
    staleTime: 5 * 60_000,
  });
}

export interface CalculatedTotals {
  lines: { lineSubtotal: string; taxAmount: string; lineTotal: string }[];
  totals: PurchaseTotals & { taxes: { name: string; amount: string }[] };
}

/** Server-side totals preview while a form is edited. */
export function useCalculate(
  items: { quantity: string; unitPrice: string; discountPercent?: string; taxGroupId?: string | null }[],
) {
  const valid = items.every(
    (i) => /^\d+(\.\d{1,4})?$/.test(i.quantity) && /^\d+(\.\d{1,4})?$/.test(i.unitPrice || '0'),
  );
  return useQuery({
    queryKey: [KEY, 'calculate', items],
    queryFn: async () =>
      (
        await apiSend<CalculatedTotals>('post', '/purchase/calculate', {
          items: items.map((i) => ({
            ...i,
            unitPrice: i.unitPrice || '0',
            discountPercent: i.discountPercent || '0',
          })),
        })
      ).data,
    enabled: items.length > 0 && valid,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}

/**
 * List/get/save/actions/remove hooks for one document type of a module (`/purchase/orders`,
 * `/sales/invoices`, …). Query keys start with the module; writes also refresh inventory.
 */
export function documentHooks<T extends { id: string }>(name: string, module: 'purchase' | 'sales' = 'purchase') {
  const url = `/${module}/${name}`;
  const KEY = module;
  const useInvalidate = () => {
    const queryClient = useQueryClient();
    return () => {
      queryClient.invalidateQueries({ queryKey: [module] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    };
  };
  return {
    url,
    useList(params: object) {
      return useQuery({
        queryKey: [KEY, name, 'list', params],
        queryFn: () => apiList<T>(url, params),
        placeholderData: keepPreviousData,
      });
    },
    useOne(id: string | null | undefined) {
      return useQuery({
        queryKey: [KEY, name, 'detail', id],
        queryFn: async () => (await apiGet<T>(`${url}/${id}`)).data,
        enabled: Boolean(id),
      });
    },
    useSave() {
      const queryClient = useQueryClient();
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: async ({ id, data }: { id?: string; data: unknown }) =>
          (await apiSend<T>(id ? 'put' : 'post', id ? `${url}/${id}` : url, data)).data,
        onSuccess: (doc) => {
          queryClient.setQueryData([KEY, name, 'detail', doc.id], doc);
          invalidate();
        },
        onError: () => {},
      });
    },
    /** POST /:id/<action>. Conversions return the new document (navigate to it). */
    useAction<R = T>() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: async ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
          (await apiSend<R>('post', `${url}/${id}/${action}`, body)).data,
        onSuccess: invalidate,
        onError: () => {},
      });
    },
    useRemove() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: (id: string) => apiSend('delete', `${url}/${id}`),
        onSuccess: invalidate,
      });
    },
  };
}

export const requisitionsApi = documentHooks<PurchaseRequisition>('requisitions');
export const rfqsApi = documentHooks<PurchaseRfq>('rfqs');
export const ordersApi = documentHooks<PurchaseOrder>('orders');
export const receiptsApi = documentHooks<GoodsReceipt>('receipts');
export const billsApi = documentHooks<SupplierBill>('bills');
export const returnsApi = documentHooks<PurchaseReturn>('returns');

// ── RFQ quotes ─────────────────────────────────────────────────────────────
export function useSaveQuote(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rfqSupplierId, data }: { rfqSupplierId: string; data: unknown }) =>
      (await apiSend<PurchaseRfq>('put', `/purchase/rfqs/${rfqId}/suppliers/${rfqSupplierId}/quote`, data))
        .data,
    onSuccess: (doc) => queryClient.setQueryData([KEY, 'rfqs', 'detail', doc.id], doc),
    onError: () => {},
  });
}

// ── Payments ───────────────────────────────────────────────────────────────
export function usePayments(params: object) {
  return useQuery({
    queryKey: [KEY, 'payments', 'list', params],
    queryFn: () => apiList<SupplierPayment>('/purchase/payments', params),
    placeholderData: keepPreviousData,
  });
}
export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'payments', 'detail', id],
    queryFn: async () => (await apiGet<SupplierPayment>(`/purchase/payments/${id}`)).data,
    enabled: Boolean(id),
  });
}
export function useCreatePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (data: unknown) =>
      (await apiSend<SupplierPayment>('post', '/purchase/payments', data)).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export function useVoidPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiSend<SupplierPayment>('post', `/purchase/payments/${id}/void`, { reason })).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export function useApplyCredit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: {
      sourceType: 'payment' | 'debit_note';
      sourceId: string;
      allocations: { billId: string; amount: string }[];
    }) => apiSend('post', '/purchase/payables/apply-credit', data),
    onSuccess: invalidate,
    onError: () => {},
  });
}

// ── Payables ───────────────────────────────────────────────────────────────
export function useOpenItems(supplierId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'open-items', supplierId],
    queryFn: async () => (await apiGet<OpenItems>(`/purchase/suppliers/${supplierId}/open-items`)).data,
    enabled: Boolean(supplierId),
  });
}
export function useSupplierLedger(supplierId: string | undefined, params: object) {
  return useQuery({
    queryKey: [KEY, 'ledger', supplierId, params],
    queryFn: async () =>
      (await apiGet<SupplierLedger>(`/purchase/suppliers/${supplierId}/ledger`, params)).data,
    enabled: Boolean(supplierId),
    placeholderData: keepPreviousData,
  });
}
export function useAging(params: object) {
  return useQuery({
    queryKey: [KEY, 'aging', params],
    queryFn: async () => (await apiGet<PayablesAging>('/purchase/payables/aging', params)).data,
    placeholderData: keepPreviousData,
  });
}

// ── Print & email ──────────────────────────────────────────────────────────
export interface OrderPrintData {
  order: PurchaseOrder;
  supplierAddress: string | null;
  company: PreviewCompany;
  template: {
    options: Record<string, unknown> & { title?: string; accentColor?: string };
    terms: string | null;
    footerNote: string | null;
  };
}
export const fetchOrderPrint = async (id: string) =>
  (await apiGet<OrderPrintData>(`/purchase/orders/${id}/print`)).data;
export function useOrderPrint(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'orders', 'print', id],
    queryFn: () => fetchOrderPrint(id!),
    enabled: Boolean(id) && enabled,
  });
}
