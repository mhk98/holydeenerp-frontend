import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Award, Ban, PenLine, Save, Send, Trash2, X } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import type { PurchaseRfq, RfqSupplier } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Badge } from '@/components/ui/badge';
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
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { rfqsApi, usePurchaseLookups, useSaveQuote } from '../api/purchase-api';
import { useRunAction } from '../components/form-helpers';
import { PurchaseLines } from '../components/purchase-lines';
import { PurchaseStatusBadge, RelatedDocuments } from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, lineName, nullIfEmpty, todayIn } from '../lib';
import { linePayload, lineFromSaved, linesSchema, type PurchaseLineValues } from '../schemas';

const schema = z.object({
  rfqDate: v.required(),
  quoteDeadline: z.string(),
  notes: z.string().max(2000, 'validation.tooLong'),
  suppliers: z.array(z.object({ id: z.string(), name: z.string() })).min(1, 'purchase.rfqs.needSupplier'),
  items: linesSchema,
});
type Values = z.infer<typeof schema>;
const NONE = '__none__';

function QuoteDialog({
  rfq,
  supplier,
  onClose,
}: {
  rfq: PurchaseRfq;
  supplier: RfqSupplier;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const lookups = usePurchaseLookups();
  const saveQuote = useSaveQuote(rfq.id);
  const existing = new Map(supplier.quotes.map((q) => [q.rfqItemId, q]));
  const [rows, setRows] = useState(() =>
    (rfq.items ?? []).map((i) => {
      const q = existing.get(i.id);
      return {
        rfqItemId: i.id,
        unitPrice: q ? String(Number(q.unitPrice)) : '',
        discountPercent: q && Number(q.discountPercent) ? String(Number(q.discountPercent)) : '',
        taxGroupId: q?.taxGroupId ?? '',
      };
    }),
  );
  const [deliveryDays, setDeliveryDays] = useState(
    supplier.deliveryDays != null ? String(supplier.deliveryDays) : '',
  );
  const [validUntil, setValidUntil] = useState(supplier.validUntil ?? '');
  const [notes, setNotes] = useState(supplier.notes ?? '');
  const set = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = (status: 'quoted' | 'declined') =>
    saveQuote.mutate(
      {
        rfqSupplierId: supplier.id,
        data: {
          status,
          deliveryDays: deliveryDays ? Number(deliveryDays) : null,
          validUntil: validUntil || null,
          notes: nullIfEmpty(notes),
          quotes:
            status === 'declined'
              ? []
              : rows
                  .filter((r) => r.unitPrice !== '')
                  .map((r) => ({
                    ...r,
                    discountPercent: r.discountPercent || '0',
                    taxGroupId: r.taxGroupId || null,
                  })),
        },
      },
      {
        onSuccess: () => (toast.success(t('purchase.rfqs.quoteSaved')), onClose()),
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <Dialog open onOpenChange={(o) => !o && !saveQuote.isPending && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('purchase.rfqs.quoteFrom', { name: supplier.supplier.name })}</DialogTitle>
          <DialogDescription>{t('purchase.rfqs.quoteHint')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.item')}</TableHead>
                <TableHead className="text-right">{t('inventory.quantity')}</TableHead>
                <TableHead className="w-32">{t('purchase.unitPrice')}</TableHead>
                <TableHead className="w-24">{t('purchase.discountPct')}</TableHead>
                <TableHead className="w-40">{t('purchase.tax')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rfq.items ?? []).map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{lineName(item)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(item.quantity)} {item.unit?.code ?? item.product.baseUnit?.code}
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={rows[i].unitPrice}
                      onChange={(e) => set(i, { unitPrice: e.target.value.trim() })}
                      aria-label={t('purchase.unitPrice')}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={rows[i].discountPercent}
                      placeholder="0"
                      onChange={(e) => set(i, { discountPercent: e.target.value.trim() })}
                      aria-label={t('purchase.discountPct')}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={rows[i].taxGroupId || NONE}
                      onValueChange={(val) => set(i, { taxGroupId: val === NONE ? '' : val })}
                    >
                      <SelectTrigger className="w-full" aria-label={t('purchase.tax')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('purchase.noTax')}</SelectItem>
                        {(lookups.data?.taxGroups ?? []).map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-days">{t('purchase.rfqs.deliveryDays')}</Label>
            <Input
              id="q-days"
              inputMode="numeric"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-valid">{t('purchase.rfqs.validUntil')}</Label>
            <Input
              id="q-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-notes">{t('inventory.notes')}</Label>
            <Input id="q-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => submit('declined')} disabled={saveQuote.isPending}>
            {t('purchase.rfqs.declined')}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saveQuote.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => submit('quoted')}
            disabled={saveQuote.isPending || rows.every((r) => !r.unitPrice)}
          >
            {saveQuote.isPending && <Spinner />} {t('purchase.rfqs.saveQuote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Quote comparison: lines × suppliers, best net price highlighted. */
function Comparison({
  rfq,
  onQuote,
  onAward,
  canQuote,
  canAward,
}: {
  rfq: PurchaseRfq;
  onQuote: (s: RfqSupplier) => void;
  onAward: (s: RfqSupplier) => void;
  canQuote: boolean;
  canAward: boolean;
}) {
  const { t } = useTranslation();
  const suppliers = rfq.suppliers ?? [];
  const best = rfq.bestQuotes ?? {};
  const open = rfq.status === 'sent';
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-56">{t('inventory.item')}</TableHead>
            <TableHead className="text-right">{t('inventory.quantity')}</TableHead>
            {suppliers.map((s) => (
              <TableHead key={s.id} className="min-w-40 text-right align-top">
                <div className="py-1">
                  <div className="font-medium text-foreground">{s.supplier.name}</div>
                  <PurchaseStatusBadge status={s.status} className="mt-1" />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rfq.items ?? []).map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{lineName(item)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatQuantity(item.quantity)} {item.unit?.code ?? item.product.baseUnit?.code}
              </TableCell>
              {suppliers.map((s) => {
                const q = s.quotes.find((x) => x.rfqItemId === item.id);
                const isBest = best[item.id]?.rfqSupplierId === s.id;
                return (
                  <TableCell
                    key={s.id}
                    className={cn(
                      'text-right tabular-nums',
                      isBest &&
                        'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                    )}
                  >
                    {q ? (
                      <>
                        {formatCurrency(q.unitPrice)}
                        {Number(q.discountPercent) > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">
                            −{Number(q.discountPercent)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>{t('purchase.rfqs.quoteTotal')}</TableCell>
            {suppliers.map((s) => (
              <TableCell key={s.id} className="text-right tabular-nums">
                {s.status === 'quoted' || s.status === 'awarded' ? formatCurrency(s.total) : '—'}
                {s.deliveryDays != null && (
                  <div className="text-xs font-normal text-muted-foreground">
                    {t('purchase.rfqs.inDays', { days: s.deliveryDays })}
                  </div>
                )}
              </TableCell>
            ))}
          </TableRow>
          {open && (canQuote || canAward) && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={2} />
              {suppliers.map((s) => (
                <TableCell key={s.id} className="text-right">
                  <div className="flex flex-col items-end gap-1.5">
                    {canQuote && (
                      <Button type="button" size="sm" variant="outline" onClick={() => onQuote(s)}>
                        <PenLine aria-hidden />{' '}
                        {t(s.status === 'invited' ? 'purchase.rfqs.enterQuote' : 'purchase.rfqs.editQuote')}
                      </Button>
                    )}
                    {canAward && s.status === 'quoted' && (
                      <Button type="button" size="sm" onClick={() => onAward(s)}>
                        <Award aria-hidden /> {t('purchase.rfqs.award')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableFooter>
      </Table>
    </div>
  );
}

export default function RfqPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const doc = rfqsApi.useOne(isNew ? null : id);
  const save = rfqsApi.useSave();
  const action = rfqsApi.useAction<{ id: string; number: string }>();
  const remove = rfqsApi.useRemove();
  const run = useRunAction(action);
  const [quoting, setQuoting] = useState<RfqSupplier | null>(null);
  const [awarding, setAwarding] = useState<RfqSupplier | null>(null);
  const [awardWarehouse, setAwardWarehouse] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { rfqDate: todayIn(timezone), quoteDeadline: '', notes: '', suppliers: [], items: [] },
  });
  const [watchedSuppliers] = useWatch({ control: form.control, name: ['suppliers'] });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'purchase.create' : 'purchase.update');
  const suppliers = watchedSuppliers;

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      rfqDate: loaded.rfqDate,
      quoteDeadline: loaded.quoteDeadline ?? '',
      notes: loaded.notes ?? '',
      suppliers: (loaded.suppliers ?? []).map((s) => ({ id: s.supplierId, name: s.supplier.name })),
      items: (loaded.items ?? []).map((l) => lineFromSaved(l)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: isNew ? undefined : id,
        data: {
          rfqDate: values.rfqDate,
          quoteDeadline: nullIfEmpty(values.quoteDeadline),
          notes: nullIfEmpty(values.notes),
          supplierIds: values.suppliers.map((s) => s.id),
          items: values.items.map((l) => linePayload(l)),
        },
      });
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${DOC_ROUTES.rfq}/${saved.id}`, { replace: true });
    } catch (err) {
      if (applyServerErrors(err, form.setError)) toast.error(t('inventory.fixErrors'));
      else toast.error((err as Error).message);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('purchase.rfqs.new') : `${t('purchase.rfqs.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={status} /> {formatDate(loaded.rfqDate)}
              {loaded.quoteDeadline &&
                ` · ${t('purchase.rfqs.deadline', { date: formatDate(loaded.quoteDeadline) })}`}
            </span>
          ) : (
            t('purchase.rfqs.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.rfqs.title'), to: DOC_ROUTES.rfq },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('purchase.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded && ['draft', 'sent'].includes(status) && can('purchase.update') && (
              <Button type="button" variant="outline" onClick={() => setConfirm('cancel')} disabled={busy}>
                <Ban aria-hidden /> {t('purchase.actions.cancel')}
              </Button>
            )}
            {editable && (
              <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('inventory.actions.saveDraft')}
              </Button>
            )}
            {loaded && status === 'draft' && can('purchase.update') && (
              <Button
                type="button"
                onClick={() => run(id!, 'send')}
                disabled={busy || form.formState.isDirty}
              >
                <Send aria-hidden /> {t('purchase.rfqs.markSent')}
              </Button>
            )}
          </>
        }
      />

      {status === 'draft' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('inventory.items')}</CardTitle>
              </CardHeader>
              <CardContent>
                <fieldset disabled={!editable || busy} className="contents">
                  <PurchaseLines
                    form={form as unknown as UseFormReturn<{ items: PurchaseLineValues[] }>}
                    mode="requisition"
                    readOnly={!editable}
                  />
                </fieldset>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('purchase.rfqs.suppliers')}</CardTitle>
                <CardDescription>{t('purchase.rfqs.suppliersHint')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {editable && (
                  <SupplierSelect
                    value={null}
                    onChange={(sid, s) =>
                      !suppliers.some((x) => x.id === sid) &&
                      form.setValue('suppliers', [...suppliers, { id: sid, name: s.name }], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                )}
                <div className="flex flex-wrap gap-1.5">
                  {suppliers.map((s) => (
                    <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                      {s.name}
                      {editable && (
                        <button
                          type="button"
                          className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                          aria-label={`${t('common.remove')} ${s.name}`}
                          onClick={() =>
                            form.setValue(
                              'suppliers',
                              suppliers.filter((x) => x.id !== s.id),
                              { shouldDirty: true },
                            )
                          }
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                {form.formState.errors.suppliers && (
                  <p className="text-sm text-destructive">
                    {t(form.formState.errors.suppliers.message ?? '')}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <fieldset disabled={!editable || busy} className="contents">
                  <FieldGroup>
                    <TextField control={form.control} name="rfqDate" type="date" label={t('purchase.date')} />
                    <TextField
                      control={form.control}
                      name="quoteDeadline"
                      type="date"
                      label={t('purchase.quoteDeadline')}
                    />
                    <TextareaField
                      control={form.control}
                      name="notes"
                      label={t('inventory.notes')}
                      rows={2}
                    />
                  </FieldGroup>
                </fieldset>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        loaded && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('purchase.rfqs.comparison')}</CardTitle>
                <CardDescription>{t('purchase.rfqs.comparisonHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Comparison
                  rfq={loaded}
                  onQuote={setQuoting}
                  onAward={setAwarding}
                  canQuote={can('purchase.update')}
                  canAward={can('purchase.approve')}
                />
              </CardContent>
            </Card>
            <RelatedDocuments
              groups={[
                {
                  label: t('purchase.requisitions.entity'),
                  route: DOC_ROUTES.requisition,
                  docs: loaded.requisition ? [loaded.requisition] : [],
                },
              ]}
            />
          </div>
        )
      )}

      {quoting && loaded && <QuoteDialog rfq={loaded} supplier={quoting} onClose={() => setQuoting(null)} />}
      <Dialog open={Boolean(awarding)} onOpenChange={(o) => !o && !action.isPending && setAwarding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('purchase.rfqs.awardTitle', { name: awarding?.supplier.name })}</DialogTitle>
            <DialogDescription>
              {t('purchase.rfqs.awardText', { total: formatCurrency(awarding?.total) })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>{t('purchase.deliverTo')}</Label>
            <WarehouseSelect
              value={awardWarehouse}
              onChange={setAwardWarehouse}
              placeholder={t('purchase.rfqs.warehouseFromRequisition')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwarding(null)} disabled={action.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() =>
                run(id!, 'award', {
                  body: {
                    rfqSupplierId: awarding!.id,
                    ...(awardWarehouse && { warehouseId: awardWarehouse }),
                  },
                  goTo: DOC_ROUTES.order,
                  onDone: () => setAwarding(null),
                })
              }
              disabled={action.isPending}
            >
              {action.isPending ? <Spinner /> : <Award aria-hidden />} {t('purchase.rfqs.award')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('purchase.confirm.cancelText')}
        confirmLabel={t('purchase.actions.cancel')}
        loading={action.isPending}
        onConfirm={() => run(id!, 'cancel', { onDone: () => setConfirm(null) })}
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
          remove.mutate(id!, { onSuccess: () => navigate(DOC_ROUTES.rfq), onError: () => setConfirm(null) })
        }
      />
    </form>
  );
}
