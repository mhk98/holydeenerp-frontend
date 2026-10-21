import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, CheckCheck, Landmark, MoreHorizontal } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { todayIn } from '@/features/purchase/lib';
import { useChequeAction, useCheques } from '../api/banking-api';
import { BankAccountSelect } from '../components/bank-account-select';
import { DOC_TONE } from '../lib';
import type { Cheque, ChequeStatus } from '../types';

type Action = 'deposit' | 'clear' | 'bounce';
const SOURCE_ROUTE = { customer_receipt: '/sales/receipts', supplier_payment: '/purchases/payments' };
const STATUSES: ChequeStatus[] = ['in_hand', 'deposited', 'issued', 'cleared', 'bounced', 'cancelled'];

/** Cheques received and issued, filled from money receipts and supplier payments by cheque. */
export default function ChequesPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const list = useListParams({
    defaultSort: '-chequeDate',
    filterKeys: ['direction', 'status', 'from', 'to'],
  });
  const query = useCheques(list.query);
  const act = useChequeAction();
  const { filters } = list.state;
  const [pending, setPending] = useState<{ cheque: Cheque; action: Action } | null>(null);
  const [bankId, setBankId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const start = (cheque: Cheque, action: Action) => {
    setPending({ cheque, action });
    setBankId(cheque.depositBankAccount?.id ?? '');
    setDate(todayIn(timezone));
    setReason('');
  };

  const columns = useMemo<ColumnDef<Cheque, unknown>[]>(
    () => [
      {
        id: 'chequeNo',
        enableHiding: false,
        enableSorting: false,
        meta: { label: t('accounting.cheques.number') },
        header: t('accounting.cheques.number'),
        cell: ({ row }) => (
          <div>
            <div className="font-mono text-sm font-medium">{row.original.chequeNo}</div>
            {row.original.bankName && (
              <div className="text-xs text-muted-foreground">{row.original.bankName}</div>
            )}
          </div>
        ),
      },
      {
        id: 'chequeDate',
        meta: { label: t('accounting.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('accounting.date')),
        cell: ({ row }) => formatDate(row.original.chequeDate),
      },
      {
        id: 'party',
        enableSorting: false,
        meta: { label: t('accounting.health.party') },
        header: t('accounting.health.party'),
        cell: ({ row }) => row.original.party?.name ?? '—',
      },
      {
        id: 'source',
        enableSorting: false,
        meta: { label: t('accounting.journals.source') },
        header: t('accounting.journals.source'),
        cell: ({ row: { original: c } }) => (
          <Link
            to={`${SOURCE_ROUTE[c.sourceType]}/${c.sourceId}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            {c.sourceNo}
          </Link>
        ),
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
        cell: ({ row: { original: c } }) => (
          <div>
            <StatusBadge tone={DOC_TONE[c.status]}>{t(`accounting.cheques.status.${c.status}`)}</StatusBadge>
            {c.depositBankAccount && (
              <div className="mt-0.5 text-xs text-muted-foreground">{c.depositBankAccount.name}</div>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { label: t('common.actions'), cellClassName: 'w-10' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original: c } }) => {
          const open = ['in_hand', 'deposited', 'issued'].includes(c.status);
          const items = [
            c.status === 'in_hand' && can('accounting.update') && ['deposit', Landmark],
            open && can('accounting.update') && ['clear', CheckCheck],
            (open || (c.status === 'cleared' && c.direction === 'received')) &&
              can('accounting.approve') && ['bounce', Ban],
          ].filter(Boolean) as [Action, typeof Ban][];
          if (!items.length) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('common.actionsFor', { name: c.chequeNo })}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {items.map(([action, Icon]) => (
                  <DropdownMenuItem
                    key={action}
                    variant={action === 'bounce' ? 'destructive' : 'default'}
                    onSelect={() => start(c, action)}
                  >
                    <Icon aria-hidden /> {t(`accounting.cheques.actions.${action}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, can],
  );

  const needsBank =
    pending &&
    pending.cheque.direction === 'received' &&
    (pending.action === 'deposit' || (pending.action === 'clear' && !pending.cheque.depositBankAccount));
  const submit = () => {
    if (!pending) return;
    act.mutate(
      {
        id: pending.cheque.id,
        action: pending.action,
        body: {
          date,
          ...(needsBank && { bankAccountId: bankId }),
          ...(pending.action === 'bounce' && { reason }),
        },
      },
      {
        onSuccess: () => {
          toast.success(t(`accounting.cheques.done.${pending.action}`, { number: pending.cheque.chequeNo }));
          setPending(null);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <>
      <PageHeader
        title={t('accounting.cheques.title')}
        description={t('accounting.cheques.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.cheques.title') }]}
      />
      <Tabs
        value={filters.direction ?? 'all'}
        onValueChange={(value) => list.setState({ filters: { direction: value === 'all' ? '' : value } })}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">{t('table.all')}</TabsTrigger>
          <TabsTrigger value="received">{t('accounting.cheques.received')}</TabsTrigger>
          <TabsTrigger value="issued">{t('accounting.cheques.issued')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        storageKey="accounting.cheques"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('accounting.cheques.search')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: STATUSES.map((s) => ({ value: s, label: t(`accounting.cheques.status.${s}`) })),
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
        empty={{ title: t('accounting.cheques.empty'), description: t('accounting.cheques.emptyHint') }}
      />
      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t(`accounting.cheques.actions.${pending.action}`)} · {pending.cheque.chequeNo}
                </DialogTitle>
                <DialogDescription>{t(`accounting.cheques.hint.${pending.action}`)}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {needsBank && (
                  <div className="flex flex-col gap-2">
                    <Label>{t('accounting.cheques.depositTo')}</Label>
                    <BankAccountSelect value={bankId} onChange={setBankId} kinds={['bank']} />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cheque-date">{t('accounting.date')}</Label>
                  <Input
                    id="cheque-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                {pending.action === 'bounce' && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cheque-reason">{t('accounting.cheques.reason')}</Label>
                    <Textarea
                      id="cheque-reason"
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPending(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant={pending.action === 'bounce' ? 'destructive' : 'default'}
                  disabled={
                    act.isPending ||
                    !date ||
                    (needsBank && !bankId) ||
                    (pending.action === 'bounce' && !reason.trim())
                  }
                  onClick={submit}
                >
                  {act.isPending && <Spinner />} {t(`accounting.cheques.actions.${pending.action}`)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
