import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { fetchAllPages } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import type { StockMovement } from '@/types';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { useMovements } from '../api/inventory-api';
import { MovementTypeLabel, SignedQuantity } from '../components/inventory-badges';
import { WarehouseSelect } from '../components/warehouse-select';
import { MOVEMENT_TYPES } from '../schemas';
import { referenceLink } from '../lib';

/** The stock ledger: every movement, newest first. Read-only by design. */
export default function MovementsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({
    defaultSort: '-id',
    filterKeys: ['warehouseId', 'movementType', 'productId', 'from', 'to'],
  });
  const query = useMovements(list.query);
  const { filters } = list.state;

  const columns = useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      {
        id: 'movementDate',
        meta: { label: t('inventory.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('inventory.date')),
        cell: ({ row: { original: m } }) => (
          <div>
            <div>{formatDate(m.movementDate)}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</div>
          </div>
        ),
      },
      {
        id: 'type',
        enableSorting: false,
        meta: { label: t('fields.type') },
        header: t('fields.type'),
        cell: ({ row }) => (
          <MovementTypeLabel type={row.original.movementType} quantity={row.original.quantity} />
        ),
      },
      {
        id: 'reference',
        enableSorting: false,
        meta: { label: t('inventory.reference') },
        header: t('inventory.reference'),
        cell: ({ row: { original: m } }) => {
          const link = referenceLink(m.referenceType, m.referenceId);
          return link ? (
            <Link to={link} className="font-mono text-xs text-primary hover:underline">
              {m.referenceNo}
            </Link>
          ) : (
            <span className="font-mono text-xs">{m.referenceNo ?? '—'}</span>
          );
        },
      },
      {
        id: 'item',
        enableSorting: false,
        meta: { label: t('inventory.item') },
        header: t('inventory.item'),
        cell: ({ row: { original: m } }) => (
          <div className="min-w-48">
            <Link
              to={`/inventory/stock/${m.product.id}${m.variant ? `?variantId=${m.variant.id}` : ''}`}
              className="line-clamp-1 font-medium hover:underline"
            >
              {m.product.name}
              {m.variant && ` — ${m.variant.name}`}
            </Link>
            <div className="text-xs text-muted-foreground">
              <code className="font-mono">{m.variant?.sku ?? m.product.sku}</code>
              {m.batch && (
                <>
                  {' · '}
                  {t('inventory.batch')} <span className="font-mono">{m.batch.batchNo}</span>
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse.name,
      },
      {
        id: 'quantity',
        meta: { label: t('inventory.quantity'), headerClassName: 'text-right', cellClassName: 'text-right' },
        header: sortableHeader(t('inventory.quantity')),
        cell: ({ row }) => <SignedQuantity value={row.original.quantity} />,
      },
      {
        id: 'unitCost',
        enableSorting: false,
        meta: {
          label: t('inventory.unitCost'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.unitCost'),
        cell: ({ row }) => formatCurrency(row.original.unitCost),
      },
      {
        id: 'totalCost',
        meta: {
          label: t('inventory.value'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('inventory.value')),
        cell: ({ row }) => formatCurrency(row.original.totalCost),
      },
      {
        id: 'balance',
        enableSorting: false,
        meta: {
          label: t('inventory.balanceAfter'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.balanceAfter'),
        cell: ({ row }) => formatQuantity(row.original.balanceQuantity),
      },
      {
        id: 'user',
        enableSorting: false,
        meta: { label: t('inventory.by'), cellClassName: 'text-muted-foreground' },
        header: t('inventory.by'),
        cell: ({ row }) => row.original.creator?.name ?? '—',
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('inventory.movements.title')}
        description={t('inventory.movements.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.movements.title') }]}
        actions={
          <WarehouseSelect
            allowAll
            value={filters.warehouseId ?? null}
            onChange={(id) => list.setState({ filters: { warehouseId: id ?? '' } })}
            className="sm:w-64"
            aria-label={t('inventory.warehouse')}
          />
        }
      />
      <DataTable
        storageKey="inventory-movements"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('inventory.movements.searchPlaceholder')}
        filters={[
          {
            key: 'movementType',
            label: t('fields.type'),
            options: MOVEMENT_TYPES.map((m) => ({ value: m, label: t(`inventory.movementTypes.${m}`) })),
          },
        ]}
        toolbarActions={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={filters.from ?? ''}
              onChange={(e) => list.setState({ filters: { from: e.target.value } })}
              aria-label={t('inventory.from')}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              className="w-40"
              value={filters.to ?? ''}
              onChange={(e) => list.setState({ filters: { to: e.target.value } })}
              aria-label={t('inventory.to')}
            />
          </div>
        }
        exporter={
          can('inventory.export')
            ? {
                filename: 'stock-ledger',
                title: t('inventory.movements.title'),
                columns: [
                  { header: t('inventory.date'), value: (m) => m.movementDate },
                  { header: t('fields.type'), value: (m) => t(`inventory.movementTypes.${m.movementType}`) },
                  { header: t('inventory.reference'), value: (m) => m.referenceNo },
                  { header: t('products.sku'), value: (m) => m.variant?.sku ?? m.product.sku },
                  {
                    header: t('inventory.item'),
                    value: (m) => (m.variant ? `${m.product.name} — ${m.variant.name}` : m.product.name),
                  },
                  { header: t('inventory.batch'), value: (m) => m.batch?.batchNo },
                  { header: t('inventory.warehouse'), value: (m) => m.warehouse.name },
                  { header: t('inventory.quantity'), value: (m) => m.quantity },
                  { header: t('inventory.unitCost'), value: (m) => m.unitCost },
                  { header: t('inventory.value'), value: (m) => m.totalCost },
                  { header: t('inventory.balanceAfter'), value: (m) => m.balanceQuantity },
                  { header: t('inventory.by'), value: (m) => m.creator?.name },
                ],
                fetchAll: () =>
                  fetchAllPages<StockMovement>('/inventory/movements', {
                    ...list.query,
                    page: undefined,
                    limit: undefined,
                  }),
              }
            : undefined
        }
        empty={{ title: t('inventory.movements.empty') }}
      />
    </>
  );
}
