import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  LockOpen,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Pencil,
  Play,
  Recycle,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { JournalPanel } from '@/features/accounting/components/journal-panel';
import { useOrder, useOrderAction, type OrderStep } from '../api/manufacturing-api';
import {
  CompleteDialog,
  FinishOperationDialog,
  MaterialsDialog,
  QualityDialog,
  ScrapDialog,
  SubmitDialog,
} from '../components/order-dialogs';
import { MFG_ROUTES, MO_FLOW, MO_TONE, PRIORITY_TONE, minutesLabel, productLabel } from '../lib';
import type { ManufacturingOrder, MoOperation } from '../types';

type Dialog = 'issue' | 'return' | 'submit' | 'quality' | 'scrap' | 'complete' | null;
type Confirm = 'confirm' | 'cancel' | 'close' | 'reopen' | 'delete' | 'start' | null;

/** A manufacturing order on the shop floor: materials, operations, quality, outputs and costs. */
export default function OrderPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const order = useOrder(id);
  const action = useOrderAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [finishing, setFinishing] = useState<MoOperation | null>(null);

  if (order.isPending) return <PageSkeleton />;
  if (order.isError) return <p className="text-destructive">{order.error.message}</p>;
  const mo = order.data;
  const s = mo.status;
  const canUpdate = can('manufacturing.update');
  const canApprove = can('manufacturing.approve');
  const busy = action.isPending;

  const done = (message: string) => () => {
    toast.success(t(message));
    setDialog(null);
    setConfirm(null);
    setFinishing(null);
  };
  const fail = (err: Error) => {
    toast.error(err.message);
    setConfirm(null);
  };
  const step = (name: OrderStep, body?: unknown, message = `manufacturing.toast.${name}`) =>
    action.mutateAsync({ id: mo.id, step: name, body }).then(done(message), fail);

  const button = (
    show: boolean,
    label: string,
    Icon: typeof Play,
    onClick: () => void,
    variant: 'default' | 'outline' | 'ghost' = 'outline',
  ) =>
    show && (
      <Button key={label} type="button" variant={variant} onClick={onClick} disabled={busy}>
        <Icon aria-hidden /> {t(label)}
      </Button>
    );

  const actions = [
    button(
      s === 'draft' && can('manufacturing.delete'),
      'common.delete',
      Trash2,
      () => setConfirm('delete'),
      'ghost',
    ),
    button(
      ['draft', 'confirmed', 'material_issued'].includes(s) && canApprove,
      'manufacturing.actions.cancel',
      Ban,
      () => setConfirm('cancel'),
    ),
    s === 'draft' && canUpdate && (
      <Button key="edit" variant="outline" asChild>
        <Link to={`${MFG_ROUTES.orders}/${mo.id}/edit`}>
          <Pencil aria-hidden /> {t('common.edit')}
        </Link>
      </Button>
    ),
    button(
      s === 'draft' && canApprove,
      'manufacturing.actions.confirm',
      CheckCircle2,
      () => setConfirm('confirm'),
      'default',
    ),
    button(
      ['confirmed', 'material_issued', 'in_progress'].includes(s) && canUpdate,
      'manufacturing.actions.issue',
      PackageMinus,
      () => setDialog('issue'),
    ),
    button(
      ['material_issued', 'in_progress', 'quality_check', 'completed'].includes(s) && canUpdate,
      'manufacturing.actions.return',
      PackagePlus,
      () => setDialog('return'),
    ),
    button(
      ['material_issued', 'in_progress', 'quality_check'].includes(s) && canUpdate,
      'manufacturing.actions.scrap',
      Recycle,
      () => setDialog('scrap'),
    ),
    button(
      ['confirmed', 'material_issued'].includes(s) && canUpdate,
      'manufacturing.actions.start',
      Play,
      () => setConfirm('start'),
      s === 'material_issued' ? 'default' : 'outline',
    ),
    button(
      s === 'in_progress' && canUpdate,
      'manufacturing.actions.submit',
      Send,
      () => setDialog('submit'),
      'default',
    ),
    button(s === 'quality_check' && canUpdate, 'manufacturing.actions.quality', ClipboardCheck, () =>
      setDialog('quality'),
    ),
    button(
      s === 'quality_check' && canApprove,
      'manufacturing.actions.complete',
      PackageCheck,
      () => setDialog('complete'),
      'default',
    ),
    button(
      s === 'completed' && canApprove,
      'manufacturing.actions.close',
      Lock,
      () => setConfirm('close'),
      'default',
    ),
    button(s === 'closed' && canApprove, 'manufacturing.actions.reopen', LockOpen, () =>
      setConfirm('reopen'),
    ),
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={mo.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={MO_TONE[s]}>{t(`manufacturing.status.${s}`)}</StatusBadge>
            <StatusBadge tone={PRIORITY_TONE[mo.priority]}>
              {t(`manufacturing.priorities.${mo.priority}`)}
            </StatusBadge>
            <span className="font-medium">{productLabel(mo.product, mo.variant)}</span>×{' '}
            {formatQuantity(mo.quantity)}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.manufacturing') },
          { label: t('manufacturing.orders.title'), to: MFG_ROUTES.orders },
          { label: mo.number },
        ]}
        actions={<>{actions}</>}
      />

      <Stepper status={s} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Materials mo={mo} />
          <Operations
            mo={mo}
            busy={busy}
            onStart={(op) =>
              action
                .mutateAsync({ id: mo.id, operation: { id: op.id, action: 'start' } })
                .then(done('manufacturing.toast.operationStarted'), fail)
            }
            onFinish={setFinishing}
          />
          <Quality mo={mo} />
          {(mo.outputs?.length ?? 0) > 0 && <Outputs mo={mo} />}
          {(mo.scrap?.length ?? 0) > 0 && <Scrap mo={mo} />}
          {can('accounting.view') && <JournalPanel sourceType="manufacturing_order" sourceId={mo.id} />}
        </div>
        <div className="flex flex-col gap-4">
          <Costs mo={mo} />
          <Facts mo={mo} />
        </div>
      </div>

      <MaterialsDialog
        mode="issue"
        open={dialog === 'issue'}
        onOpenChange={(o) => !o && setDialog(null)}
        mo={mo}
        loading={busy}
        onConfirm={(body) => step('issue', body)}
      />
      <MaterialsDialog
        mode="return"
        open={dialog === 'return'}
        onOpenChange={(o) => !o && setDialog(null)}
        mo={mo}
        loading={busy}
        onConfirm={(body) => step('return', body)}
      />
      <SubmitDialog
        open={dialog === 'submit'}
        onOpenChange={(o) => !o && setDialog(null)}
        mo={mo}
        loading={busy}
        onConfirm={(body) => step('submit', body)}
      />
      <QualityDialog
        open={dialog === 'quality'}
        onOpenChange={(o) => !o && setDialog(null)}
        mo={mo}
        loading={busy}
        onConfirm={(body) => step('quality', body)}
      />
      <ScrapDialog
        open={dialog === 'scrap'}
        onOpenChange={(o) => !o && setDialog(null)}
        mo={mo}
        loading={busy}
        onConfirm={(body) => step('scrap', body)}
      />
      <CompleteDialog
        open={dialog === 'complete'}
        onOpenChange={(o) => !o && setDialog(null)}
        mo={mo}
        loading={busy}
        onConfirm={(body) => step('complete', body)}
      />
      <FinishOperationDialog
        operation={finishing}
        onOpenChange={(o) => !o && setFinishing(null)}
        loading={busy}
        onConfirm={(op, body) =>
          action
            .mutateAsync({ id: mo.id, operation: { id: op.id, action: 'finish' }, body })
            .then(done('manufacturing.toast.operationFinished'), fail)
        }
      />
      {(['confirm', 'cancel', 'close', 'reopen', 'start'] as const).map((name) => (
        <ConfirmDialog
          key={name}
          open={confirm === name}
          onOpenChange={(o) => !o && setConfirm(null)}
          destructive={name === 'cancel'}
          title={t(`manufacturing.confirm.${name}Title`)}
          description={t(`manufacturing.confirm.${name}Text`)}
          confirmLabel={t(`manufacturing.actions.${name}`)}
          loading={busy}
          onConfirm={() => step(name)}
        />
      ))}
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('manufacturing.confirm.deleteTitle')}
        description={t('manufacturing.confirm.deleteText')}
        confirmLabel={t('common.delete')}
        loading={busy}
        onConfirm={() =>
          action.mutateAsync({ id: mo.id, remove: true }).then(() => {
            toast.success(t('manufacturing.toast.deleted'));
            navigate(MFG_ROUTES.orders);
          }, fail)
        }
      />
    </>
  );
}

function Stepper({ status }: { status: ManufacturingOrder['status'] }) {
  const { t } = useTranslation();
  if (status === 'cancelled')
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
        {t('manufacturing.cancelledNotice')}
      </div>
    );
  const current = MO_FLOW.indexOf(status);
  return (
    <ol
      className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-2"
      aria-label={t('manufacturing.workflow')}
    >
      {MO_FLOW.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? 'step' : undefined}
          className={cn(
            'flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs whitespace-nowrap',
            i < current && 'text-emerald-700 dark:text-emerald-400',
            i === current && 'bg-primary text-primary-foreground',
            i > current && 'text-muted-foreground',
          )}
        >
          {i < current ? (
            <CheckCircle2 className="size-3.5" aria-hidden />
          ) : (
            <Square className="size-3" aria-hidden />
          )}
          {t(`manufacturing.status.${step}`)}
        </li>
      ))}
    </ol>
  );
}

const num = 'text-right tabular-nums';

function Materials({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.orders.materials')}</CardTitle>
        <CardDescription>
          {t('manufacturing.orders.materialsFrom', { warehouse: mo.rawWarehouse?.name ?? '—' })}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manufacturing.product')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.orders.required')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.orders.issued')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.orders.returned')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.cost.cost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(mo.materials ?? []).map((m) => {
              const net = Number(m.issuedQuantity) - Number(m.returnedQuantity);
              const short = net < Number(m.requiredQuantity);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{productLabel(m.product, m.variant)}</TableCell>
                  <TableCell className={num}>{formatQuantity(m.requiredQuantity)}</TableCell>
                  <TableCell className={cn(num, short && net > 0 && 'text-amber-600')}>
                    {formatQuantity(m.issuedQuantity)}
                  </TableCell>
                  <TableCell className={num}>{formatQuantity(m.returnedQuantity)}</TableCell>
                  <TableCell className={num}>{formatCurrency(m.cost)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Operations({
  mo,
  busy,
  onStart,
  onFinish,
}: {
  mo: ManufacturingOrder;
  busy: boolean;
  onStart: (op: MoOperation) => void;
  onFinish: (op: MoOperation) => void;
}) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const live = mo.status === 'in_progress' && can('manufacturing.update');
  if (!mo.operations?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.orders.operations')}</CardTitle>
        <CardDescription>{t('manufacturing.orders.operationsHint')}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manufacturing.operation')}</TableHead>
              <TableHead>{t('manufacturing.workCenter')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.orders.plannedTime')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.orders.actualTime')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.cost.cost')}</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mo.operations.map((op) => (
              <TableRow key={op.id}>
                <TableCell className="font-medium">{op.name}</TableCell>
                <TableCell>{op.workCenter?.name}</TableCell>
                <TableCell className={num}>{minutesLabel(op.plannedMinutes)}</TableCell>
                <TableCell className={num}>
                  {op.status === 'done' ? minutesLabel(op.actualMinutes) : '—'}
                </TableCell>
                <TableCell className={num}>
                  {op.status === 'done'
                    ? formatCurrency(Number(op.labourCost) + Number(op.overheadCost))
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {op.status === 'done' ? (
                    <StatusBadge tone="success">{t('manufacturing.opStatus.done')}</StatusBadge>
                  ) : live ? (
                    op.status === 'pending' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => onStart(op)}>
                        <Play aria-hidden /> {t('manufacturing.actions.startOp')}
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => onFinish(op)}>
                        <CheckCircle2 aria-hidden /> {t('manufacturing.actions.finishOp')}
                      </Button>
                    )
                  ) : (
                    <StatusBadge tone={op.status === 'in_progress' ? 'warning' : 'neutral'}>
                      {t(`manufacturing.opStatus.${op.status}`)}
                    </StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Quality({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  const checks = mo.qualityChecks ?? [];
  if (!mo.checkpoints?.length && !checks.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.orders.quality')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(mo.checkpoints ?? []).map((c) => {
          const recorded = checks.filter((q) => q.name === c.name);
          return (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{c.name}</div>
                {c.instructions && <div className="text-muted-foreground">{c.instructions}</div>}
              </div>
              {recorded.length ? null : (
                <StatusBadge tone="neutral">{t('manufacturing.orders.notChecked')}</StatusBadge>
              )}
            </div>
          );
        })}
        {checks.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{q.name}</span> · {formatDateTime(q.checkedAt)} ·{' '}
              {q.checker?.name}
              {q.reason && <span className="text-muted-foreground"> — {q.reason}</span>}
            </span>
            <span className="flex items-center gap-2">
              {q.result === 'fail' && (
                <span className="text-muted-foreground tabular-nums">
                  {t(`manufacturing.qcAction.${q.action}`)} {formatQuantity(q.failedQuantity)}
                </span>
              )}
              <StatusBadge tone={q.result === 'pass' ? 'success' : 'danger'}>
                {t(`manufacturing.qcResult.${q.result}`)}
              </StatusBadge>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Outputs({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.orders.outputs')}</CardTitle>
        <CardDescription>
          {t('manufacturing.orders.outputsInto', { warehouse: mo.finishedWarehouse?.name ?? '—' })}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manufacturing.product')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.quantity')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.cost.unit')}</TableHead>
              <TableHead className="text-right">{t('manufacturing.cost.cost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(mo.outputs ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <span className="font-medium">{productLabel(o.product, o.variant)}</span>
                  {o.kind === 'byproduct' && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('manufacturing.orders.byproduct')}
                    </span>
                  )}
                  {o.batch && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{o.batch.batchNo}</span>
                  )}
                </TableCell>
                <TableCell className={num}>{formatQuantity(o.quantity)}</TableCell>
                <TableCell className={num}>{formatCurrency(o.unitCost)}</TableCell>
                <TableCell className={num}>{formatCurrency(o.totalCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Scrap({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.orders.scrapLog')}</CardTitle>
        <CardDescription>{t('manufacturing.orders.scrapHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {(mo.scrap ?? []).map((s) => (
          <div key={s.id} className="flex flex-wrap justify-between gap-2">
            <span>
              <span className="font-medium">{productLabel(s.product, s.variant)}</span> ×{' '}
              {formatQuantity(s.quantity)} — {s.reason}
            </span>
            <span className="tabular-nums">{formatCurrency(s.cost)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Costs({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  const rows = [
    ['material', mo.stdMaterialCost, mo.materialCost],
    ['labour', mo.stdLabourCost, mo.labourCost],
    ['overhead', mo.stdOverheadCost, mo.overheadCost],
  ] as const;
  const std = rows.reduce((s, r) => s + Number(r[1]), 0);
  const actual = rows.reduce((s, r) => s + Number(r[2]), 0);
  const diff = actual - std;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.cost.title')}</CardTitle>
        <CardDescription>{t('manufacturing.cost.hint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pb-2 text-left font-normal" />
              <th className="pb-2 text-right font-normal">{t('manufacturing.cost.standard')}</th>
              <th className="pb-2 text-right font-normal">{t('manufacturing.cost.actual')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, s, a]) => (
              <tr key={k}>
                <td className="py-1 text-muted-foreground">{t(`manufacturing.cost.${k}`)}</td>
                <td className={num}>{formatCurrency(s)}</td>
                <td className={num}>{formatCurrency(a)}</td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <td className="pt-2">{t('manufacturing.cost.total')}</td>
              <td className={cn(num, 'pt-2')}>{formatCurrency(std)}</td>
              <td className={cn(num, 'pt-2')}>{formatCurrency(actual)}</td>
            </tr>
          </tbody>
        </table>
        {actual > 0 && (
          <p className={cn('mt-3 text-sm', diff > 0 ? 'text-amber-600' : 'text-emerald-600')}>
            {t(diff > 0 ? 'manufacturing.cost.over' : 'manufacturing.cost.under', {
              amount: formatCurrency(Math.abs(diff)),
            })}
          </p>
        )}
        {Number(mo.goodQuantity) > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-y-1 border-t pt-3 text-sm">
            <dt className="text-muted-foreground">{t('manufacturing.cost.outputValue')}</dt>
            <dd className={num}>{formatCurrency(mo.outputCost)}</dd>
            <dt className="text-muted-foreground">{t('manufacturing.cost.unit')}</dt>
            <dd className={cn(num, 'font-semibold')}>{formatCurrency(mo.unitCost)}</dd>
            {['closed'].includes(mo.status) && (
              <>
                <dt className="text-muted-foreground">{t('manufacturing.cost.variance')}</dt>
                <dd className={num}>{formatCurrency(mo.varianceCost)}</dd>
              </>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Facts({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  const facts: [string, React.ReactNode][] = [
    [
      'manufacturing.orders.bom',
      mo.bom ? (
        <Link to={`${MFG_ROUTES.boms}/${mo.bom.id}`} className="font-mono hover:underline">
          {mo.bom.code} · v{mo.bom.version}
        </Link>
      ) : (
        '—'
      ),
    ],
    ['manufacturing.orders.plannedStart', formatDate(mo.plannedStart)],
    ['manufacturing.orders.plannedEnd', formatDate(mo.plannedEnd)],
    ['manufacturing.orders.actualStart', mo.actualStart ? formatDateTime(mo.actualStart) : '—'],
    ['manufacturing.orders.actualEnd', mo.actualEnd ? formatDateTime(mo.actualEnd) : '—'],
    ['manufacturing.orders.produced', formatQuantity(mo.producedQuantity)],
    ['manufacturing.orders.goodQuantity', formatQuantity(mo.goodQuantity)],
    ['manufacturing.orders.scrapped', formatQuantity(mo.scrappedQuantity)],
    ['manufacturing.orders.finishedWarehouse', mo.finishedWarehouse?.name ?? '—'],
  ];
  if (mo.salesOrder) facts.push(['manufacturing.orders.salesOrder', mo.salesOrder.number]);
  if (mo.parent)
    facts.push([
      'manufacturing.orders.parent',
      <Link key="p" to={`${MFG_ROUTES.orders}/${mo.parent.id}`} className="font-mono hover:underline">
        {mo.parent.number}
      </Link>,
    ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{t(label)}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        {mo.notes && <p className="mt-3 border-t pt-3 text-sm whitespace-pre-line">{mo.notes}</p>}
        {(mo.children?.length ?? 0) > 0 && (
          <div className="mt-3 border-t pt-3 text-sm">
            <div className="mb-1 text-muted-foreground">{t('manufacturing.orders.children')}</div>
            {mo.children!.map((c) => (
              <Link key={c.id} to={`${MFG_ROUTES.orders}/${c.id}`} className="mr-3 font-mono hover:underline">
                {c.number}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
