import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarRange, Lock, LockOpen, Plus, Trash2, Undo2, CalendarCheck } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useCreateFiscalYear,
  useDeleteFiscalYear,
  useFiscalYears,
  useSetPeriodStatus,
  useYearAction,
} from '../api/accounting-api';
import type { FiscalYear } from '../types';

type Pending = { year: FiscalYear; action: 'close' | 'reopen' | 'delete' } | null;

/** Fiscal years with their monthly periods: lock periods, close a year into retained earnings. */
export default function FiscalYearsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const years = useFiscalYears();
  const create = useCreateFiscalYear();
  const remove = useDeleteFiscalYear();
  const yearAction = useYearAction();
  const setStatus = useSetPeriodStatus();
  const [creating, setCreating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const canLock = can('accounting.approve');

  const next = years.data?.[0];
  const openCreate = () => {
    // Suggest the year after the latest one.
    if (next) {
      const d = new Date(`${next.endDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      setStartDate(d.toISOString().slice(0, 10));
    } else setStartDate('');
    setEndDate('');
    setError(null);
    setCreating(true);
  };

  const newButton = (
    <Can permission="accounting.create">
      <Button onClick={openCreate}>
        <Plus aria-hidden /> {t('accounting.fiscal.new')}
      </Button>
    </Can>
  );

  const runPending = () => {
    if (!pending) return;
    const done = (message: string) => () => {
      toast.success(message);
      setPending(null);
    };
    const fail = (err: Error) => {
      toast.error(err.message);
      setPending(null);
    };
    if (pending.action === 'delete')
      remove.mutate(pending.year.id, { onSuccess: done(t('accounting.fiscal.deleted')), onError: fail });
    else
      yearAction.mutate(
        { id: pending.year.id, action: pending.action },
        {
          onSuccess: done(
            t(
              pending.action === 'close'
                ? 'accounting.fiscal.closedToast'
                : 'accounting.fiscal.reopenedToast',
            ),
          ),
          onError: fail,
        },
      );
  };

  return (
    <>
      <PageHeader
        title={t('accounting.fiscal.title')}
        description={t('accounting.fiscal.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.fiscal.title') }]}
        actions={newButton}
      />
      {years.isPending ? (
        <Skeleton className="h-64" />
      ) : !years.data?.length ? (
        <Card>
          <CardContent>
            <EmptyState icon={CalendarRange} title={t('accounting.fiscal.empty')} action={newButton} />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {years.data.map((y) => (
            <Card key={y.id}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {y.name}
                    <StatusBadge tone={y.status === 'closed' ? 'neutral' : 'success'}>
                      {t(`accounting.fiscal.status.${y.status}`)}
                    </StatusBadge>
                  </CardTitle>
                  <CardDescription>
                    {formatDate(y.startDate)} – {formatDate(y.endDate)}
                    {y.closedAt && ` · ${t('accounting.fiscal.closedBy', { name: y.closer?.name ?? '—' })}`}
                  </CardDescription>
                </div>
                {canLock && (
                  <div className="flex flex-wrap gap-2">
                    {y.status === 'open' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPending({ year: y, action: 'close' })}
                      >
                        <CalendarCheck aria-hidden /> {t('accounting.fiscal.close')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPending({ year: y, action: 'reopen' })}
                      >
                        <Undo2 aria-hidden /> {t('accounting.fiscal.reopen')}
                      </Button>
                    )}
                    {y.status === 'open' && can('accounting.delete') && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPending({ year: y, action: 'delete' })}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {y.periods.map((p) => {
                    const locked = p.status === 'locked';
                    const busy = setStatus.isPending && setStatus.variables?.id === p.id;
                    return (
                      <li
                        key={p.id}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                          locked && 'bg-muted/60 text-muted-foreground',
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {locked && <Lock className="size-3.5" aria-hidden />}
                          {p.name}
                        </span>
                        {canLock && y.status === 'open' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busy}
                                aria-label={t(
                                  locked ? 'accounting.fiscal.unlock' : 'accounting.fiscal.lock',
                                  {
                                    name: p.name,
                                  },
                                )}
                                onClick={() =>
                                  setStatus.mutate(
                                    { id: p.id, status: locked ? 'open' : 'locked' },
                                    { onError: (err) => toast.error(err.message) },
                                  )
                                }
                              >
                                {busy ? (
                                  <Spinner />
                                ) : locked ? (
                                  <LockOpen aria-hidden />
                                ) : (
                                  <Lock aria-hidden />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t(locked ? 'accounting.fiscal.unlock' : 'accounting.fiscal.lock', {
                                name: p.name,
                              })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounting.fiscal.new')}</DialogTitle>
            <DialogDescription>{t('accounting.fiscal.newHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fy-start">{t('accounting.fiscal.startDate')}</Label>
              <Input
                id="fy-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-invalid={Boolean(error)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fy-end">{t('accounting.fiscal.endDate')}</Label>
              <Input id="fy-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('accounting.fiscal.endDateHint')}</p>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!startDate || create.isPending}
              onClick={() =>
                create.mutate(
                  { startDate, endDate: endDate || undefined },
                  {
                    onSuccess: (y) => {
                      toast.success(t('accounting.fiscal.created', { name: y.name }));
                      setCreating(false);
                    },
                    onError: (err) => setError(err.message),
                  },
                )
              }
            >
              {create.isPending && <Spinner />} {t('accounting.fiscal.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        destructive={pending?.action === 'delete'}
        title={
          pending ? t(`accounting.fiscal.confirm.${pending.action}Title`, { name: pending.year.name }) : ''
        }
        description={
          pending ? t(`accounting.fiscal.confirm.${pending.action}Text`, { name: pending.year.name }) : ''
        }
        confirmLabel={
          pending ? t(`accounting.fiscal.${pending.action === 'delete' ? 'delete' : pending.action}`) : ''
        }
        loading={yearAction.isPending || remove.isPending}
        onConfirm={runPending}
      />
    </>
  );
}
