import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend, fetchAllPages } from '@/lib/api';

/**
 * TanStack Query hooks for a standard REST resource (list/get/create/update/delete):
 *
 *   export const warehousesResource = createResource<Warehouse, WarehouseInput>('warehouses', '/settings/warehouses');
 *   const list = warehousesResource.useList(query);
 *
 * `related` keys are invalidated too after a write (e.g. branches → warehouses).
 */
export function createResource<T extends { id: string }, Input = unknown>(
  key: string,
  url: string,
  { related = [] as string[] } = {},
) {
  const keys = {
    all: [key] as const,
    list: (params: object) => [key, 'list', params] as const,
    detail: (id: string) => [key, 'detail', id] as const,
  };

  function useInvalidate() {
    const queryClient = useQueryClient();
    return () => {
      for (const k of [key, ...related]) queryClient.invalidateQueries({ queryKey: [k] });
    };
  }

  return {
    key,
    url,
    keys,

    useList(params: object = {}, options: { enabled?: boolean } = {}) {
      return useQuery({
        queryKey: keys.list(params),
        queryFn: () => apiList<T>(url, params),
        placeholderData: keepPreviousData,
        ...options,
      });
    },

    /** All rows for pickers (up to 100 — enough for settings lists). */
    useOptions(params: object = {}) {
      return useQuery({
        queryKey: keys.list({ ...params, limit: 100, __options: true }),
        queryFn: async () => (await apiList<T>(url, { ...params, limit: 100 })).rows,
        staleTime: 60_000,
      });
    },

    useOne(id: string | null) {
      return useQuery({
        queryKey: keys.detail(id ?? ''),
        queryFn: async () => (await apiGet<T>(`${url}/${id}`)).data,
        enabled: Boolean(id),
      });
    },

    fetchAll: (params: object) => fetchAllPages<T>(url, params),

    useSave() {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: async ({ id, data }: { id?: string | null; data: Input }) =>
          (await apiSend<T>(id ? 'patch' : 'post', id ? `${url}/${id}` : url, data)).data,
        onSuccess: invalidate,
        // Forms map field errors themselves.
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

export type Resource<T extends { id: string }, Input = unknown> = ReturnType<typeof createResource<T, Input>>;
