import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend } from '@/lib/api';
import { createResource } from '@/lib/resource';
import type {
  Bom,
  BomTree,
  ManufacturingOrder,
  MrpResult,
  Priority,
  ReportName,
  ReportResult,
  WorkCenter,
} from '../types';

const KEY = 'manufacturing';
const M = '/manufacturing';

/** Orders move stock and post journals: refresh inventory and accounting views too. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [KEY, `${KEY}-work-centers`, 'inventory', 'accounting'])
      queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export const workCentersResource = createResource<WorkCenter>(`${KEY}-work-centers`, `${M}/work-centers`, {
  related: [KEY],
});

// ── BOMs ──────────────────────────────────────────────────────────────────

export interface BomInput {
  code: string;
  name: string;
  productId: string;
  variantId: string | null;
  quantity: string;
  notes: string | null;
  items: {
    productId: string;
    variantId: string | null;
    unitId: string | null;
    quantity: string;
    wastagePercent: string;
    notes: string | null;
  }[];
  byproducts: { productId: string; variantId: string | null; quantity: string; costSharePercent: string }[];
  operations: {
    name: string;
    workCenterId: string;
    setupMinutes: string;
    runMinutes: string;
    notes: string | null;
  }[];
  qualityChecks: { name: string; instructions: string | null }[];
}

export function useBoms(params: object) {
  return useQuery({
    queryKey: [KEY, 'boms', params],
    queryFn: () => apiList<Bom>(`${M}/boms`, params),
    placeholderData: keepPreviousData,
  });
}
export function useBom(id: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'bom', id],
    queryFn: async () => (await apiGet<Bom>(`${M}/boms/${id}`)).data,
    enabled: Boolean(id),
  });
}
export function useBomTree(id: string | null | undefined, quantity?: string) {
  return useQuery({
    queryKey: [KEY, 'bom-tree', id, quantity],
    queryFn: async () => (await apiGet<BomTree>(`${M}/boms/${id}/tree`, { quantity })).data,
    enabled: Boolean(id),
  });
}
/** Active BOMs of a product (for the order form). */
export function useProductBoms(productId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'boms', 'product', productId],
    queryFn: async () => (await apiList<Bom>(`${M}/boms`, { productId, status: 'active', limit: 50 })).rows,
    enabled: Boolean(productId),
  });
}
export function useSaveBom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: BomInput }) =>
      (await apiSend<Bom>(id ? 'put' : 'post', id ? `${M}/boms/${id}` : `${M}/boms`, data)).data,
    onSuccess: invalidate,
    onError: () => {},
  });
}
export type BomAction = 'activate' | 'archive' | 'default' | 'new-version' | 'delete';
export function useBomAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: BomAction }) =>
      action === 'delete'
        ? (await apiSend<null>('delete', `${M}/boms/${id}`)).data
        : (await apiSend<Bom>('post', `${M}/boms/${id}/${action}`, action === 'activate' ? {} : undefined))
            .data,
    onSuccess: invalidate,
  });
}

// ── Manufacturing orders ──────────────────────────────────────────────────

export interface OrderInput {
  productId: string;
  variantId: string | null;
  bomId: string | null;
  quantity: string;
  rawWarehouseId: string;
  finishedWarehouseId: string | null;
  priority: Priority;
  plannedStart?: string;
  plannedEnd?: string;
  notes: string | null;
}

export function useOrders(params: object) {
  return useQuery({
    queryKey: [KEY, 'orders', params],
    queryFn: () => apiList<ManufacturingOrder>(`${M}/orders`, params),
    placeholderData: keepPreviousData,
  });
}
export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'order', id],
    queryFn: async () => (await apiGet<ManufacturingOrder>(`${M}/orders/${id}`)).data,
    enabled: Boolean(id),
  });
}
export function useSaveOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: OrderInput }) =>
      (await apiSend<ManufacturingOrder>(id ? 'put' : 'post', id ? `${M}/orders/${id}` : `${M}/orders`, data))
        .data,
    onSuccess: invalidate,
    onError: () => {},
  });
}

export type OrderStep =
  | 'confirm'
  | 'cancel'
  | 'issue'
  | 'return'
  | 'start'
  | 'submit'
  | 'quality'
  | 'scrap'
  | 'complete'
  | 'close'
  | 'reopen';

/** Workflow steps, operation start / finish, reschedule and delete — all return the updated order. */
export function useOrderAction() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      vars:
        | { id: string; step: OrderStep; body?: unknown }
        | { id: string; operation: { id: string; action: 'start' | 'finish' }; body?: unknown }
        | { id: string; schedule: { plannedStart?: string; plannedEnd?: string; priority?: Priority } }
        | { id: string; remove: true },
    ) => {
      if ('remove' in vars) return (await apiSend<null>('delete', `${M}/orders/${vars.id}`)).data;
      if ('schedule' in vars)
        return (await apiSend<ManufacturingOrder>('patch', `${M}/orders/${vars.id}/schedule`, vars.schedule))
          .data;
      const url =
        'operation' in vars
          ? `${M}/orders/${vars.id}/operations/${vars.operation.id}/${vars.operation.action}`
          : `${M}/orders/${vars.id}/${vars.step}`;
      return (await apiSend<ManufacturingOrder>('post', url, vars.body)).data;
    },
    onSuccess: (doc) => {
      if (doc) queryClient.setQueryData([KEY, 'order', doc.id], doc);
      invalidate();
    },
    onError: () => {},
  });
}

export function useOrdersFromSalesOrder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: { salesOrderId: string; rawWarehouseId?: string; plannedStart?: string }) =>
      (await apiSend<ManufacturingOrder[]>('post', `${M}/orders/from-sales-order`, body)).data,
    onSuccess: invalidate,
  });
}

// ── Planning ──────────────────────────────────────────────────────────────

export function useMrp(params: { warehouseId?: string; to?: string; orderId?: string }) {
  return useQuery({
    queryKey: [KEY, 'mrp', params],
    queryFn: async () => (await apiGet<MrpResult>(`${M}/mrp`, params)).data,
    placeholderData: keepPreviousData,
  });
}
export type ShortageLine = { productId: string; variantId: string | null; quantity: string };
export function useMrpRequisition() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: {
      warehouseId?: string | null;
      requiredBy?: string | null;
      lines: ShortageLine[];
    }) => (await apiSend<{ id: string; number: string }>('post', `${M}/mrp/requisition`, body)).data,
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['purchase'] });
    },
  });
}
export function useSubAssemblyOrders() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: { rawWarehouseId?: string; plannedStart?: string; lines: ShortageLine[] }) =>
      (await apiSend<ManufacturingOrder[]>('post', `${M}/mrp/sub-assemblies`, body)).data,
    onSuccess: invalidate,
  });
}
export function useSchedule(params: { from: string; to: string; workCenterId?: string }) {
  return useQuery({
    queryKey: [KEY, 'schedule', params],
    queryFn: async () => (await apiGet<ManufacturingOrder[]>(`${M}/schedule`, params)).data,
    placeholderData: keepPreviousData,
  });
}
export function useManufacturingReport(name: ReportName, params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [KEY, 'report', name, params],
    queryFn: async () => (await apiGet<ReportResult>(`${M}/reports/${name}`, params)).data,
    placeholderData: keepPreviousData,
  });
}

/** The planning board: up to 50 orders per open status, earliest planned first. */
export const BOARD_STATUSES = [
  'draft',
  'confirmed',
  'material_issued',
  'in_progress',
  'quality_check',
  'completed',
] as const;
export function useBoard() {
  return useQuery({
    queryKey: [KEY, 'board'],
    queryFn: async () => {
      const lists = await Promise.all(
        BOARD_STATUSES.map((status) =>
          apiList<ManufacturingOrder>(`${M}/orders`, { status, sort: 'plannedStart', limit: 50 }),
        ),
      );
      const board = {} as Record<(typeof BOARD_STATUSES)[number], (typeof lists)[number]>;
      BOARD_STATUSES.forEach((s, i) => {
        board[s] = lists[i];
      });
      return board;
    },
  });
}
