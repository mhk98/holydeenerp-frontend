import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiList, apiSend } from '@/lib/api';
import type {
  HeldCart,
  HeldOrder,
  PosBootstrap,
  PosCatalog,
  PosCustomer,
  PosRegister,
  PosReturnResult,
  PosSession,
  ReceiptData,
  SalePayload,
} from '../types';

const KEY = 'pos';
const P = '/pos';

export const posApi = {
  bootstrap: async (registerId?: string | null) =>
    (await apiGet<PosBootstrap>(`${P}/bootstrap`, registerId ? { registerId } : undefined)).data,
  catalog: async (registerId: string) => (await apiGet<PosCatalog>(`${P}/catalog`, { registerId })).data,
  customers: async () => (await apiGet<PosCustomer[]>(`${P}/customers`)).data,
  quickCustomer: async (body: { name: string; phone: string | null; email: string | null }) =>
    (await apiSend<PosCustomer>('post', `${P}/customers`, body)).data,

  openSession: async (body: { registerId: string; openingCash: string; notes: string | null }) =>
    (await apiSend<PosSession>('post', `${P}/sessions`, body)).data,
  session: async (id: string) => (await apiGet<PosSession>(`${P}/sessions/${id}`)).data,
  cash: async (id: string, body: { type: 'in' | 'out'; amount: string; reason: string }) =>
    (await apiSend<PosSession>('post', `${P}/sessions/${id}/cash`, body)).data,
  close: async (id: string, body: { denominations: Record<string, number>; notes: string | null }) =>
    (await apiSend<PosSession>('post', `${P}/sessions/${id}/close`, body)).data,
  sessionSales: async (id: string) =>
    (
      await apiGet<
        {
          id: string;
          number: string;
          offlineNumber: string | null;
          total: string;
          status: string;
          postedAt: string;
          stockWarning: boolean;
          customer: { name: string };
        }[]
      >(`${P}/sessions/${id}/sales`)
    ).data,

  sale: async (body: SalePayload) => (await apiSend<ReceiptData>('post', `${P}/sales`, body)).data,
  sync: async (sales: SalePayload[]) =>
    (
      await apiSend<{
        results: {
          clientUuid: string;
          ok: boolean;
          duplicate?: boolean;
          invoice?: { id: string; number: string };
          error?: string;
          retry?: boolean;
        }[];
        synced: number;
        failed: number;
      }>('post', `${P}/sales/sync`, { sales })
    ).data,
  lookup: async (number: string) => (await apiGet<ReceiptData>(`${P}/sales/lookup`, { number })).data,
  receipt: async (id: string) => (await apiGet<ReceiptData>(`${P}/sales/${id}/receipt`)).data,
  returnItems: async (
    invoiceId: string,
    body: {
      registerId: string;
      sessionId: string;
      reason: string | null;
      items: { invoiceItemId: string; quantity: string }[];
      refund?: { paymentMethodId: string; amount?: string };
    },
  ) => (await apiSend<PosReturnResult>('post', `${P}/sales/${invoiceId}/return`, body)).data,

  held: async (registerId: string) => (await apiGet<HeldOrder[]>(`${P}/held`, { registerId })).data,
  hold: async (body: {
    registerId: string;
    label: string;
    customerId: string | null;
    cart: HeldCart;
    total: string;
  }) => (await apiSend<HeldOrder>('post', `${P}/held`, body)).data,
  recall: async (id: string) => (await apiSend<HeldOrder>('post', `${P}/held/${id}/recall`)).data,
};

// ── Back-office hooks (registers, session history) ─────────────────────────
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useRegisters(params: object) {
  return useQuery({
    queryKey: [KEY, 'registers', params],
    queryFn: () => apiList<PosRegister>(`${P}/registers`, params),
    placeholderData: keepPreviousData,
  });
}
export function useSaveRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: object }) =>
      (await apiSend<PosRegister>(id ? 'put' : 'post', id ? `${P}/registers/${id}` : `${P}/registers`, data))
        .data,
    onSuccess: invalidate,
  });
}
export function useDeleteRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiSend('delete', `${P}/registers/${id}`),
    onSuccess: invalidate,
  });
}
export function useSessions(params: object) {
  return useQuery({
    queryKey: [KEY, 'sessions', params],
    queryFn: () => apiList<PosSession>(`${P}/sessions`, params),
    placeholderData: keepPreviousData,
  });
}
export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'session', id],
    queryFn: () => posApi.session(id!),
    enabled: Boolean(id),
  });
}
