import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, FileText, PackageCheck, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import type { GoodsReceipt, LandedCostType } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { receiptsApi } from '../api/purchase-api';
import { useRunAction } from '../components/form-helpers';
import { PurchaseLines } from '../components/purchase-lines';
import { PurchaseStatusBadge, RelatedDocuments, TrailCard } from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, lineName, nullIfEmpty, todayIn } from '../lib';
import { linePayload, lineFromSaved, linesSchema, type PurchaseLineValues } from '../schemas';

const COST_TYPES: LandedCostType[] = ['freight', 'duty', 'insurance', 'handling', 'other'];

const schema = z.object({
  supplierId: v.required(),
  warehouseId: v.required(),
  orderId: z.string(),
  receiptDate: v.required(),
  supplierReference: z.string().max(100, 'validation.tooLong'),
  notes: z.string().max(2000, 'validation.tooLong'),
  items: linesSchema,
  costs: z.array(
    z.object({
      costType: z.enum(['freight', 'duty', 'insurance', 'handling', 'other']),
      description: z.string().max(255, 'validation.tooLong'),
      amount: v.decimal({ scale: 4 }),
      allocation: z.enum(['value', 'quantity']),
    }),
  ),
});
type Values = z.infer<typeof schema>;

/** Line value, landed-cost share and resulting stock cost per line (as saved). */
function CostingTable({ receipt }: { receipt: GoodsReceipt }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('inventory.item')}</TableHead>
            <TableHead className="text-right">{t('inventory.quantity')}</TableHead>
            <TableHead className="text-right">{t('purchase.receipts.lineValue')}</TableHead>
            <TableHead className="text-right">{t('purchase.receipts.landedShare')}</TableHead>
            <TableHead className="text-right">{t('purchase.receipts.unitCost')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(receipt.items ?? []).map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                {lineName(l)}
                {l.batch && <div className="font-mono text-xs text-muted-foreground">{l.batch.batchNo}</div>}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatQuantity(l.baseQuantity)} {l.product.baseUnit?.code}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(l.lineValue)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(l.landedCost)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(l.unitCost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>{t('purchase.total')}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(receipt.goodsValue)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(receipt.landedCostTotal)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(receipt.totalCost)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export default function ReceiptFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const doc = receiptsApi.useOne(isNew ? null : id);
  const save = receiptsApi.useSave();
  const action = receiptsApi.useAction();
  const remove = receiptsApi.useRemove();
  const run = useRunAction(action);
  const [confirm, setConfirm] = useState<'post' | 'cancel' | 'delete' | null>(null);
  const [pickedSupplier, setSupplierLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      supplierId: '',
      warehouseId: '',
      orderId: '',
      receiptDate: todayIn(timezone),
      supplierReference: '',
      notes: '',
      items: [],
      costs: [],
    },
  });
  const [watchedOrderId, watchedWarehouseId] = useWatch({
    control: form.control,
    name: ['orderId', 'warehouseId'],
  });
  const costs = useFieldArray({ control: form.control, name: 'costs' });
  const loaded = doc.data;
  const supplierLabel =
    pickedSupplier ?? (loaded ? `${loaded.supplier.name} (${loaded.supplier.code})` : null);
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(['purchase.create', 'purchase.update']);
  const fromOrder = Boolean(watchedOrderId);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      supplierId: loaded.supplierId,
      warehouseId: loaded.warehouseId,
      orderId: loaded.orderId ?? '',
      receiptDate: loaded.receiptDate,
      supplierReference: loaded.supplierReference ?? '',
      notes: loaded.notes ?? '',
      items: (loaded.items ?? []).map((l) => {
        const oi = (l as unknown as { orderItem?: { baseQuantity: string; receivedBaseQuantity: string } })
          .orderItem;
        return lineFromSaved(l, {
          priceLocked: Boolean(l.orderItemId),
          info:
            oi && status === 'draft'
              ? t('purchase.receipts.lineProgress', {
                  ordered: formatQuantity(oi.baseQuantity),
                  received: formatQuantity(oi.receivedBaseQuantity),
                  unit: l.product.baseUnit?.code ?? '',
                })
              : '',
        });
      }),
      costs: (loaded.costs ?? []).map((c) => ({
        costType: c.costType,
        description: c.description ?? '',
        amount: String(Number(c.amount)),
        allocation: c.allocation,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    supplierId: values.supplierId,
    warehouseId: values.warehouseId,
    orderId: values.orderId || null,
    receiptDate: values.receiptDate,
    supplierReference: nullIfEmpty(values.supplierReference),
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) => ({
      ...linePayload(l, { batch: 'new', serials: true }),
      ...(!l.priceLocked && { unitPrice: l.unitPrice || '0', taxGroupId: l.taxGroupId || null }),
    })),
    costs: values.costs.map((c) => ({ ...c, description: nullIfEmpty(c.description) })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);

  const persist = async (values: Values) =>
    save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });
  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${DOC_ROUTES.receipt}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onPost = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'post' });
      toast.success(t('purchase.toast.post'));
      setConfirm(null);
      if (isNew) navigate(`${DOC_ROUTES.receipt}/${saved.id}`, { replace: true });
    } catch (err) {
      setConfirm(null);
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const unbilled = (loaded?.items ?? []).some(
    (l) =>
      Number(l.baseQuantity) - Number(l.returnedBaseQuantity ?? 0) - Number(l.billedBaseQuantity ?? 0) > 0,
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('purchase.receipts.new') : `${t('purchase.receipts.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={status} /> {loaded.supplier.name} · {loaded.warehouse.name} ·{' '}
              {formatDate(loaded.receiptDate)}
            </span>
          ) : (
            t('purchase.receipts.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.receipts.title'), to: DOC_ROUTES.receipt },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('purchase.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded && status === 'draft' && editable && (
              <Button type="button" variant="outline" onClick={() => setConfirm('cancel')} disabled={busy}>
                <Ban aria-hidden /> {t('purchase.actions.cancel')}
              </Button>
            )}
            {editable && (
              <>
                <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                  {save.isPending && !action.isPending ? <Spinner /> : <Save aria-hidden />}{' '}
                  {t('inventory.actions.saveDraft')}
                </Button>
                <Button
                  type="button"
                  onClick={async () =>
                    (await form.trigger()) ? setConfirm('post') : toast.error(t('inventory.fixErrors'))
                  }
                  disabled={busy}
                >
                  <PackageCheck aria-hidden /> {t('purchase.receipts.post')}
                </Button>
              </>
            )}
            {status === 'posted' && can('purchase.create') && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => run(id!, 'convert-to-return', { goTo: DOC_ROUTES.return })}
                  disabled={busy}
                >
                  <Undo2 aria-hidden /> {t('purchase.convert.toReturn')}
                </Button>
                {unbilled && (
                  <Button
                    type="button"
                    onClick={() => run(id!, 'convert-to-bill', { goTo: DOC_ROUTES.bill })}
                    disabled={busy}
                  >
                    <FileText aria-hidden /> {t('purchase.convert.toBill')}
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.details')}</CardTitle>
              {fromOrder && loaded?.order && (
                <CardDescription>
                  {t('purchase.receipts.againstOrder')}{' '}
                  <Link
                    to={`${DOC_ROUTES.order}/${loaded.order.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {loaded.order.number}
                  </Link>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <fieldset disabled={!editable || busy} className="contents">
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="supplierId"
                      label={t('purchase.supplier')}
                      render={({ field, aria }) => (
                        <SupplierSelect
                          value={field.value || null}
                          selectedLabel={supplierLabel}
                          disabled={!editable || busy || fromOrder}
                          onChange={(sid, s) => {
                            field.onChange(sid);
                            setSupplierLabel(`${s.name} (${s.code})`);
                          }}
                          {...aria}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="warehouseId"
                      label={t('purchase.receiveInto')}
                      render={({ field, aria }) => (
                        <WarehouseSelect
                          value={field.value || null}
                          onChange={(w) => field.onChange(w ?? '')}
                          disabled={!editable || busy}
                          {...aria}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      control={form.control}
                      name="receiptDate"
                      type="date"
                      label={t('purchase.receipts.date')}
                    />
                    <TextField
                      control={form.control}
                      name="supplierReference"
                      label={t('purchase.challan')}
                    />
                  </div>
                </FieldGroup>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('purchase.receipts.itemsReceived')}</CardTitle>
              {editable && fromOrder && (
                <CardDescription>{t('purchase.receipts.partialHint')}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <fieldset disabled={!editable || busy} className="contents">
                <PurchaseLines
                  form={form as unknown as UseFormReturn<{ items: PurchaseLineValues[] }>}
                  mode="receipt"
                  warehouseId={watchedWarehouseId}
                  readOnly={!editable}
                  allowAdd={!fromOrder}
                />
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('purchase.receipts.landedCosts')}</CardTitle>
              <CardDescription>{t('purchase.receipts.landedHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <fieldset disabled={!editable || busy} className="contents">
                {costs.fields.map((c, i) => (
                  <div key={c.id} className="grid items-start gap-2 sm:grid-cols-[9rem_1fr_8rem_9rem_auto]">
                    <FormField
                      control={form.control}
                      name={`costs.${i}.costType`}
                      render={({ field, aria }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                          <SelectTrigger className="w-full" {...aria} aria-label={t('fields.type')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COST_TYPES.map((ct) => (
                              <SelectItem key={ct} value={ct}>
                                {t(`purchase.costTypes.${ct}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`costs.${i}.description`}
                      render={({ field, aria }) => (
                        <Input
                          {...field}
                          {...aria}
                          placeholder={t('purchase.receipts.costDescription')}
                          aria-label={t('purchase.receipts.costDescription')}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`costs.${i}.amount`}
                      render={({ field, aria }) => (
                        <Input
                          {...field}
                          {...aria}
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          aria-label={t('purchase.amount')}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`costs.${i}.allocation`}
                      render={({ field, aria }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!editable}>
                          <SelectTrigger
                            className="w-full"
                            {...aria}
                            aria-label={t('purchase.receipts.allocateBy')}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="value">{t('purchase.receipts.byValue')}</SelectItem>
                            <SelectItem value="quantity">{t('purchase.receipts.byQuantity')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {editable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => costs.remove(i)}
                        aria-label={t('common.remove')}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                ))}
                {!costs.fields.length && !editable && (
                  <p className="text-sm text-muted-foreground">{t('purchase.receipts.noLandedCosts')}</p>
                )}
                {editable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      costs.append({ costType: 'freight', description: '', amount: '', allocation: 'value' })
                    }
                  >
                    <Plus aria-hidden /> {t('purchase.receipts.addCost')}
                  </Button>
                )}
              </fieldset>
            </CardContent>
          </Card>

          {loaded && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('purchase.receipts.costing')}</CardTitle>
                <CardDescription>
                  {t(
                    status === 'posted'
                      ? 'purchase.receipts.costingPosted'
                      : 'purchase.receipts.costingDraft',
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CostingTable receipt={loaded} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <fieldset disabled={!editable || busy} className="contents">
                <TextareaField control={form.control} name="notes" label={t('inventory.notes')} rows={2} />
              </fieldset>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('purchase.orders.entity'),
                  route: DOC_ROUTES.order,
                  docs: loaded.order ? [loaded.order] : [],
                },
              ]}
            />
          )}
          {loaded && (
            <TrailCard
              entries={[
                { label: t('inventory.trail.created'), user: loaded.creator, at: loaded.createdAt },
                { label: t('purchase.trail.posted'), user: loaded.poster, at: loaded.postedAt },
              ]}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'post'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('purchase.confirm.postReceiptTitle')}
        description={t('purchase.confirm.postReceiptText')}
        confirmLabel={t('purchase.receipts.post')}
        loading={busy}
        onConfirm={onPost}
      />
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
          remove.mutate(id!, {
            onSuccess: () => navigate(DOC_ROUTES.receipt),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
