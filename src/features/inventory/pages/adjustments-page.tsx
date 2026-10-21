import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { formatCurrency, formatDate } from '@/lib/format';
import type { AdjustmentStatus, StockAdjustment } from '@/types';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adjustmentsApi } from '../api/inventory-api';
import { DocStatusBadge } from '../components/inventory-badges';
import { WarehouseSelect } from '../components/warehouse-select';
import { ADJUSTMENT_KINDS } from '../schemas';

const STATUSES: AdjustmentStatus[] = ['draft', 'pending_approval', 'posted', 'rejected', 'cancelled'];

/** Adjustments, opening stock, damage and scrap documents. */
export default function AdjustmentsPage() {
  const { t } = useTranslation();
  const list = useListParams({ defaultSort: '-createdAt', filterKeys: ['kind', 'status', 'warehouseId'] });
  const query = adjustmentsApi.useList(list.query);
  const kind = list.state.filters.kind ?? '';

  const columns = useMemo<ColumnDef<StockAdjustment, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('inventory.number') },
        header: sortableHeader(t('inventory.number')),
        cell: ({ row: { original: a } }) => (
          <Link
            to={`/inventory/adjustments/${a.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {a.number}
          </Link>
        ),
      },
      {
        id: 'adjustmentDate',
        meta: { label: t('inventory.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('inventory.date')),
        cell: ({ row }) => formatDate(row.original.adjustmentDate),
      },
      {
        id: 'kind',
        enableSorting: false,
        meta: { label: t('fields.type') },
        header: t('fields.type'),
        cell: ({ row }) => t(`inventory.kinds.${row.original.kind}`),
      },
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name,
      },
      {
        id: 'reason',
        enableSorting: false,
        meta: { label: t('inventory.reason') },
        header: t('inventory.reason'),
        cell: ({ row }) => (row.original.reason ? t(`inventory.reasons.${row.original.reason}`) : '—'),
      },
      {
        id: 'items',
        enableSorting: false,
        meta: {
          label: t('inventory.items'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.items'),
        cell: ({ row }) => row.original.itemsCount ?? '—',
      },
      {
        id: 'totalValue',
        meta: {
          label: t('inventory.value'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('inventory.value')),
        cell: ({ row }) => (row.original.status === 'posted' ? formatCurrency(row.original.totalValue) : '—'),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => <DocStatusBadge status={row.original.status} />,
      },
      {
        id: 'creator',
        enableSorting: false,
        meta: { label: t('inventory.createdBy'), cellClassName: 'text-muted-foreground' },
        header: t('inventory.createdBy'),
        cell: ({ row }) => row.original.creator?.name ?? '—',
      },
    ],
    [t],
  );

  const newButton = (
    <Can permission="inventory.create">
      <Button asChild>
        <Link to={`/inventory/adjustments/new${kind ? `?kind=${kind}` : ''}`}>
          <Plus aria-hidden /> {t(`inventory.kindsNew.${kind || 'adjustment'}`)}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('inventory.adjustments.title')}
        description={t('inventory.adjustments.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.adjustments.title') }]}
        actions={newButton}
      />
      <Tabs
        value={kind || 'all'}
        onValueChange={(v) => list.setState({ filters: { kind: v === 'all' ? '' : v } })}
        className="mb-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
          {ADJUSTMENT_KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`inventory.kindsPlural.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        storageKey="inventory-adjustments"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('inventory.searchDocuments')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: STATUSES.map((s) => ({ value: s, label: t(`inventory.status.${s}`) })),
          },
        ]}
        toolbarActions={
          <WarehouseSelect
            allowAll
            value={list.state.filters.warehouseId ?? null}
            onChange={(id) => list.setState({ filters: { warehouseId: id ?? '' } })}
            className="sm:w-56"
            aria-label={t('inventory.warehouse')}
          />
        }
        empty={{ title: t('inventory.adjustments.empty'), action: newButton }}
      />
    </>
  );
}
