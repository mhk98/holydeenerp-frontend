import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate, formatNumber } from '@/lib/format';
import type { PriceList } from '@/types';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { priceListsApi, useSalesLookups } from '../api/sales-api';
import { SALES_ROUTES } from '../lib';

/** Price lists per customer group (fixed prices or % off the standard sale price). */
export default function PriceListsPage() {
  const { t } = useTranslation();
  const lookups = useSalesLookups();
  const list = useListParams({ defaultSort: 'name', filterKeys: ['customerGroupId', 'isActive'] });
  const query = priceListsApi.useList(list.query);
  const columns = useMemo<ColumnDef<PriceList, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('sales.priceLists.name') },
        header: sortableHeader(t('sales.priceLists.name')),
        cell: ({ row }) => (
          <Link to={`${SALES_ROUTES.priceList}/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'code',
        meta: { label: t('sales.priceLists.code') },
        header: sortableHeader(t('sales.priceLists.code')),
        cell: ({ row }) => <code className="font-mono text-xs">{row.original.code}</code>,
      },
      {
        id: 'customerGroup',
        enableSorting: false,
        meta: { label: t('sales.priceLists.customerGroup') },
        header: t('sales.priceLists.customerGroup'),
        cell: ({ row }) => row.original.customerGroup?.name ?? t('sales.priceLists.allCustomers'),
      },
      {
        id: 'validity',
        enableSorting: false,
        meta: { label: t('sales.priceLists.validity'), cellClassName: 'whitespace-nowrap' },
        header: t('sales.priceLists.validity'),
        cell: ({ row: { original: p } }) =>
          p.validFrom || p.validTo
            ? `${p.validFrom ? formatDate(p.validFrom) : '…'} – ${p.validTo ? formatDate(p.validTo) : '…'}`
            : t('sales.priceLists.always'),
      },
      {
        id: 'priority',
        meta: {
          label: t('sales.priceLists.priority'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('sales.priceLists.priority')),
        cell: ({ row }) => formatNumber(row.original.priority, { decimals: 0 }),
      },
      {
        id: 'itemsCount',
        enableSorting: false,
        meta: {
          label: t('inventory.items'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.items'),
        cell: ({ row }) => formatNumber(row.original.itemsCount ?? 0, { decimals: 0 }),
      },
      {
        id: 'isActive',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? 'success' : 'neutral'}>
            {t(row.original.isActive ? 'common.active' : 'common.inactive')}
          </StatusBadge>
        ),
      },
    ],
    [t],
  );
  const actions = (
    <Can permission="sales.create">
      <Button asChild>
        <Link to={`${SALES_ROUTES.priceList}/new`}>
          <Plus aria-hidden /> {t('sales.priceLists.new')}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('sales.priceLists.title')}
        description={t('sales.priceLists.description')}
        breadcrumbs={[{ label: t('nav.sales') }, { label: t('sales.priceLists.title') }]}
        actions={actions}
      />
      <DataTable
        storageKey="sales.priceLists"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('sales.priceLists.search')}
        filters={[
          {
            key: 'customerGroupId',
            label: t('sales.priceLists.customerGroup'),
            options: (lookups.data?.customerGroups ?? []).map((g) => ({ value: g.id, label: g.name })),
          },
          {
            key: 'isActive',
            label: t('common.status'),
            options: [
              { value: 'true', label: t('common.active') },
              { value: 'false', label: t('common.inactive') },
            ],
          },
        ]}
        empty={{ title: t('sales.priceLists.empty'), action: actions }}
      />
    </>
  );
}
