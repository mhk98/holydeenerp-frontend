import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Printer, Save, Search, Send, Trash2, XCircle } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/features/settings/api/settings-api';
import type { StockCount, StockCountItem } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { countsApi, useSaveCountEntries } from '../api/inventory-api';
import { DocStatusBadge } from '../components/inventory-badges';
import { RejectDialog } from '../components/reject-dialog';
import { WorkflowSteps } from '../components/workflow-steps';

type Show = 'all' | 'uncounted' | 'variance';
const label = (i: StockCountItem) => (i.variant ? `${i.product.name} — ${i.variant.name}` : i.product.name);
const isNumber = (s: string) => /^\d+(\.\d{1,4})?$/.test(s);

/** Count sheet: enter counted quantities, review variances, submit and approve. */
export default function CountSheetPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const config = useAppConfig();
  const requireApproval = config.data?.inventory?.requireApproval ?? true;
  const doc = countsApi.useOne(id);
  const saveEntries = useSaveCountEntries(id!);
  const action = countsApi.useAction();
  const remove = countsApi.useRemove();
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [rejecting, setRejecting] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'cancel' | 'delete' | null>(null);

  const loaded = doc.data;
  // Reset the inputs whenever another version of the sheet arrives (load, save, approve).
  const version = loaded ? `${loaded.id}:${loaded.updatedAt}:${loaded.items?.length}` : null;
  const [syncedVersion, setSyncedVersion] = useState<string | null>(null);
  if (loaded?.items && version !== syncedVersion) {
    setSyncedVersion(version);
    setEntries(
      Object.fromEntries(
        loaded.items.map((i) => [i.id, i.countedQuantity == null ? '' : String(Number(i.countedQuantity))]),
      ),
    );
  }

  const status = loaded?.status ?? 'counting';
  const editable = ['counting', 'rejected'].includes(status) && can('inventory.update');
  const busy = saveEntries.isPending || action.isPending;
  const items = useMemo(() => loaded?.items ?? [], [loaded?.items]);

  const changed = items.filter(
    (i) => (entries[i.id] ?? '') !== (i.countedQuantity == null ? '' : String(Number(i.countedQuantity))),
  );
  const invalid = items.filter((i) => entries[i.id] && !isNumber(entries[i.id]));
  const variance = (i: StockCountItem) => {
    const v = entries[i.id];
    if (status === 'posted') return Number(i.varianceQuantity);
    return v && isNumber(v) ? Number(v) - Number(i.systemQuantity) : null;
  };
  const counted = items.filter((i) => entries[i.id] !== '' && entries[i.id] !== undefined).length;
  const varianceValue = items.reduce((sum, i) => sum + (variance(i) ?? 0) * Number(i.unitCost), 0);

  const visible = items.filter((i) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !`${label(i)} ${i.variant?.sku ?? i.product.sku} ${i.product.barcode ?? ''} ${i.batch?.batchNo ?? ''}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (show === 'uncounted') return !entries[i.id];
    if (show === 'variance') return (variance(i) ?? 0) !== 0;
    return true;
  });

  const persist = async () => {
    if (invalid.length) {
      toast.error(t('inventory.counts.invalid'));
      return false;
    }
    if (!changed.length) return true;
    await saveEntries.mutateAsync(changed.map((i) => ({ id: i.id, countedQuantity: entries[i.id] || null })));
    return true;
  };

  const onSave = async () => {
    try {
      if (await persist()) toast.success(t('inventory.counts.saved'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onSubmit = async () => {
    try {
      if (!(await persist())) return;
      const result = await action.mutateAsync({ id: id!, action: 'submit' });
      toast.success(t(result.status === 'posted' ? 'inventory.toast.posted' : 'inventory.toast.submitted'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const run = (name: string, body?: unknown) =>
    action.mutate(
      { id: id!, action: name, body },
      {
        onSuccess: () => {
          toast.success(t(`inventory.toast.${name}`));
          setConfirm(null);
          setRejecting(false);
        },
        onError: (err) => {
          toast.error(err.message);
          setConfirm(null);
        },
      },
    );

  if (doc.isPending) return <PageSkeleton />;
  if (!loaded) return null;

  return (
    <>
      <PageHeader
        title={`${t('inventory.counts.entity')} ${loaded.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <DocStatusBadge status={status} /> {loaded.warehouse?.name} · {formatDate(loaded.countDate)}
            {loaded.category && ` · ${loaded.category.name}`}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.inventory') },
          { label: t('inventory.counts.title'), to: '/inventory/counts' },
          { label: loaded.number },
        ]}
        actions={
          <>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer aria-hidden /> {t('inventory.counts.print')}
            </Button>
            {status === 'counting' && can('inventory.delete') && (
              <Button variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {['counting', 'pending_approval', 'rejected'].includes(status) && can('inventory.update') && (
              <Button variant="outline" onClick={() => setConfirm('cancel')} disabled={busy}>
                <Ban aria-hidden /> {t('inventory.actions.cancel')}
              </Button>
            )}
            {editable && (
              <>
                <Button variant="outline" onClick={onSave} disabled={busy || !changed.length}>
                  {saveEntries.isPending && !action.isPending ? <Spinner /> : <Save aria-hidden />}{' '}
                  {t('inventory.counts.saveCounts')}
                </Button>
                {can('inventory.create') && (
                  <Button onClick={onSubmit} disabled={busy || counted === 0}>
                    {action.isPending ? <Spinner /> : <Send aria-hidden />}{' '}
                    {t(requireApproval ? 'inventory.actions.submit' : 'inventory.actions.post')}
                  </Button>
                )}
              </>
            )}
            {status === 'pending_approval' && can('inventory.approve') && (
              <>
                <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                  <XCircle aria-hidden /> {t('inventory.actions.reject')}
                </Button>
                <Button onClick={() => setConfirm('approve')} disabled={busy}>
                  <CheckCircle2 aria-hidden /> {t('inventory.actions.approve')}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="gap-3">
            <CardTitle className="text-base">{t('inventory.counts.sheet')}</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <InputGroup className="sm:w-72">
                <InputGroupAddon>
                  <Search aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('inventory.counts.searchPlaceholder')}
                  aria-label={t('inventory.counts.searchPlaceholder')}
                />
              </InputGroup>
              <ToggleGroup
                type="single"
                variant="outline"
                value={show}
                onValueChange={(v) => v && setShow(v as Show)}
              >
                <ToggleGroupItem value="all">{t('table.all')}</ToggleGroupItem>
                <ToggleGroupItem value="uncounted">{t('inventory.counts.uncounted')}</ToggleGroupItem>
                <ToggleGroupItem value="variance">{t('inventory.counts.withVariance')}</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">{t('inventory.item')}</TableHead>
                    <TableHead>{t('inventory.batch')}</TableHead>
                    <TableHead className="text-right">{t('inventory.counts.system')}</TableHead>
                    <TableHead className="w-36 text-right">{t('inventory.counts.counted')}</TableHead>
                    <TableHead className="text-right">{t('inventory.counts.variance')}</TableHead>
                    <TableHead className="text-right">{t('inventory.counts.varianceValue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((i) => {
                    const v = variance(i);
                    const unit = i.product.baseUnit?.code;
                    const bad = Boolean(entries[i.id]) && !isNumber(entries[i.id]);
                    return (
                      <TableRow key={i.id}>
                        <TableCell>
                          <div className="font-medium">{label(i)}</div>
                          <code className="font-mono text-xs text-muted-foreground">
                            {i.variant?.sku ?? i.product.sku}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs">
                          {i.batch ? (
                            <>
                              <span className="font-mono">{i.batch.batchNo}</span>
                              {i.batch.expiryDate && (
                                <div className="text-muted-foreground">{formatDate(i.batch.expiryDate)}</div>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatQuantity(i.systemQuantity)}{' '}
                          <span className="text-xs text-muted-foreground">{unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {editable ? (
                            <Input
                              value={entries[i.id] ?? ''}
                              onChange={(e) =>
                                setEntries((prev) => ({ ...prev, [i.id]: e.target.value.trim() }))
                              }
                              inputMode="decimal"
                              aria-invalid={bad}
                              aria-label={t('inventory.counts.countedFor', { name: label(i) })}
                              className="ml-auto w-28 text-right tabular-nums"
                            />
                          ) : (
                            <span className="tabular-nums">
                              {i.countedQuantity == null ? '—' : formatQuantity(i.countedQuantity)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            v !== null && v > 0 && 'text-emerald-700 dark:text-emerald-400',
                            v !== null && v < 0 && 'text-red-700 dark:text-red-400',
                          )}
                        >
                          {v === null ? '—' : `${v > 0 ? '+' : ''}${formatQuantity(v)}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v === null
                            ? '—'
                            : formatCurrency(status === 'posted' ? i.varianceValue : v * Number(i.unitCost))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!visible.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        {t('table.noMatches')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.counts.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('inventory.counts.progress')}</span>
                <span className="font-medium tabular-nums">
                  {counted} / {items.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${items.length ? (counted / items.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('inventory.counts.withVariance')}</span>
                <span className="font-medium tabular-nums">
                  {items.filter((i) => (variance(i) ?? 0) !== 0).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('inventory.counts.varianceValue')}</span>
                <span className={cn('font-semibold tabular-nums', varianceValue < 0 && 'text-destructive')}>
                  {formatCurrency(status === 'posted' ? loaded.varianceValue : varianceValue)}
                </span>
              </div>
              {editable && <p className="text-xs text-muted-foreground">{t('inventory.counts.hint')}</p>}
            </CardContent>
          </Card>
          <CountWorkflow doc={loaded} />
        </div>
      </div>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        loading={action.isPending}
        onConfirm={(reason) => run('reject', { reason })}
      />
      <ConfirmDialog
        open={confirm === 'approve'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('inventory.confirm.approveTitle')}
        description={t('inventory.confirm.approveCountText')}
        confirmLabel={t('inventory.actions.approve')}
        loading={action.isPending}
        onConfirm={() => run('approve')}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('inventory.confirm.cancelTitle')}
        description={t('inventory.confirm.cancelText')}
        confirmLabel={t('inventory.actions.cancel')}
        loading={action.isPending}
        onConfirm={() => run('cancel')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('inventory.confirm.deleteTitle')}
        description={t('inventory.confirm.deleteText')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(id!, {
            onSuccess: () => {
              toast.success(t('inventory.toast.deleted'));
              navigate('/inventory/counts');
            },
            onError: () => setConfirm(null),
          })
        }
      />
    </>
  );
}

function CountWorkflow({ doc }: { doc: StockCount }) {
  return (
    <WorkflowSteps
      steps={['counting', 'pending_approval', 'posted']}
      status={doc.status}
      rejectionReason={doc.rejectionReason}
      trail={[
        { action: 'created', user: doc.creator, at: doc.createdAt },
        { action: 'submitted', user: doc.submitter, at: doc.submittedAt },
        { action: 'rejected', user: doc.rejecter, at: doc.rejectedAt },
        { action: 'approved', user: doc.approver, at: doc.approvedAt },
        { action: 'cancelled', user: doc.canceller, at: doc.cancelledAt },
      ]}
    />
  );
}
