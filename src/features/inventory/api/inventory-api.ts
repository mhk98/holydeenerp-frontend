import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiList, apiSend, toApiError } from '@/lib/api';
import type {
  ApiResponse,
  InventoryWarehouse,
  PaginationMeta,
  ProductStock,
  StockAdjustment,
  StockAlerts,
  StockBatchOption,
  StockCard,
  StockCount,
  StockItem,
  StockMovement,
  StockRow,
  StockSerialRow,
  StockSummary,
  StockTransfer,
} from '@/types';

/** Every inventory query key starts with "inventory" so one invalidation refreshes stock everywhere. */
const KEY = 'inventory';

function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

// ── Lookups ────────────────────────────────────────────────────────────────
export function useInventoryWarehouses() {
  return useQuery({
    queryKey: [KEY, 'warehouses'],
    queryFn: async () => (await apiGet<InventoryWarehouse[]>('/inventory/warehouses')).data,
    staleTime: 5 * 60_000,
  });
}

export function useTransferDestinations(enabled = true) {
  return useQuery({
    queryKey: [KEY, 'warehouses', 'destinations'],
    queryFn: async () => (await apiGet<InventoryWarehouse[]>('/inventory/warehouses/destinations')).data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export const searchItems = async (params: {
  q: string;
  warehouseId?: string;
  exact?: boolean;
  limit?: number;
}) =>
  (
    await apiGet<StockItem[]>('/inventory/items/search', {
      ...params,
      exact: params.exact ? 'true' : undefined,
    })
  ).data;

export function useItemSearch(q: string, warehouseId?: string) {
  return useQuery({
    queryKey: [KEY, 'item-search', q, warehouseId],
    queryFn: () => searchItems({ q, warehouseId }),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useBatches(params: {
  productId?: string;
  variantId?: string | null;
  warehouseId?: string;
  available?: boolean;
}) {
  return useQuery({
    queryKey: [KEY, 'batches', params],
    queryFn: async () =>
      (
        await apiGet<StockBatchOption[]>('/inventory/batches', {
          productId: params.productId,
          variantId: params.variantId ?? undefined,
          warehouseId: params.warehouseId,
          available: params.available ? 'true' : undefined,
        })
      ).data,
    enabled: Boolean(params.productId),
  });
}

export function useSerials(params: object, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'serials', params],
    queryFn: () => apiList<StockSerialRow>('/inventory/serials', params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

// ── Stock ──────────────────────────────────────────────────────────────────
export function useStock(params: object) {
  return useQuery({
    queryKey: [KEY, 'stock', params],
    queryFn: () => apiList<StockRow>('/inventory/stock', params),
    placeholderData: keepPreviousData,
  });
}

export const fetchAllStock = async (params: object) => {
  const rows: StockRow[] = [];
  for (let page = 1; page < 100; page += 1) {
    const res = await apiList<StockRow>('/inventory/stock', { ...params, page, limit: 100 });
    rows.push(...res.rows);
    if (page >= res.meta.totalPages || !res.rows.length) break;
  }
  return rows;
};

export function useStockSummary(params: object = {}) {
  return useQuery({
    queryKey: [KEY, 'summary', params],
    queryFn: async () => (await apiGet<StockSummary>('/inventory/stock/summary', params)).data,
  });
}

export function useProductStock(productId: string | undefined, params: object = {}) {
  return useQuery({
    queryKey: [KEY, 'product', productId, params],
    queryFn: async () => (await apiGet<ProductStock>(`/inventory/products/${productId}`, params)).data,
    enabled: Boolean(productId),
  });
}

export function useStockCard(productId: string | undefined, params: object) {
  return useQuery({
    queryKey: [KEY, 'card', productId, params],
    queryFn: async () => {
      const res = await apiGet<StockCard>(`/inventory/products/${productId}/card`, params);
      return { ...res.data, meta: res.meta as PaginationMeta };
    },
    enabled: Boolean(productId),
    placeholderData: keepPreviousData,
  });
}

export function useMovements(params: object) {
  return useQuery({
    queryKey: [KEY, 'movements', params],
    queryFn: () => apiList<StockMovement>('/inventory/movements', params),
    placeholderData: keepPreviousData,
  });
}

export function useStockAlerts(
  params: object = {},
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: [KEY, 'alerts', params],
    queryFn: async () => (await apiGet<StockAlerts>('/inventory/alerts', params)).data,
    staleTime: 60_000,
    ...options,
  });
}

// ── Reports ────────────────────────────────────────────────────────────────
export type ReportName = 'valuation' | 'slow-moving' | 'abc' | 'expiry';

export function useReport<Row, Summary>(name: ReportName, params: object) {
  return useQuery({
    queryKey: [KEY, 'report', name, params],
    queryFn: async () => {
      const res = await apiGet<{ rows: Row[]; summary: Summary }>(`/inventory/reports/${name}`, params);
      return { ...res.data, meta: res.meta as PaginationMeta };
    },
    placeholderData: keepPreviousData,
  });
}

export async function fetchWholeReport<Row>(name: ReportName, params: object) {
  const rows: Row[] = [];
  for (let page = 1; page < 50; page += 1) {
    const res = await apiGet<{ rows: Row[] }>(`/inventory/reports/${name}`, { ...params, page, limit: 500 });
    rows.push(...res.data.rows);
    if (!res.meta || page >= res.meta.totalPages || !res.data.rows.length) break;
  }
  return rows;
}

// ── Workflow documents ─────────────────────────────────────────────────────
function documentHooks<T extends { id: string }>(name: 'adjustments' | 'transfers' | 'counts') {
  const url = `/inventory/${name}`;
  return {
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
      const invalidate = useInvalidateInventory();
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
    useAction() {
      const queryClient = useQueryClient();
      const invalidate = useInvalidateInventory();
      return useMutation({
        mutationFn: async ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
          (await apiSend<T>('post', `${url}/${id}/${action}`, body)).data,
        onSuccess: (doc) => {
          queryClient.setQueryData([KEY, name, 'detail', doc.id], doc);
          invalidate();
        },
        onError: () => {},
      });
    },
    useRemove() {
      const invalidate = useInvalidateInventory();
      return useMutation({
        mutationFn: (id: string) => apiSend('delete', `${url}/${id}`),
        onSuccess: invalidate,
      });
    },
  };
}

export const adjustmentsApi = documentHooks<StockAdjustment>('adjustments');
export const transfersApi = documentHooks<StockTransfer>('transfers');
export const countsApi = documentHooks<StockCount>('counts');

export function useSaveCountEntries(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; countedQuantity: string | null; notes?: string | null }[]) => {
      try {
        return (await api.put<ApiResponse<StockCount>>(`/inventory/counts/${id}/items`, { items })).data.data;
      } catch (err) {
        throw toApiError(err);
      }
    },
    onSuccess: (doc) => queryClient.setQueryData([KEY, 'counts', 'detail', doc.id], doc),
    onError: () => {},
  });
}
