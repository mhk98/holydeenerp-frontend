import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListParams } from '@/hooks/use-list-params';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import type { SerialStatus, StockSerialRow } from '@/types';
import { codeCell, sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge, type StatusTone } from '@/components/common/status-badge';
import { useSerials } from '../api/inventory-api';
import { WarehouseSelect } from '../components/warehouse-select';

const STATUSES: SerialStatus[] = ['in_stock', 'in_transit', 'issued', 'damaged', 'scrapped', 'written_off'];
const TONE: Record<SerialStatus, StatusTone> = {
  in_stock: 'success',
  in_transit: 'info',
  issued: 'neutral',
  damaged: 'warning',
  scrapped: 'danger',
  written_off: 'danger',
};

/** Look up serial numbers: where each unit is and what happened to it. */
export default function SerialsPage() {
  const { t } = useTranslation();
  const list = useListParams({ defaultSort: 'serialNo', filterKeys: ['warehouseId', 'status', 'productId'] });
  const query = useSerials(list.query);

  const columns = useMemo<ColumnDef<StockSerialRow, unknown>[]>(
    () => [
      {
        id: 'serialNo',
        meta: { label: t('inventory.serialNo') },
        header: sortableHeader(t('inventory.serialNo')),
        cell: codeCell((s) => s.serialNo),
      },
      {
        id: 'item',
        enableSorting: false,
        meta: { label: t('inventory.item') },
        header: t('inventory.item'),
        cell: ({ row: { original: s } }) => (
          <Link to={`/inventory/stock/${s.product.id}`} className="font-medium hover:underline">
            {s.product.name}
            {s.variant && ` — ${s.variant.name}`}
          </Link>
        ),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={TONE[row.original.status]}>
            {t(`inventory.serialStatus.${row.original.status}`)}
          </StatusBadge>
        ),
      },
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name ?? '—',
      },
      {
        id: 'batch',
        enableSorting: false,
        meta: { label: t('inventory.batch') },
        header: t('inventory.batch'),
        cell: ({ row: { original: s } }) =>
          s.batch ? (
            <span className="font-mono text-xs">
              {s.batch.batchNo}
              {s.batch.expiryDate && (
                <span className="text-muted-foreground"> · {formatDate(s.batch.expiryDate)}</span>
              )}
            </span>
          ) : (
            '—'
          ),
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
        id: 'updatedAt',
        meta: {
          label: t('inventory.lastMovement'),
          cellClassName: 'text-muted-foreground whitespace-nowrap',
        },
        header: sortableHeader(t('inventory.lastMovement')),
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('inventory.serials.title')}
        description={t('inventory.serials.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.serials.title') }]}
        actions={
          <WarehouseSelect
            allowAll
            value={list.state.filters.warehouseId ?? null}
            onChange={(id) => list.setState({ filters: { warehouseId: id ?? '' } })}
            className="sm:w-64"
            aria-label={t('inventory.warehouse')}
          />
        }
      />
      <DataTable
        storageKey="inventory-serials"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('inventory.serials.searchPlaceholder')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: STATUSES.map((s) => ({ value: s, label: t(`inventory.serialStatus.${s}`) })),
          },
        ]}
        empty={{ title: t('inventory.serials.empty') }}
      />
    </>
  );
}
