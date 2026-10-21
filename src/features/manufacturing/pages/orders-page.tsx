import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { fetchAllPages } from '@/lib/api';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrders } from '../api/manufacturing-api';
import { MFG_ROUTES, MO_TONE, PRIORITIES, PRIORITY_TONE, productLabel } from '../lib';
import type { ManufacturingOrder } from '../types';

const TABS = ['active', 'draft', 'completed', 'closed'] as const;

/** Manufacturing orders: planned, on the shop floor, completed and closed. */
export default function OrdersPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({
    defaultSort: '-createdAt',
    filterKeys: ['status', 'priority', 'active', 'from', 'to'],
  });
  const query = useOrders(list.query);
  const { filters } = list.state;
  const tab = filters.active === 'true' ? 'active' : (filters.status ?? 'all');

  const columns = useMemo<ColumnDef<ManufacturingOrder, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('manufacturing.orders.number') },
        header: sortableHeader(t('manufacturing.orders.number')),
        cell: ({ row }) => (
          <Link
            to={`${MFG_ROUTES.orders}/${row.original.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'product',
        enableSorting: false,
        meta: { label: t('manufacturing.product') },
        header: t('manufacturing.product'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">
              {productLabel(row.original.product, row.original.variant)}
            </div>
            {row.original.salesOrder && (
              <div className="text-xs text-muted-foreground">
                {t('manufacturing.orders.forSalesOrder', { number: row.original.salesOrder.number })}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'quantity',
        meta: {
          label: t('manufacturing.quantity'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('manufacturing.quantity')),
        cell: ({ row }) => formatQuantity(row.original.quantity),
      },
      {
        id: 'plannedStart',
        meta: { label: t('manufacturing.orders.planned'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('manufacturing.orders.planned')),
        cell: ({ row }) =>
          row.original.plannedStart === row.original.plannedEnd
            ? formatDate(row.original.plannedStart)
            : `${formatDate(row.original.plannedStart)} – ${formatDate(row.original.plannedEnd)}`,
      },
      {
        id: 'priority',
        enableSorting: false,
        meta: { label: t('manufacturing.priority') },
        header: t('manufacturing.priority'),
        cell: ({ row }) => (
          <StatusBadge tone={PRIORITY_TONE[row.original.priority]}>
            {t(`manufacturing.priorities.${row.original.priority}`)}
          </StatusBadge>
        ),
      },
      {
        id: 'unitCost',
        enableSorting: false,
        meta: {
          label: t('manufacturing.cost.unit'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('manufacturing.cost.unit'),
        cell: ({ row }) => (Number(row.original.unitCost) ? formatCurrency(row.original.unitCost) : '—'),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={MO_TONE[row.original.status]}>
            {t(`manufacturing.status.${row.original.status}`)}
          </StatusBadge>
        ),
      },
    ],
    [t],
  );

  const newButton = (
    <Can permission="manufacturing.create">
      <Button asChild>
        <Link to={`${MFG_ROUTES.orders}/new`}>
          <Plus aria-hidden /> {t('manufacturing.orders.new')}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('manufacturing.orders.title')}
        description={t('manufacturing.orders.description')}
        breadcrumbs={[{ label: t('nav.manufacturing') }, { label: t('manufacturing.orders.title') }]}
        actions={newButton}
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          list.setState({
            filters:
              value === 'active'
                ? { active: 'true', status: '' }
                : { active: '', status: value === 'all' ? '' : value },
          })
        }
        className="mb-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
          {TABS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(s === 'active' ? 'manufacturing.orders.activeTab' : `manufacturing.status.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        storageKey="manufacturing.orders"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('manufacturing.orders.search')}
        filters={[
          {
            key: 'priority',
            label: t('manufacturing.priority'),
            options: PRIORITIES.map((p) => ({ value: p, label: t(`manufacturing.priorities.${p}`) })),
          },
        ]}
        toolbarActions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={filters.from ?? ''}
              onChange={(e) => list.setState({ filters: { from: e.target.value } })}
              aria-label={t('manufacturing.from')}
            />
            <Input
              type="date"
              className="w-40"
              value={filters.to ?? ''}
              onChange={(e) => list.setState({ filters: { to: e.target.value } })}
              aria-label={t('manufacturing.to')}
            />
          </div>
        }
        exporter={
          can('manufacturing.export')
            ? {
                filename: 'manufacturing-orders',
                title: t('manufacturing.orders.title'),
                columns: [
                  { header: t('manufacturing.orders.number'), value: (r) => r.number },
                  { header: t('manufacturing.product'), value: (r) => productLabel(r.product, r.variant) },
                  { header: t('manufacturing.quantity'), value: (r) => r.quantity },
                  { header: t('manufacturing.orders.goodQuantity'), value: (r) => r.goodQuantity },
                  { header: t('manufacturing.orders.plannedStart'), value: (r) => r.plannedStart },
                  { header: t('manufacturing.orders.plannedEnd'), value: (r) => r.plannedEnd },
                  {
                    header: t('manufacturing.priority'),
                    value: (r) => t(`manufacturing.priorities.${r.priority}`),
                  },
                  { header: t('manufacturing.cost.actualTotal'), value: (r) => r.outputCost },
                  { header: t('manufacturing.cost.unit'), value: (r) => r.unitCost },
                  { header: t('common.status'), value: (r) => t(`manufacturing.status.${r.status}`) },
                ],
                fetchAll: () =>
                  fetchAllPages<ManufacturingOrder>('/manufacturing/orders', {
                    ...list.query,
                    page: undefined,
                    limit: undefined,
                  }),
              }
            : undefined
        }
        empty={{ title: t('manufacturing.orders.empty'), action: newButton }}
      />
    </>
  );
}
