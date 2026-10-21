import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useListParams } from '@/hooks/use-list-params';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { useRegisters, useSessions } from '../api/pos-api';
import { ReportDialog } from '../components/register-dialogs';
import type { PosSession } from '../types';

/** Register sessions (shifts) with their X / Z reports and cash variance. */
export default function PosSessionsPage() {
  const { t } = useTranslation();
  const list = useListParams({ defaultSort: '-openedAt', filterKeys: ['registerId', 'status'] });
  const query = useSessions(list.query);
  const registers = useRegisters({ limit: 100, sort: 'name' });
  const [open, setOpen] = useState<PosSession | null>(null);

  const columns = useMemo<ColumnDef<PosSession, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('pos.sessions.number') },
        header: sortableHeader(t('pos.sessions.number')),
        cell: ({ row }) => (
          <Button variant="link" className="h-auto p-0 font-mono" onClick={() => setOpen(row.original)}>
            {row.original.number}
          </Button>
        ),
      },
      {
        id: 'register',
        enableSorting: false,
        meta: { label: t('settings.pos.register') },
        header: t('settings.pos.register'),
        cell: ({ row }) => row.original.register?.name,
      },
      {
        id: 'openedAt',
        meta: { label: t('pos.sessions.opened'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('pos.sessions.opened')),
        cell: ({ row }) => (
          <>
            {formatDateTime(row.original.openedAt)}
            <div className="text-xs text-muted-foreground">{row.original.opener?.name}</div>
          </>
        ),
      },
      {
        id: 'closedAt',
        meta: { label: t('pos.sessions.closed'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('pos.sessions.closed')),
        cell: ({ row }) =>
          row.original.closedAt ? (
            <>
              {formatDateTime(row.original.closedAt)}
              <div className="text-xs text-muted-foreground">{row.original.closer?.name}</div>
            </>
          ) : (
            '—'
          ),
      },
      {
        id: 'expectedCash',
        enableSorting: false,
        meta: {
          label: t('pos.report.expected'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('pos.report.expected'),
        cell: ({ row }) =>
          row.original.status === 'closed' ? formatCurrency(row.original.expectedCash) : '—',
      },
      {
        id: 'countedCash',
        enableSorting: false,
        meta: {
          label: t('pos.report.counted'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('pos.report.counted'),
        cell: ({ row }) =>
          row.original.status === 'closed' ? formatCurrency(row.original.countedCash) : '—',
      },
      {
        id: 'variance',
        meta: {
          label: t('pos.report.variance'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('pos.report.variance')),
        cell: ({ row: { original: s } }) =>
          s.status === 'closed' ? (
            <span
              className={cn(
                Number(s.variance) < 0 && 'text-destructive',
                Number(s.variance) > 0 && 'text-amber-600',
              )}
            >
              {formatCurrency(s.variance)}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => (
          <StatusBadge tone={row.original.status === 'open' ? 'success' : 'neutral'}>
            {t(`pos.sessions.status.${row.original.status}`)}
          </StatusBadge>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('pos.sessions.title')}
        description={t('pos.sessions.description')}
        breadcrumbs={[{ label: t('nav.sales') }, { label: t('pos.sessions.title') }]}
      />
      <DataTable
        storageKey="pos.sessions"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('pos.sessions.search')}
        filters={[
          {
            key: 'registerId',
            label: t('settings.pos.register'),
            options: (registers.data?.rows ?? []).map((r) => ({ value: r.id, label: r.name })),
          },
          {
            key: 'status',
            label: t('common.status'),
            options: ['open', 'closed'].map((s) => ({ value: s, label: t(`pos.sessions.status.${s}`) })),
          },
        ]}
        empty={{ title: t('pos.sessions.empty') }}
      />
      {open && (
        <ReportDialog
          sessionId={open.id}
          paper={
            (registers.data?.rows.find((r) => r.id === open.registerId)?.receiptPaper ?? 'a4') as
              'thermal_80' | 'a4'
          }
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
