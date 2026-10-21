import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, CheckCircle2, HandCoins, Save, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { returnsApi, usePurchaseLookups } from '../api/purchase-api';
import { ApplyCreditDialog } from '../components/apply-credit-dialog';
import { useLinesTotals, useRunAction } from '../components/form-helpers';
import { PurchaseLines } from '../components/purchase-lines';
import { PurchaseStatusBadge, RelatedDocuments, TotalsCard, TrailCard } from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { linePayload, lineFromSaved, linesSchema, type PurchaseLineValues } from '../schemas';

const schema = z
  .object({
    type: z.enum(['return', 'debit_note']),
    supplierId: v.required(),
    warehouseId: z.string(),
    receiptId: z.string(),
    billId: z.string(),
    returnDate: v.required(),
    reason: z.string().max(255, 'validation.tooLong'),
    notes: z.string().max(2000, 'validation.tooLong'),
    items: linesSchema,
  })
  .refine((r) => r.type !== 'return' || r.warehouseId, {
    path: ['warehouseId'],
    message: 'validation.required',
  });
type Values = z.infer<typeof schema>;

export default function ReturnFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = usePurchaseLookups();
  const doc = returnsApi.useOne(isNew ? null : id);
  const save = returnsApi.useSave();
  const action = returnsApi.useAction();
  const remove = returnsApi.useRemove();
  const run = useRunAction(action);
  const [confirm, setConfirm] = useState<'post' | 'cancel' | 'delete' | null>(null);
  const [applying, setApplying] = useState(false);
  const [pickedSupplier, setSupplierLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      type: 'return',
      supplierId: '',
      warehouseId: '',
      receiptId: '',
      billId: '',
      returnDate: todayIn(timezone),
      reason: '',
      notes: '',
      items: [],
    },
  });
  const [watchedBillId, watchedReceiptId, watchedType, watchedWarehouseId] = useWatch({
    control: form.control,
    name: ['billId', 'receiptId', 'type', 'warehouseId'],
  });
  const loaded = doc.data;
  const supplierLabel =
    pickedSupplier ?? (loaded ? `${loaded.supplier.name} (${loaded.supplier.code})` : null);
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(['purchase.create', 'purchase.update']);
  const type = watchedType;
  const lineForm = form as unknown as UseFormReturn<{ items: PurchaseLineValues[] }>;
  const calc = useLinesTotals(lineForm.control, editable);
  const linked = Boolean(watchedReceiptId || watchedBillId);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      type: loaded.type,
      supplierId: loaded.supplierId,
      warehouseId: loaded.warehouseId ?? '',
      receiptId: loaded.receiptId ?? '',
      billId: loaded.billId ?? '',
      returnDate: loaded.returnDate,
      reason: loaded.reason ?? '',
      notes: loaded.notes ?? '',
      items: (loaded.items ?? []).map((l) => lineFromSaved(l)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    type: values.type,
    supplierId: values.supplierId,
    warehouseId: values.type === 'return' ? values.warehouseId : null,
    receiptId: values.receiptId || null,
    billId: values.billId || null,
    returnDate: values.returnDate,
    reason: nullIfEmpty(values.reason),
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) =>
      linePayload(l, {
        price: true,
        ...(values.type === 'return' && { batch: 'existing' as const, serials: true }),
      }),
    ),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);
  const persist = (values: Values) => save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${DOC_ROUTES.return}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onPost = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'post' });
      toast.success(t('purchase.toast.returnPosted'));
      setConfirm(null);
      if (isNew) navigate(`${DOC_ROUTES.return}/${saved.id}`, { replace: true });
    } catch (err) {
      setConfirm(null);
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={
          isNew ? t('purchase.returns.new') : `${t(`purchase.returnTypes.${loaded?.type}`)} ${loaded?.number}`
        }
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={status} /> {loaded.supplier.name} · {formatDate(loaded.returnDate)}
            </span>
          ) : (
            t('purchase.returns.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.returns.title'), to: DOC_ROUTES.return },
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
                  <CheckCircle2 aria-hidden /> {t('purchase.returns.post')}
                </Button>
              </>
            )}
            {loaded &&
              status === 'posted' &&
              Number(loaded.unapplied) > 0 &&
              can(['purchase.create', 'accounting.create']) && (
                <Button type="button" onClick={() => setApplying(true)}>
                  <HandCoins aria-hidden /> {t('purchase.returns.applyToBills')}
                </Button>
              )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!editable || busy} className="contents">
                <FieldGroup>
                  <FormField
                    control={form.control}
                    name="type"
                    label={t('fields.type')}
                    description={t(`purchase.returnTypeHints.${type}`)}
                    render={({ field, id: fieldId }) => (
                      <ToggleGroup
                        id={fieldId}
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(val) => val && field.onChange(val)}
                        className="justify-start"
                        disabled={!editable}
                      >
                        <ToggleGroupItem value="return">{t('purchase.returnTypes.return')}</ToggleGroupItem>
                        <ToggleGroupItem value="debit_note">
                          {t('purchase.returnTypes.debit_note')}
                        </ToggleGroupItem>
                      </ToggleGroup>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="supplierId"
                      label={t('purchase.supplier')}
                      render={({ field, aria }) => (
                        <SupplierSelect
                          value={field.value || null}
                          selectedLabel={supplierLabel}
                          disabled={!editable || busy || linked}
                          onChange={(sid, s) => {
                            field.onChange(sid);
                            setSupplierLabel(`${s.name} (${s.code})`);
                          }}
                          {...aria}
                        />
                      )}
                    />
                    {type === 'return' && (
                      <FormField
                        control={form.control}
                        name="warehouseId"
                        label={t('purchase.returns.fromWarehouse')}
                        render={({ field, aria }) => (
                          <WarehouseSelect
                            value={field.value || null}
                            onChange={(w) => field.onChange(w ?? '')}
                            disabled={!editable || busy}
                            {...aria}
                          />
                        )}
                      />
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      control={form.control}
                      name="returnDate"
                      type="date"
                      label={t('purchase.date')}
                    />
                    <TextField control={form.control} name="reason" label={t('inventory.reason')} />
                  </div>
                </FieldGroup>
              </fieldset>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.items')}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!editable || busy} className="contents">
                <PurchaseLines
                  form={lineForm}
                  mode={type === 'return' ? 'return' : 'priced'}
                  warehouseId={watchedWarehouseId}
                  taxGroups={lookups.data?.taxGroups}
                  calc={editable ? calc.data : undefined}
                  readOnly={!editable}
                />
              </fieldset>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <fieldset disabled={!editable || busy} className="contents">
                <TextareaField control={form.control} name="notes" label={t('inventory.notes')} rows={2} />
              </fieldset>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <TotalsCard
            totals={editable ? calc.data?.totals : loaded}
            taxes={editable ? calc.data?.totals.taxes : undefined}
            loading={calc.isFetching}
            extra={
              loaded && status === 'posted'
                ? [
                    { label: t('purchase.returns.applied'), value: formatCurrency(loaded.appliedAmount) },
                    {
                      label: t('purchase.returns.unapplied'),
                      value: formatCurrency(loaded.unapplied),
                      strong: true,
                    },
                  ]
                : undefined
            }
          />
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('purchase.receipts.entity'),
                  route: DOC_ROUTES.receipt,
                  docs: loaded.receipt ? [loaded.receipt] : [],
                },
                {
                  label: t('purchase.bills.entity'),
                  route: DOC_ROUTES.bill,
                  docs: loaded.bill ? [loaded.bill] : [],
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

      {applying && loaded && (
        <ApplyCreditDialog
          sourceType="debit_note"
          sourceId={loaded.id}
          supplierId={loaded.supplierId}
          available={loaded.unapplied}
          onClose={() => setApplying(false)}
        />
      )}
      <ConfirmDialog
        open={confirm === 'post'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('purchase.confirm.postReturnTitle')}
        description={t(
          type === 'return' ? 'purchase.confirm.postReturnText' : 'purchase.confirm.postDebitNoteText',
        )}
        confirmLabel={t('purchase.returns.post')}
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
            onSuccess: () => navigate(DOC_ROUTES.return),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
