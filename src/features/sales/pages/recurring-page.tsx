import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import type { RecurringInvoice } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteRecurring, useRecurringList, useRunRecurring } from '../api/sales-api';
import { RecurringDialog } from '../components/recurring-dialog';
import { SALES_ROUTES } from '../lib';

/** Invoices that repeat on a schedule; the daily job creates (and optionally posts and emails) them. */
export default function RecurringPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();
  const list = useListParams({ defaultSort: 'nextRunDate', filterKeys: ['isActive', 'customerId'] });
  const query = useRecurringList(list.query);
  const runNow = useRunRecurring();
  const remove = useDeleteRecurring();
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [deleting, setDeleting] = useState<RecurringInvoice | null>(null);

  const columns = useMemo<ColumnDef<RecurringInvoice, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('sales.recurring.name') },
        header: sortableHeader(t('sales.recurring.name')),
        cell: ({ row: { original: r } }) => (
          <div>
            <div className="font-medium">{r.name}</div>
            {r.sourceInvoiceId && (
              <Link
                to={`${SALES_ROUTES.invoice}/${r.sourceInvoiceId}`}
                className="text-xs text-primary hover:underline"
              >
                {t('sales.recurring.source')}
              </Link>
            )}
          </div>
        ),
      },
      {
        id: 'customer',
        enableSorting: false,
        meta: { label: t('sales.customer') },
        header: t('sales.customer'),
        cell: ({ row }) => row.original.customer?.name ?? '—',
      },
      {
        id: 'frequency',
        enableSorting: false,
        meta: { label: t('sales.recurring.frequency') },
        header: t('sales.recurring.frequency'),
        cell: ({ row: { original: r } }) =>
          t('sales.recurring.everyN', {
            count: r.intervalCount,
            unit: t(`sales.recurring.units.${r.frequency}`, { count: r.intervalCount }),
          }),
      },
      {
        id: 'nextRunDate',
        meta: { label: t('sales.recurring.nextRun'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('sales.recurring.nextRun')),
        cell: ({ row: { original: r } }) => (
          <span className="flex items-center gap-1.5">
            {formatDate(r.nextRunDate)}
            {r.lastError && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle
                    className="size-4 text-destructive"
                    aria-label={t('sales.recurring.lastError')}
                  />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">{r.lastError}</TooltipContent>
              </Tooltip>
            )}
          </span>
        ),
      },
      {
        id: 'total',
        enableSorting: false,
        meta: {
          label: t('purchase.total'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('purchase.total'),
        cell: ({ row }) => formatCurrency(row.original.total),
      },
      {
        id: 'runsCount',
        enableSorting: false,
        meta: {
          label: t('sales.recurring.runs'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('sales.recurring.runs'),
        cell: ({ row }) => row.original.runsCount,
      },
      {
        id: 'mode',
        enableSorting: false,
        meta: { label: t('sales.recurring.mode') },
        header: t('sales.recurring.mode'),
        cell: ({ row: { original: r } }) =>
          r.autoPost
            ? r.autoEmail
              ? t('sales.recurring.postEmail')
              : t('sales.recurring.post')
            : t('sales.recurring.draft'),
      },
      {
        id: 'isActive',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row: { original: r } }) => (
          <StatusBadge tone={r.isActive ? 'success' : 'neutral'}>
            {t(r.isActive ? 'common.active' : 'sales.recurring.paused')}
          </StatusBadge>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { label: t('common.actions'), cellClassName: 'w-10' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original: r } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.actionsFor', { name: r.name })}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can('sales.create') && r.isActive && (
                <DropdownMenuItem
                  onSelect={() =>
                    runNow.mutate(r.id, {
                      onSuccess: (res) =>
                        res.invoiceId
                          ? toast.success(t('sales.recurring.ran'), {
                              action: {
                                label: t('common.view'),
                                onClick: () => navigate(`${SALES_ROUTES.invoice}/${res.invoiceId}`),
                              },
                            })
                          : toast.error(res.schedule.lastError ?? t('sales.recurring.notRun')),
                      onError: (err) => toast.error(err.message),
                    })
                  }
                >
                  <Play aria-hidden /> {t('sales.recurring.runNow')}
                </DropdownMenuItem>
              )}
              {can('sales.update') && (
                <DropdownMenuItem onSelect={() => setEditing(r)}>
                  <Pencil aria-hidden /> {t('common.edit')}
                </DropdownMenuItem>
              )}
              {can('sales.delete') && (
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}>
                  <Trash2 aria-hidden /> {t('common.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, can, runNow, navigate],
  );

  return (
    <>
      <PageHeader
        title={t('sales.recurring.title')}
        description={t('sales.recurring.description')}
        breadcrumbs={[{ label: t('nav.sales') }, { label: t('sales.recurring.title') }]}
      />
      <DataTable
        storageKey="sales.recurring"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('sales.recurring.search')}
        filters={[
          {
            key: 'isActive',
            label: t('common.status'),
            options: [
              { value: 'true', label: t('common.active') },
              { value: 'false', label: t('sales.recurring.paused') },
            ],
          },
        ]}
        empty={{ title: t('sales.recurring.empty'), description: t('sales.recurring.emptyHint') }}
      />
      {editing && <RecurringDialog schedule={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title={t('sales.recurring.deleteTitle')}
        description={t('sales.recurring.deleteText')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(deleting!.id, {
            onSuccess: () => (toast.success(t('sales.recurring.deleted')), setDeleting(null)),
            onError: (err) => toast.error(err.message),
          })
        }
      />
    </>
  );
}
