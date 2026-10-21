import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { formatCurrency, formatDate } from '@/lib/format';
import type { StockTransfer, TransferStatus } from '@/types';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { transfersApi } from '../api/inventory-api';
import { DocStatusBadge } from '../components/inventory-badges';

const STATUSES: TransferStatus[] = ['draft', 'in_transit', 'received', 'cancelled'];

/** Transfers between warehouses and branches. */
export default function TransfersPage() {
  const { t } = useTranslation();
  const list = useListParams({ defaultSort: '-createdAt', filterKeys: ['status', 'direction'] });
  const query = transfersApi.useList(list.query);
  const direction = list.state.filters.direction ?? '';

  const columns = useMemo<ColumnDef<StockTransfer, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('inventory.number') },
        header: sortableHeader(t('inventory.number')),
        cell: ({ row: { original: tr } }) => (
          <Link
            to={`/inventory/transfers/${tr.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {tr.number}
          </Link>
        ),
      },
      {
        id: 'transferDate',
        meta: { label: t('inventory.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('inventory.date')),
        cell: ({ row }) => formatDate(row.original.transferDate),
      },
      {
        id: 'route',
        enableSorting: false,
        meta: { label: t('inventory.transfers.route') },
        header: t('inventory.transfers.route'),
        cell: ({ row: { original: tr } }) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {tr.fromWarehouse?.name}
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
            {tr.toWarehouse?.name}
          </span>
        ),
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
        cell: ({ row }) => (row.original.status === 'draft' ? '—' : formatCurrency(row.original.totalValue)),
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
        <Link to="/inventory/transfers/new">
          <Plus aria-hidden /> {t('inventory.transfers.new')}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('inventory.transfers.title')}
        description={t('inventory.transfers.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.transfers.title') }]}
        actions={newButton}
      />
      <Tabs
        value={direction || 'all'}
        onValueChange={(v) => list.setState({ filters: { direction: v === 'all' ? '' : v } })}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
          <TabsTrigger value="outgoing">{t('inventory.transfers.outgoing')}</TabsTrigger>
          <TabsTrigger value="incoming">{t('inventory.transfers.incoming')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        storageKey="inventory-transfers"
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
        empty={{ title: t('inventory.transfers.empty'), action: newButton }}
      />
    </>
  );
}
