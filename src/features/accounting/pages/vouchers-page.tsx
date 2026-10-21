import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { fetchAllPages } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVouchers } from '../api/banking-api';
import { ACCOUNTING_ROUTES, DOC_TONE, VOUCHER_ICON } from '../lib';
import type { Voucher, VoucherType } from '../types';

const TYPES: VoucherType[] = ['receipt', 'payment', 'contra'];

/** Receipt, payment and contra vouchers. */
export default function VouchersPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({
    defaultSort: '-voucherDate',
    filterKeys: ['voucherType', 'status', 'from', 'to'],
  });
  const query = useVouchers(list.query);
  const { filters } = list.state;

  const columns = useMemo<ColumnDef<Voucher, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('accounting.journals.number') },
        header: sortableHeader(t('accounting.journals.number')),
        cell: ({ row }) => (
          <Link
            to={`${ACCOUNTING_ROUTES.vouchers}/${row.original.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'voucherDate',
        meta: { label: t('accounting.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('accounting.date')),
        cell: ({ row }) => formatDate(row.original.voucherDate),
      },
      {
        id: 'type',
        enableSorting: false,
        meta: { label: t('accounting.journals.entryType') },
        header: t('accounting.journals.entryType'),
        cell: ({ row }) => {
          const Icon = VOUCHER_ICON[row.original.voucherType];
          return (
            <span className="flex items-center gap-1.5">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              {t(`accounting.vouchers.types.${row.original.voucherType}`)}
            </span>
          );
        },
      },
      {
        id: 'account',
        enableSorting: false,
        meta: { label: t('accounting.bank.account') },
        header: t('accounting.bank.account'),
        cell: ({ row: { original: v } }) =>
          v.voucherType === 'contra'
            ? `${v.bankAccount?.name} → ${v.toBankAccount?.name}`
            : v.bankAccount?.name,
      },
      {
        id: 'narration',
        enableSorting: false,
        meta: { label: t('accounting.journals.narration'), cellClassName: 'max-w-sm truncate' },
        header: t('accounting.journals.narration'),
        cell: ({ row }) =>
          [row.original.partyName, row.original.narration].filter(Boolean).join(' · ') || '—',
      },
      {
        id: 'amount',
        meta: {
          label: t('accounting.amount'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('accounting.amount')),
        cell: ({ row }) => formatCurrency(row.original.amount),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={DOC_TONE[row.original.status]}>
            {t(`accounting.docStatus.${row.original.status}`)}
          </StatusBadge>
        ),
      },
    ],
    [t],
  );

  const newButton = (
    <Can permission="accounting.create">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus aria-hidden /> {t('accounting.vouchers.new')} <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {TYPES.map((type) => {
            const Icon = VOUCHER_ICON[type];
            return (
              <DropdownMenuItem key={type} asChild>
                <Link to={`${ACCOUNTING_ROUTES.vouchers}/new?type=${type}`}>
                  <Icon aria-hidden /> {t(`accounting.vouchers.types.${type}`)}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('accounting.vouchers.title')}
        description={t('accounting.vouchers.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.vouchers.title') }]}
        actions={newButton}
      />
      <Tabs
        value={filters.voucherType ?? 'all'}
        onValueChange={(value) => list.setState({ filters: { voucherType: value === 'all' ? '' : value } })}
        className="mb-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
          {TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {t(`accounting.vouchers.types.${type}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        storageKey="accounting.vouchers"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('accounting.vouchers.search')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: (['draft', 'posted', 'void'] as const).map((s) => ({
              value: s,
              label: t(`accounting.docStatus.${s}`),
            })),
          },
        ]}
        toolbarActions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={filters.from ?? ''}
              onChange={(e) => list.setState({ filters: { from: e.target.value } })}
              aria-label={t('accounting.from')}
            />
            <Input
              type="date"
              className="w-40"
              value={filters.to ?? ''}
              onChange={(e) => list.setState({ filters: { to: e.target.value } })}
              aria-label={t('accounting.to')}
            />
          </div>
        }
        exporter={
          can('accounting.export')
            ? {
                filename: 'vouchers',
                title: t('accounting.vouchers.title'),
                columns: [
                  { header: t('accounting.journals.number'), value: (r) => r.number },
                  { header: t('accounting.date'), value: (r) => r.voucherDate },
                  {
                    header: t('accounting.journals.entryType'),
                    value: (r) => t(`accounting.vouchers.types.${r.voucherType}`),
                  },
                  { header: t('accounting.bank.account'), value: (r) => r.bankAccount?.name },
                  { header: t('accounting.vouchers.partyName'), value: (r) => r.partyName },
                  { header: t('accounting.journals.narration'), value: (r) => r.narration },
                  { header: t('accounting.amount'), value: (r) => r.amount },
                  { header: t('common.status'), value: (r) => t(`accounting.docStatus.${r.status}`) },
                ],
                fetchAll: () =>
                  fetchAllPages<Voucher>('/accounting/vouchers', {
                    ...list.query,
                    page: undefined,
                    limit: undefined,
                  }),
              }
            : undefined
        }
        empty={{ title: t('accounting.vouchers.empty'), action: newButton }}
      />
    </>
  );
}
