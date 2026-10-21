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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { useRunAction } from '@/features/purchase/components/form-helpers';
import { RelatedDocuments, TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { salesReturnsApi, useSalesLookups } from '../api/sales-api';
import { ApplyCustomerCreditDialog } from '../components/apply-customer-credit-dialog';
import { SalesLines } from '../components/sales-lines';
import { SalesStatusBadge, SalesTotalsCard } from '../components/sales-ui';
import { useSalesTotals } from '../components/use-sales-totals';
import { SALES_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { lineFromSaved, linePayload, salesLinesSchema, type SalesLinesForm } from '../schemas';

const schema = z
  .object({
    type: z.enum(['return', 'credit_note']),
    customerId: v.required(),
    warehouseId: z.string(),
    invoiceId: z.string(),
    returnDate: v.required(),
    reason: z.string().max(255, 'validation.tooLong'),
    notes: z.string().max(2000, 'validation.tooLong'),
    discountType: z.enum(['percent', 'amount']),
    discountValue: z.string().regex(/^(\d+(\.\d{1,4})?)?$/, 'validation.decimal'),
    items: salesLinesSchema,
  })
  .superRefine((val, ctx) => {
    if (val.type === 'return' && !val.warehouseId)
      ctx.addIssue({ code: 'custom', path: ['warehouseId'], message: 'validation.required' });
  });
type Values = z.infer<typeof schema>;

/** Sales return (goods come back into stock) or credit note (price adjustment, no stock). */
export default function SalesReturnFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = useSalesLookups();
  const doc = salesReturnsApi.useOne(isNew ? null : id);
  const save = salesReturnsApi.useSave();
  const action = salesReturnsApi.useAction();
  const remove = salesReturnsApi.useRemove();
  const run = useRunAction(action, 'sales');
  const [confirm, setConfirm] = useState<'post' | 'cancel' | 'delete' | null>(null);
  const [applying, setApplying] = useState(false);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      type: 'return',
      customerId: '',
      warehouseId: '',
      invoiceId: '',
      returnDate: todayIn(timezone),
      reason: '',
      notes: '',
      discountType: 'percent',
      discountValue: '',
      items: [],
    },
  });
  const [type, customerId, warehouseId, invoiceId] = useWatch({
    control: form.control,
    name: ['type', 'customerId', 'warehouseId', 'invoiceId'],
  });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(['sales.create', 'sales.update']);
  const lineForm = form as unknown as UseFormReturn<SalesLinesForm>;
  const calc = useSalesTotals(lineForm.control, editable);
  const linked = Boolean(invoiceId);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      type: loaded.type,
      customerId: loaded.customerId,
      warehouseId: loaded.warehouseId ?? '',
      invoiceId: loaded.invoiceId ?? '',
      returnDate: loaded.returnDate,
      reason: loaded.reason ?? '',
      notes: loaded.notes ?? '',
      discountType: loaded.discountType,
      discountValue: Number(loaded.discountValue) ? String(Number(loaded.discountValue)) : '',
      items: (loaded.items ?? []).map((l) => lineFromSaved(l)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    type: values.type,
    customerId: values.customerId,
    warehouseId: values.type === 'return' ? values.warehouseId || null : null,
    invoiceId: values.invoiceId || null,
    returnDate: values.returnDate,
    reason: nullIfEmpty(values.reason),
    notes: nullIfEmpty(values.notes),
    discountType: values.discountType,
    discountValue: values.discountValue || '0',
    items: values.items.map((l) => linePayload(l, { price: true, stock: values.type === 'return' })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);
  const persist = (values: Values) => save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${SALES_ROUTES.return}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onPost = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'post' });
      toast.success(t('sales.toast.returnPosted'));
      setConfirm(null);
      if (isNew) navigate(`${SALES_ROUTES.return}/${saved.id}`, { replace: true });
    } catch (err) {
      setConfirm(null);
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const entity = t(`sales.returns.types.${type}`);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('sales.returns.new') : `${entity} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStatusBadge status={status} /> {loaded.customer.name} · {formatDate(loaded.returnDate)}
            </span>
          ) : (
            t('sales.returns.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.returns.title'), to: SALES_ROUTES.return },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('sales.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded && status === 'draft' && editable && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('cancel')} disabled={busy}>
                <Ban aria-hidden /> {t('purchase.actions.cancel')}
              </Button>
            )}
            {editable && (
              <>
                <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                  {save.isPending && !action.isPending ? <Spinner /> : <Save aria-hidden />}{' '}
                  {t('inventory.actions.saveDraft')}
                </Button>
                {can('sales.update') && (
                  <Button
                    type="button"
                    onClick={async () =>
                      (await form.trigger()) ? setConfirm('post') : toast.error(t('inventory.fixErrors'))
                    }
                    disabled={busy}
                  >
                    <CheckCircle2 aria-hidden /> {t('sales.returns.post')}
                  </Button>
                )}
              </>
            )}
            {loaded &&
              status === 'posted' &&
              Number(loaded.unapplied) > 0 &&
              can(['sales.create', 'accounting.create']) && (
                <Button type="button" onClick={() => setApplying(true)}>
                  <HandCoins aria-hidden /> {t('sales.receipts.applyCredit')}
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
                    label={t('sales.returns.type')}
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid gap-3 sm:grid-cols-2"
                        disabled={!editable || busy || linked}
                      >
                        {(['return', 'credit_note'] as const).map((k) => (
                          <Label
                            key={k}
                            htmlFor={`ret-${k}`}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary"
                          >
                            <RadioGroupItem id={`ret-${k}`} value={k} className="mt-0.5" />
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">{t(`sales.returns.types.${k}`)}</span>
                              <span className="text-xs text-muted-foreground">
                                {t(`sales.returns.typeHints.${k}`)}
                              </span>
                            </span>
                          </Label>
                        ))}
                      </RadioGroup>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="customerId"
                      label={t('sales.customer')}
                      render={({ field, aria }) => (
                        <SupplierSelect
                          type="customer"
                          value={field.value || null}
                          selectedLabel={
                            customerLabel ??
                            (loaded ? `${loaded.customer.name} (${loaded.customer.code})` : null)
                          }
                          disabled={!editable || busy || linked}
                          onChange={(cid, c) => {
                            field.onChange(cid);
                            setCustomerLabel(`${c.name} (${c.code})`);
                          }}
                          {...aria}
                        />
                      )}
                    />
                    {type === 'return' && (
                      <FormField
                        control={form.control}
                        name="warehouseId"
                        label={t('sales.returns.receiveInto')}
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
                    <TextField control={form.control} name="reason" label={t('sales.returns.reason')} />
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
                <SalesLines
                  form={lineForm}
                  stock={type === 'return' && editable}
                  incoming
                  customerId={customerId}
                  warehouseId={warehouseId || null}
                  taxGroups={lookups.data?.taxGroups}
                  calc={editable ? calc.data : undefined}
                  readOnly={!editable}
                  allowAdd={!linked}
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
          <SalesTotalsCard
            totals={editable ? calc.data?.totals : loaded}
            taxes={editable ? calc.data?.totals.taxes : undefined}
            loading={calc.isFetching}
            control={editable ? lineForm.control : undefined}
            extra={
              loaded && status === 'posted'
                ? [
                    { label: t('sales.returns.applied'), value: formatCurrency(loaded.appliedAmount) },
                    {
                      label: t('sales.returns.unapplied'),
                      value: formatCurrency(loaded.unapplied),
                      strong: true,
                    },
                  ]
                : undefined
            }
          />
          {loaded?.invoice && status === 'draft' && (
            <Alert>
              <AlertDescription>
                {t('sales.returns.appliesTo', { number: loaded.invoice.number })}
              </AlertDescription>
            </Alert>
          )}
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('sales.invoices.entity'),
                  route: SALES_ROUTES.invoice,
                  docs: loaded.invoice ? [loaded.invoice] : [],
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
        title={t('sales.confirm.postReturnTitle')}
        description={t(
          type === 'return' ? 'sales.confirm.postReturnText' : 'sales.confirm.postCreditNoteText',
        )}
        confirmLabel={t('sales.returns.post')}
        loading={busy}
        onConfirm={onPost}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('sales.confirm.cancelReturnText')}
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
            onSuccess: () => navigate(SALES_ROUTES.return),
            onError: () => setConfirm(null),
          })
        }
      />
      {applying && loaded && (
        <ApplyCustomerCreditDialog
          sourceType="credit_note"
          sourceId={loaded.id}
          customerId={loaded.customerId}
          available={loaded.unapplied}
          onClose={() => setApplying(false)}
        />
      )}
    </form>
  );
}
