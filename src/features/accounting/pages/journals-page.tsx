import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useJournals } from '../api/accounting-api';
import { AccountSelect } from '../components/account-select';
import { ACCOUNTING_ROUTES, ENTRY_TONE, STATUS_TONE } from '../lib';
import type { EntryType, JournalEntry } from '../types';

const ENTRY_TYPES: EntryType[] = ['manual', 'auto', 'opening', 'closing', 'reversal'];

/** Journal entries: manual and automatic, filterable by account, type, status and dates. */
export default function JournalsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({
    defaultSort: '-entryDate',
    filterKeys: ['status', 'entryType', 'accountId', 'from', 'to'],
  });
  const query = useJournals(list.query);
  const { filters } = list.state;

  const columns = useMemo<ColumnDef<JournalEntry, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('accounting.journals.number') },
        header: sortableHeader(t('accounting.journals.number')),
        cell: ({ row }) => (
          <Link
            to={`${ACCOUNTING_ROUTES.journals}/${row.original.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'entryDate',
        meta: { label: t('accounting.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('accounting.date')),
        cell: ({ row }) => formatDate(row.original.entryDate),
      },
      {
        id: 'narration',
        enableSorting: false,
        meta: { label: t('accounting.journals.narration'), cellClassName: 'max-w-md' },
        header: t('accounting.journals.narration'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate">{row.original.narration ?? '—'}</div>
            {(row.original.sourceNo || row.original.reference) && (
              <div className="truncate text-xs text-muted-foreground">
                {[row.original.sourceNo, row.original.reference].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'entryType',
        enableSorting: false,
        meta: { label: t('accounting.journals.entryType') },
        header: t('accounting.journals.entryType'),
        cell: ({ row }) => (
          <StatusBadge tone={ENTRY_TONE[row.original.entryType]}>
            {t(`accounting.entryTypes.${row.original.entryType}`)}
          </StatusBadge>
        ),
      },
      {
        id: 'branch',
        enableSorting: false,
        meta: { label: t('accounting.branch'), cellClassName: 'text-muted-foreground' },
        header: t('accounting.branch'),
        cell: ({ row }) => row.original.branch?.name ?? t('accounting.companyWide'),
      },
      {
        id: 'totalDebit',
        meta: {
          label: t('accounting.amount'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('accounting.amount')),
        cell: ({ row }) => formatCurrency(row.original.totalDebit),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={row.original.reversedById ? 'danger' : STATUS_TONE[row.original.status]}>
            {t(
              row.original.reversedById
                ? 'accounting.journals.reversed'
                : `accounting.status.${row.original.status}`,
            )}
          </StatusBadge>
        ),
      },
    ],
    [t],
  );

  const newButton = (
    <Can permission="accounting.create">
      <Button asChild>
        <Link to={`${ACCOUNTING_ROUTES.journals}/new`}>
          <Plus aria-hidden /> {t('accounting.journals.new')}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('accounting.journals.title')}
        description={t('accounting.journals.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.journals.title') }]}
        actions={newButton}
      />
      <DataTable
        storageKey="accounting.journals"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('accounting.journals.search')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: (['draft', 'posted'] as const).map((s) => ({
              value: s,
              label: t(`accounting.status.${s}`),
            })),
          },
          {
            key: 'entryType',
            label: t('accounting.journals.entryType'),
            options: ENTRY_TYPES.map((s) => ({ value: s, label: t(`accounting.entryTypes.${s}`) })),
          },
        ]}
        toolbarActions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <AccountSelect
                value={filters.accountId ?? null}
                onChange={(id) => list.setState({ filters: { accountId: id ?? '' } })}
                clearLabel={t('accounting.allAccounts')}
                placeholder={t('accounting.allAccounts')}
                aria-label={t('accounting.account')}
              />
            </div>
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
                filename: 'journals',
                title: t('accounting.journals.title'),
                columns: [
                  { header: t('accounting.journals.number'), value: (r) => r.number },
                  { header: t('accounting.date'), value: (r) => r.entryDate },
                  { header: t('accounting.journals.narration'), value: (r) => r.narration },
                  { header: t('accounting.journals.source'), value: (r) => r.sourceNo },
                  { header: t('accounting.journals.reference'), value: (r) => r.reference },
                  {
                    header: t('accounting.journals.entryType'),
                    value: (r) => t(`accounting.entryTypes.${r.entryType}`),
                  },
                  { header: t('accounting.branch'), value: (r) => r.branch?.name },
                  { header: t('accounting.amount'), value: (r) => r.totalDebit },
                  { header: t('common.status'), value: (r) => t(`accounting.status.${r.status}`) },
                ],
                fetchAll: () =>
                  fetchAllPages<JournalEntry>('/accounting/journals', {
                    ...list.query,
                    page: undefined,
                    limit: undefined,
                  }),
              }
            : undefined
        }
        empty={{ title: t('accounting.journals.empty'), action: newButton }}
      />
    </>
  );
}
