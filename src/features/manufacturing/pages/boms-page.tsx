import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Factory, Plus, Star } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { fetchAllPages } from '@/lib/api';
import { formatDate, formatQuantity } from '@/lib/format';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBoms } from '../api/manufacturing-api';
import { BOM_TONE, MFG_ROUTES, productLabel } from '../lib';
import type { Bom, BomStatus } from '../types';

const STATUSES: BomStatus[] = ['draft', 'active', 'archived'];

/** Bills of materials, with their versions. */
export default function BomsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({ defaultSort: 'code', filterKeys: ['status', 'productId'] });
  const query = useBoms(list.query);
  const { filters } = list.state;

  const columns = useMemo<ColumnDef<Bom, unknown>[]>(
    () => [
      {
        id: 'code',
        enableHiding: false,
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: ({ row }) => (
          <Link
            to={`${MFG_ROUTES.boms}/${row.original.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        id: 'name',
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            {row.original.name}
            {row.original.isDefault && (
              <Star
                className="size-3.5 fill-amber-400 text-amber-400"
                aria-label={t('manufacturing.boms.default')}
              />
            )}
          </span>
        ),
      },
      {
        id: 'product',
        enableSorting: false,
        meta: { label: t('manufacturing.product') },
        header: t('manufacturing.product'),
        cell: ({ row }) => productLabel(row.original.product, row.original.variant),
      },
      {
        id: 'version',
        meta: { label: t('manufacturing.boms.version'), cellClassName: 'tabular-nums' },
        header: sortableHeader(t('manufacturing.boms.version')),
        cell: ({ row }) => `v${row.original.version}`,
      },
      {
        id: 'quantity',
        enableSorting: false,
        meta: {
          label: t('manufacturing.boms.output'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('manufacturing.boms.output'),
        cell: ({ row }) => formatQuantity(row.original.quantity),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={BOM_TONE[row.original.status]}>
            {t(`manufacturing.bomStatus.${row.original.status}`)}
          </StatusBadge>
        ),
      },
      {
        id: 'createdAt',
        meta: { label: t('manufacturing.createdAt'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('manufacturing.createdAt')),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [t],
  );

  const newButton = (
    <Can permission="manufacturing.create">
      <Button asChild>
        <Link to={`${MFG_ROUTES.boms}/new`}>
          <Plus aria-hidden /> {t('manufacturing.boms.new')}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('manufacturing.boms.title')}
        description={t('manufacturing.boms.description')}
        breadcrumbs={[{ label: t('nav.manufacturing') }, { label: t('manufacturing.boms.title') }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={MFG_ROUTES.workCenters}>
                <Factory aria-hidden /> {t('manufacturing.workCenters.title')}
              </Link>
            </Button>
            {newButton}
          </>
        }
      />
      <Tabs
        value={filters.status ?? 'all'}
        onValueChange={(value) => list.setState({ filters: { status: value === 'all' ? '' : value } })}
        className="mb-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(`manufacturing.bomStatus.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        storageKey="manufacturing.boms"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('manufacturing.boms.search')}
        exporter={
          can('manufacturing.export')
            ? {
                filename: 'bills-of-materials',
                title: t('manufacturing.boms.title'),
                columns: [
                  { header: t('fields.code'), value: (r) => r.code },
                  { header: t('fields.name'), value: (r) => r.name },
                  { header: t('manufacturing.product'), value: (r) => productLabel(r.product, r.variant) },
                  { header: t('manufacturing.boms.version'), value: (r) => r.version },
                  { header: t('manufacturing.boms.output'), value: (r) => r.quantity },
                  { header: t('common.status'), value: (r) => t(`manufacturing.bomStatus.${r.status}`) },
                ],
                fetchAll: () =>
                  fetchAllPages<Bom>('/manufacturing/boms', {
                    ...list.query,
                    page: undefined,
                    limit: undefined,
                  }),
              }
            : undefined
        }
        empty={{ title: t('manufacturing.boms.empty'), action: newButton }}
      />
    </>
  );
}
