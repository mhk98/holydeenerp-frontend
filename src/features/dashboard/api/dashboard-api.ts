import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '@/lib/api';
import { useSettingsStore } from '@/stores/settings-store';

export type DashboardRange = 'today' | 'week' | 'month' | 'custom';
export interface DashboardParams {
  range: DashboardRange;
  from?: string;
  to?: string;
}

export interface Period {
  range: DashboardRange;
  today: string;
  from: string;
  to: string;
  previous: { from: string; to: string };
  bucket: 'day' | 'month';
}
export interface Kpi {
  value: string;
  previous: string | null;
  changePercent: string | null;
  late?: number;
}
export type KpiKey =
  | 'sales'
  | 'purchases'
  | 'grossProfit'
  | 'receivables'
  | 'payables'
  | 'cashBalance'
  | 'stockValue'
  | 'pendingProduction';

export interface Charts {
  salesVsPurchases?: { bucket: string; sales?: string; purchases?: string }[];
  salesByCategory?: { categoryId: string | null; name: string | null; amount: string }[];
  topProducts?: { productId: string; name: string; sku: string; amount: string; quantity: string }[];
  monthlyProfit?: { bucket: string; sales: string; grossProfit: string; netProfit: string }[];
  productionOutput?: { bucket: string; quantity: string; cost: string }[];
}

export interface Approval {
  type: 'stock_adjustment' | 'stock_count' | 'purchase_requisition' | 'purchase_order';
  id: string;
  number: string;
  date: string;
  amount: string | null;
  requestedBy: string | null;
  at: string;
  approvePath: string;
}
export interface Activity {
  type: string;
  id: string;
  number: string;
  status: string;
  amount: string | null;
  user: string | null;
  at: string;
}
export interface Widgets {
  overdueInvoices?: {
    count: number;
    total: string;
    rows: {
      id: string;
      number: string;
      dueDate: string;
      balance: string;
      customer: string;
      daysOverdue: number;
    }[];
  };
  pendingApprovals?: Approval[];
  recentActivity?: Activity[];
  mySales?: {
    count: number;
    total: string;
    session: { id: string; number: string; openedAt: string; register: string } | null;
  };
  assetMaintenance: { available: boolean; rows: unknown[] };
}

const KEY = 'dashboard';

/** Dashboard queries follow the topbar branch (sent as X-Branch-Id), so it is part of the key. */
function useDashboardQuery<T>(part: 'kpis' | 'charts' | 'widgets', params: DashboardParams | object) {
  const branch = useSettingsStore((s) => s.activeBranchId);
  return useQuery({
    queryKey: [KEY, part, branch, params],
    queryFn: async () => (await apiGet<T>(`/dashboard/${part}`, params)).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export const useDashboardKpis = (params: DashboardParams) =>
  useDashboardQuery<{ period: Period; kpis: Partial<Record<KpiKey, Kpi>> }>('kpis', params);
export const useDashboardCharts = (params: DashboardParams) =>
  useDashboardQuery<{ period: Period; charts: Charts }>('charts', params);
export const useDashboardWidgets = () => useDashboardQuery<{ widgets: Widgets }>('widgets', {});

/** One-click approve through the document's own endpoint, then refresh the widgets. */
export function useApprove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (a: Approval) => apiSend('post', a.approvePath),
    onSuccess: async () => {
      await apiGet('/dashboard/widgets', { refresh: 'true' });
      for (const key of [KEY, 'inventory', 'purchase']) queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}
