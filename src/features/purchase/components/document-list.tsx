import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { fetchAllPages, type apiList } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ExportColumn } from '@/lib/export';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseStatusBadge } from './purchase-ui';
import { SupplierSelect } from './supplier-select';

type ListResult<T> = Awaited<ReturnType<typeof apiList<T>>>;

interface Props<T extends { id: string }> {
  /** i18n key prefix: `${keyPrefix}.title`, `.description`, `.empty`. */
  keyPrefix: string;
  route: string;
  url: string;
  useList: (params: object) => UseQueryResult<ListResult<T>>;
  /** Columns after Number/Date and before Status. */
  columns: ColumnDef<T, unknown>[];
  dateField: keyof T & string;
  dateSortKey: string;
  statuses: readonly string[];
  /** Status tabs shown above the table (subset of statuses). */
  tabs?: readonly string[];
  /** Extra filter keys kept in the URL (e.g. "type"). */
  filterKeys?: string[];
  extraFilters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  actions?: ReactNode;
  exportColumns?: ExportColumn<T>[];
  showSupplier?: boolean;
  /** Purchase (supplier) or sales (customer) documents. */
  module?: 'purchase' | 'sales';
}

const MODULES = {
  purchase: { party: 'supplier', partyLabel: 'purchase.supplier', crumb: 'nav.purchases' },
  sales: { party: 'customer', partyLabel: 'sales.customer', crumb: 'nav.sales' },
} as const;

/** List page shared by every purchase and sales document. */
export function DocumentList<T extends { id: string; number: string; status: string }>({
  keyPrefix,
  route,
  url,
  useList,
  columns,
  dateField,
  dateSortKey,
  statuses,
  tabs,
  filterKeys = [],
  extraFilters = [],
  actions,
  exportColumns,
  showSupplier = true,
  module = 'purchase',
}: Props<T>) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const cfg = MODULES[module];
  const partyKey = `${cfg.party}Id`;
  const list = useListParams({
    defaultSort: '-createdAt',
    filterKeys: ['status', partyKey, 'from', 'to', ...filterKeys],
  });
  const query = useList(list.query);
  const { filters } = list.state;

  const all: ColumnDef<T, unknown>[] = [
    {
      id: 'number',
      enableHiding: false,
      meta: { label: t('purchase.number') },
      header: sortableHeader(t('purchase.number')),
      cell: ({ row }) => (
        <Link to={`${route}/${row.original.id}`} className="font-mono text-sm font-medium hover:underline">
          {row.original.number}
        </Link>
      ),
    },
    {
      id: dateSortKey,
      meta: { label: t('purchase.date'), cellClassName: 'whitespace-nowrap' },
      header: sortableHeader(t('purchase.date')),
      cell: ({ row }) => formatDate(row.original[dateField] as string),
    },
    ...(showSupplier
      ? [
          {
            id: cfg.party,
            enableSorting: false,
            meta: { label: t(cfg.partyLabel) },
            header: t(cfg.partyLabel),
            cell: ({ row }: { row: { original: T } }) =>
              (row.original as unknown as Record<string, { name: string } | undefined>)[cfg.party]?.name ??
              '—',
          } as ColumnDef<T, unknown>,
        ]
      : []),
    ...columns,
    {
      id: 'status',
      enableSorting: false,
      meta: { label: t('common.status') },
      header: t('common.status'),
      cell: ({ row }) => <PurchaseStatusBadge status={row.original.status} module={module} />,
    },
    {
      id: 'creator',
      enableSorting: false,
      meta: { label: t('inventory.createdBy'), cellClassName: 'text-muted-foreground' },
      header: t('inventory.createdBy'),
      cell: ({ row }) =>
        (row.original as unknown as { creator?: { name: string } | null }).creator?.name ?? '—',
    },
  ];

  return (
    <>
      <PageHeader
        title={t(`${keyPrefix}.title`)}
        description={t(`${keyPrefix}.description`)}
        breadcrumbs={[{ label: t(cfg.crumb) }, { label: t(`${keyPrefix}.title`) }]}
        actions={actions}
      />
      {tabs && (
        <Tabs
          value={filters.status ?? 'all'}
          onValueChange={(v) => list.setState({ filters: { status: v === 'all' ? '' : v } })}
          className="mb-4"
        >
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
            {tabs.map((s) => (
              <TabsTrigger key={s} value={s}>
                {t(`${module}.status.${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <DataTable
        storageKey={keyPrefix}
        columns={all}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('purchase.searchDocuments')}
        filters={[
          ...(tabs
            ? []
            : [
                {
                  key: 'status',
                  label: t('common.status'),
                  options: statuses.map((s) => ({ value: s, label: t(`${module}.status.${s}`) })),
                },
              ]),
          ...extraFilters,
        ]}
        toolbarActions={
          <div className="flex flex-wrap items-center gap-2">
            {showSupplier && (
              <div className="w-56">
                <SupplierSelect
                  type={cfg.party}
                  value={filters[partyKey] ?? null}
                  onChange={(id) => list.setState({ filters: { [partyKey]: id } })}
                />
              </div>
            )}
            <Input
              type="date"
              className="w-40"
              value={filters.from ?? ''}
              onChange={(e) => list.setState({ filters: { from: e.target.value } })}
              aria-label={t('inventory.from')}
            />
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
          can(`${module}.export`) && exportColumns
            ? {
                filename: keyPrefix.replace(`${module}.`, ''),
                title: t(`${keyPrefix}.title`),
                columns: [
                  { header: t('purchase.number'), value: (r) => r.number },
                  { header: t('purchase.date'), value: (r) => r[dateField] as string },
                  ...exportColumns,
                  { header: t('common.status'), value: (r) => t(`${module}.status.${r.status}`) },
                ],
                fetchAll: () => fetchAllPages<T>(url, { ...list.query, page: undefined, limit: undefined }),
              }
            : undefined
        }
        empty={{ title: t(`${keyPrefix}.empty`), action: actions }}
      />
    </>
  );
}
