import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Coins, PackageX, SlidersHorizontal, Truck } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatQuantity, formatRelativeTime } from '@/lib/format';
import type { StockRow } from '@/types';
import { Can } from '@/components/common/can';
import { codeCell, sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { brandsResource, flattenTree, useCategoryTree } from '@/features/products/api/products-api';
import { ProductThumb } from '@/features/products/pages/products-page';
import { fetchAllStock, useStock, useStockSummary } from '../api/inventory-api';
import { StockStatusBadge } from '../components/inventory-badges';
import { itemLabel } from '../lib';
import { StatTile } from '../components/stat-tile';
import { WarehouseSelect } from '../components/warehouse-select';

const STATUSES = ['in_stock', 'low', 'out', 'negative'] as const;

/** Current stock per item, for one warehouse or all of the user's warehouses. */
export default function StockPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({
    defaultSort: 'name',
    filterKeys: ['warehouseId', 'status', 'categoryId', 'brandId'],
  });
  const warehouseId = list.state.filters.warehouseId ?? null;
  const query = useStock(list.query);
  const summary = useStockSummary(warehouseId ? { warehouseId } : {});
  const categories = useCategoryTree();
  const brands = brandsResource.useOptions();
  const totals = summary.data?.totals;

  const cardLink = (r: StockRow) =>
    `/inventory/stock/${r.productId}${r.variantId || warehouseId ? '?' : ''}${new URLSearchParams({
      ...(r.variantId && { variantId: r.variantId }),
      ...(warehouseId && { warehouseId }),
    })}`;

  const columns = useMemo<ColumnDef<StockRow, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('inventory.item') },
        header: sortableHeader(t('inventory.item')),
        cell: ({ row: { original: r } }) => (
          <div className="flex min-w-56 items-center gap-2.5">
            <ProductThumb url={r.imageUrl} />
            <div className="min-w-0">
              <Link
                to={cardLink(r)}
                className="line-clamp-1 font-medium hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {itemLabel(r)}
              </Link>
              <div className="text-xs text-muted-foreground">
                {[r.category, r.brand].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'sku',
        meta: { label: t('products.sku') },
        header: sortableHeader(t('products.sku')),
        cell: codeCell((r) => r.sku),
      },
      {
        id: 'quantity',
        meta: { label: t('inventory.onHand'), headerClassName: 'text-right', cellClassName: 'text-right' },
        header: sortableHeader(t('inventory.onHand')),
        cell: ({ row: { original: r } }) => (
          <span className="font-medium tabular-nums">
            {formatQuantity(r.quantity)}{' '}
            <span className="text-xs font-normal text-muted-foreground">{r.unitCode}</span>
          </span>
        ),
      },
      {
        id: 'reorderLevel',
        meta: {
          label: t('inventory.reorderLevel'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums text-muted-foreground',
        },
        header: sortableHeader(t('inventory.reorderLevel')),
        cell: ({ row }) =>
          Number(row.original.reorderLevel) > 0 ? formatQuantity(row.original.reorderLevel) : '—',
      },
      {
        id: 'avgCost',
        enableSorting: false,
        meta: {
          label: t('inventory.avgCost'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.avgCost'),
        cell: ({ row }) => formatCurrency(row.original.avgCost),
      },
      {
        id: 'value',
        meta: {
          label: t('inventory.stockValue'),
          headerClassName: 'text-right',
          cellClassName: 'text-right font-medium tabular-nums',
        },
        header: sortableHeader(t('inventory.stockValue')),
        cell: ({ row }) => formatCurrency(row.original.totalValue),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => <StockStatusBadge status={row.original.status} />,
      },
      {
        id: 'lastMovementAt',
        enableSorting: false,
        meta: {
          label: t('inventory.lastMovement'),
          cellClassName: 'text-muted-foreground whitespace-nowrap',
        },
        header: t('inventory.lastMovement'),
        cell: ({ row }) =>
          row.original.lastMovementAt ? formatRelativeTime(row.original.lastMovementAt) : '—',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardLink depends on warehouseId only
    [t, warehouseId],
  );

  return (
    <>
      <PageHeader
        title={t('inventory.stock.title')}
        description={t('inventory.stock.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.stock.title') }]}
        actions={
          <>
            <WarehouseSelect
              allowAll
              value={warehouseId}
              onChange={(id) => list.setState({ filters: { warehouseId: id ?? '' } })}
              className="sm:w-64"
              aria-label={t('inventory.warehouse')}
            />
            <Can permission="inventory.create">
              <Button variant="outline" asChild>
                <Link to="/inventory/transfers/new">
                  <ArrowLeftRight aria-hidden /> {t('inventory.transfers.new')}
                </Link>
              </Button>
              <Button asChild>
                <Link to="/inventory/adjustments/new">
                  <SlidersHorizontal aria-hidden /> {t('inventory.adjustments.new')}
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Coins}
          label={t('inventory.stockValue')}
          value={formatCurrency(totals?.totalValue)}
          loading={summary.isPending}
        />
        <StatTile
          icon={AlertTriangle}
          tone="warning"
          label={t('inventory.stockStatus.low')}
          value={totals?.lowCount ?? 0}
          loading={summary.isPending}
          to={`?${new URLSearchParams({ ...(warehouseId && { warehouseId }), status: 'low' })}`}
        />
        <StatTile
          icon={PackageX}
          tone="danger"
          label={t('inventory.stockStatus.out')}
          value={totals?.outCount ?? 0}
          loading={summary.isPending}
          to={`?${new URLSearchParams({ ...(warehouseId && { warehouseId }), status: 'out' })}`}
        />
        <StatTile
          icon={Truck}
          tone="info"
          label={t('inventory.incoming')}
          value={formatCurrency(totals?.incomingValue)}
          loading={summary.isPending}
          to="/inventory/transfers?direction=incoming&status=in_transit"
        />
      </div>

      <DataTable
        storageKey="inventory-stock"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.key}
        searchPlaceholder={t('inventory.stock.searchPlaceholder')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: STATUSES.map((s) => ({ value: s, label: t(`inventory.stockStatus.${s}`) })),
          },
          {
            key: 'categoryId',
            label: t('products.category'),
            options: flattenTree(categories.data ?? []).map((o) => ({ value: o.value, label: o.path })),
          },
          {
            key: 'brandId',
            label: t('products.brand'),
            options: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
        ]}
        exporter={
          can('inventory.export')
            ? {
                filename: 'stock',
                title: t('inventory.stock.title'),
                columns: [
                  { header: t('products.sku'), value: (r) => r.sku },
                  { header: t('inventory.item'), value: (r) => itemLabel(r) },
                  { header: t('products.category'), value: (r) => r.category },
                  { header: t('inventory.onHand'), value: (r) => r.quantity },
                  { header: t('products.unit'), value: (r) => r.unitCode },
                  { header: t('inventory.reorderLevel'), value: (r) => r.reorderLevel },
                  { header: t('inventory.avgCost'), value: (r) => r.avgCost },
                  { header: t('inventory.stockValue'), value: (r) => r.totalValue },
                  { header: t('common.status'), value: (r) => t(`inventory.stockStatus.${r.status}`) },
                ],
                fetchAll: () => fetchAllStock({ ...list.query, page: undefined, limit: undefined }),
              }
            : undefined
        }
        empty={{ title: t('inventory.stock.empty') }}
      />
    </>
  );
}
