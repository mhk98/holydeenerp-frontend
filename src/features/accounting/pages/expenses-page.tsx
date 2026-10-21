import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Tags } from 'lucide-react';
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
import { expenseCategoriesResource, useExpenses } from '../api/banking-api';
import { ACCOUNTING_ROUTES, DOC_TONE } from '../lib';
import type { Expense } from '../types';

/** Expenses paid from cash / bank, by category. */
export default function ExpensesPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useListParams({
    defaultSort: '-expenseDate',
    filterKeys: ['status', 'categoryId', 'from', 'to'],
  });
  const query = useExpenses(list.query);
  const categories = expenseCategoriesResource.useOptions();
  const { filters } = list.state;

  const columns = useMemo<ColumnDef<Expense, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('accounting.journals.number') },
        header: sortableHeader(t('accounting.journals.number')),
        cell: ({ row }) => (
          <Link
            to={`${ACCOUNTING_ROUTES.expenses}/${row.original.id}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'expenseDate',
        meta: { label: t('accounting.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('accounting.date')),
        cell: ({ row }) => formatDate(row.original.expenseDate),
      },
      {
        id: 'category',
        enableSorting: false,
        meta: { label: t('accounting.expenses.category') },
        header: t('accounting.expenses.category'),
        cell: ({ row }) => row.original.category?.name ?? '—',
      },
      {
        id: 'payee',
        enableSorting: false,
        meta: { label: t('accounting.expenses.payee'), cellClassName: 'max-w-xs truncate' },
        header: t('accounting.expenses.payee'),
        cell: ({ row }) => [row.original.payee, row.original.description].filter(Boolean).join(' · ') || '—',
      },
      {
        id: 'paidFrom',
        enableSorting: false,
        meta: { label: t('accounting.vouchers.paidFrom'), cellClassName: 'text-muted-foreground' },
        header: t('accounting.vouchers.paidFrom'),
        cell: ({ row }) => row.original.bankAccount?.name ?? '—',
      },
      {
        id: 'total',
        meta: {
          label: t('accounting.total'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('accounting.total')),
        cell: ({ row }) => formatCurrency(row.original.total),
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
      <Button asChild>
        <Link to={`${ACCOUNTING_ROUTES.expenses}/new`}>
          <Plus aria-hidden /> {t('accounting.expenses.new')}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('accounting.expenses.title')}
        description={t('accounting.expenses.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.expenses.title') }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={ACCOUNTING_ROUTES.expenseCategories}>
                <Tags aria-hidden /> {t('accounting.expenseCategories.title')}
              </Link>
            </Button>
            {newButton}
          </>
        }
      />
      <DataTable
        storageKey="accounting.expenses"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('accounting.expenses.search')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: (['draft', 'posted', 'void'] as const).map((s) => ({
              value: s,
              label: t(`accounting.docStatus.${s}`),
            })),
          },
          {
            key: 'categoryId',
            label: t('accounting.expenses.category'),
            options: (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
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
                filename: 'expenses',
                title: t('accounting.expenses.title'),
                columns: [
                  { header: t('accounting.journals.number'), value: (r) => r.number },
                  { header: t('accounting.date'), value: (r) => r.expenseDate },
                  { header: t('accounting.expenses.category'), value: (r) => r.category?.name },
                  { header: t('accounting.expenses.payee'), value: (r) => r.payee },
                  { header: t('accounting.journals.reference'), value: (r) => r.reference },
                  { header: t('accounting.amount'), value: (r) => r.amount },
                  { header: t('accounting.expenses.vat'), value: (r) => r.taxAmount },
                  { header: t('accounting.total'), value: (r) => r.total },
                  { header: t('accounting.vouchers.paidFrom'), value: (r) => r.bankAccount?.name },
                  { header: t('common.status'), value: (r) => t(`accounting.docStatus.${r.status}`) },
                ],
                fetchAll: () =>
                  fetchAllPages<Expense>('/accounting/expenses', {
                    ...list.query,
                    page: undefined,
                    limit: undefined,
                  }),
              }
            : undefined
        }
        empty={{ title: t('accounting.expenses.empty'), action: newButton }}
      />
    </>
  );
}
