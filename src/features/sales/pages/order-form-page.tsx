import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, CheckCircle2, Lock, Receipt, Save, Trash2, Truck } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate, formatQuantity } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import type { SalesLine } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { useRunAction } from '@/features/purchase/components/form-helpers';
import { RelatedDocuments, TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { salesOrdersApi, useSalesLookups } from '../api/sales-api';
import { SalesLines } from '../components/sales-lines';
import {
  CreditOverrideDialog,
  CreditOverridesCard,
  SalesStatusBadge,
  SalesTotalsCard,
} from '../components/sales-ui';
import { useCreditOverride } from '../components/use-credit-override';
import { useSalesTotals } from '../components/use-sales-totals';
import { SALES_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { lineFromSaved, linePayload, salesLinesSchema, type SalesLinesForm } from '../schemas';

const schema = z.object({
  customerId: v.required(),
  warehouseId: v.required(),
  orderDate: v.required(),
  deliveryDate: z.string(),
  paymentTermsDays: z.string().regex(/^\d{0,3}$/, 'validation.integer'),
  customerReference: z.string().max(100, 'validation.tooLong'),
  shippingAddress: z.string().max(500, 'validation.tooLong'),
  notes: z.string().max(2000, 'validation.tooLong'),
  terms: z.string().max(5000, 'validation.tooLong'),
  discountType: z.enum(['percent', 'amount']),
  discountValue: z.string().regex(/^(\d+(\.\d{1,4})?)?$/, 'validation.decimal'),
  items: salesLinesSchema,
});
type Values = z.infer<typeof schema>;

/** "Delivered 4 / Invoiced 2 pcs" under an order line once it is confirmed. */
function progressInfo(l: SalesLine, t: TFunction) {
  if (!l.deliveredBaseQuantity && !l.invoicedBaseQuantity) return '';
  const unit = l.product.baseUnit?.code ?? '';
  return t('sales.orders.lineProgress', {
    delivered: formatQuantity(l.deliveredBaseQuantity ?? '0'),
    invoiced: formatQuantity(l.invoicedBaseQuantity ?? '0'),
    ordered: formatQuantity(l.baseQuantity),
    unit,
  });
}

export default function SalesOrderFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = useSalesLookups();
  const doc = salesOrdersApi.useOne(isNew ? null : id);
  const save = salesOrdersApi.useSave();
  const action = salesOrdersApi.useAction();
  const remove = salesOrdersApi.useRemove();
  const run = useRunAction(action, 'sales');
  const credit = useCreditOverride();
  const [confirm, setConfirm] = useState<'cancel' | 'close' | 'delete' | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      customerId: '',
      warehouseId: '',
      orderDate: todayIn(timezone),
      deliveryDate: '',
      paymentTermsDays: '',
      customerReference: '',
      shippingAddress: '',
      notes: '',
      terms: '',
      discountType: 'percent',
      discountValue: '',
      items: [],
    },
  });
  const [customerId, warehouseId] = useWatch({ control: form.control, name: ['customerId', 'warehouseId'] });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'sales.create' : 'sales.update');
  const lineForm = form as unknown as UseFormReturn<SalesLinesForm>;
  const calc = useSalesTotals(lineForm.control, editable);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      customerId: loaded.customerId,
      warehouseId: loaded.warehouseId,
      orderDate: loaded.orderDate,
      deliveryDate: loaded.deliveryDate ?? '',
      paymentTermsDays: String(loaded.paymentTermsDays ?? ''),
      customerReference: loaded.customerReference ?? '',
      shippingAddress: loaded.shippingAddress ?? '',
      notes: loaded.notes ?? '',
      terms: loaded.terms ?? '',
      discountType: loaded.discountType,
      discountValue: Number(loaded.discountValue) ? String(Number(loaded.discountValue)) : '',
      items: (loaded.items ?? []).map((l) => lineFromSaved(l, { info: progressInfo(l, t) })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    customerId: values.customerId,
    warehouseId: values.warehouseId,
    orderDate: values.orderDate,
    deliveryDate: nullIfEmpty(values.deliveryDate),
    ...(values.paymentTermsDays !== '' && { paymentTermsDays: Number(values.paymentTermsDays) }),
    customerReference: nullIfEmpty(values.customerReference),
    shippingAddress: nullIfEmpty(values.shippingAddress),
    notes: nullIfEmpty(values.notes),
    terms: nullIfEmpty(values.terms),
    discountType: values.discountType,
    discountValue: values.discountValue || '0',
    items: values.items.map((l) => linePayload(l, { price: true })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);
  const persist = (values: Values) => save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${SALES_ROUTES.order}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onConfirm = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      const openSaved = () => isNew && navigate(`${SALES_ROUTES.order}/${saved.id}`, { replace: true });
      const done = await credit.run(async (body) => {
        await action.mutateAsync({ id: saved.id, action: 'confirm', body });
        toast.success(t('sales.toast.confirm'));
      }, openSaved);
      if (!done) toast.warning(t('sales.credit.needsOverride'));
    } catch (err) {
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const delivering = ['confirmed', 'partially_delivered'].includes(status);
  const invoiceable = ['confirmed', 'partially_delivered', 'delivered'].includes(status);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('sales.orders.new') : `${t('sales.orders.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStatusBadge status={status} /> {loaded.customer.name} · {formatDate(loaded.orderDate)} ·{' '}
              {loaded.warehouse.name}
            </span>
          ) : (
            t('sales.orders.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.orders.title'), to: SALES_ROUTES.order },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('sales.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded && ['draft', 'confirmed'].includes(status) && can('sales.update') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('cancel')} disabled={busy}>
                <Ban aria-hidden /> {t('purchase.actions.cancel')}
              </Button>
            )}
            {loaded && ['partially_delivered', 'delivered'].includes(status) && can('sales.update') && (
              <Button type="button" variant="outline" onClick={() => setConfirm('close')} disabled={busy}>
                <Lock aria-hidden /> {t('sales.actions.close')}
              </Button>
            )}
            {editable && (
              <>
                <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                  {save.isPending && !action.isPending ? <Spinner /> : <Save aria-hidden />}{' '}
                  {t('inventory.actions.saveDraft')}
                </Button>
                <Button type="button" onClick={onConfirm} disabled={busy}>
                  <CheckCircle2 aria-hidden /> {t('sales.actions.confirm')}
                </Button>
              </>
            )}
            {loaded && invoiceable && can('sales.create') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => run(id!, 'convert-to-invoice', { goTo: SALES_ROUTES.invoice })}
                disabled={busy}
              >
                <Receipt aria-hidden /> {t('sales.convert.toInvoice')}
              </Button>
            )}
            {loaded && delivering && can('sales.create') && (
              <Button
                type="button"
                onClick={() => run(id!, 'convert-to-challan', { goTo: SALES_ROUTES.challan })}
                disabled={busy}
              >
                <Truck aria-hidden /> {t('sales.convert.toChallan')}
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
                          disabled={!editable || busy || Boolean(loaded?.quotationId)}
                          onChange={(cid, c) => {
                            field.onChange(cid);
                            setCustomerLabel(`${c.name} (${c.code})`);
                          }}
                          {...aria}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="warehouseId"
                      label={t('sales.shipFrom')}
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
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextField
                      control={form.control}
                      name="orderDate"
                      type="date"
                      label={t('purchase.date')}
                    />
                    <TextField
                      control={form.control}
                      name="deliveryDate"
                      type="date"
                      label={t('sales.deliveryDate')}
                    />
                    <TextField
                      control={form.control}
                      name="paymentTermsDays"
                      inputMode="numeric"
                      label={t('sales.paymentTerms')}
                      placeholder={String(lookups.data?.settings.defaultPaymentTermsDays ?? '')}
                      description={t('sales.paymentTermsHint')}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      control={form.control}
                      name="customerReference"
                      label={t('sales.customerReference')}
                    />
                    <TextField
                      control={form.control}
                      name="shippingAddress"
                      label={t('sales.shippingAddress')}
                    />
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
                  customerId={customerId}
                  warehouseId={warehouseId}
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
                <FieldGroup>
                  <TextareaField control={form.control} name="notes" label={t('inventory.notes')} rows={2} />
                  <TextareaField
                    control={form.control}
                    name="terms"
                    label={t('print.terms')}
                    description={t('sales.termsHint')}
                    rows={3}
                  />
                </FieldGroup>
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
          />
          {loaded && status !== 'draft' && loaded.deliveredPercent != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('sales.orders.delivery')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Number(loaded.deliveredPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('sales.orders.delivery')}
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, Number(loaded.deliveredPercent))}%` }}
                  />
                </div>
                <span className="text-muted-foreground">
                  {t('sales.orders.deliveredPercent', {
                    percent: Math.round(Number(loaded.deliveredPercent)),
                  })}
                </span>
              </CardContent>
            </Card>
          )}
          <CreditOverridesCard entries={loaded?.creditOverrides} />
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('sales.quotations.entity'),
                  route: SALES_ROUTES.quotation,
                  docs: loaded.quotation ? [loaded.quotation] : [],
                },
                {
                  label: t('sales.challans.title'),
                  route: SALES_ROUTES.challan,
                  docs: loaded.challans ?? [],
                },
                {
                  label: t('sales.invoices.title'),
                  route: SALES_ROUTES.invoice,
                  docs: loaded.invoices ?? [],
                },
              ]}
            />
          )}
          {loaded && (
            <TrailCard
              entries={[
                { label: t('inventory.trail.created'), user: loaded.creator, at: loaded.createdAt },
                { label: t('sales.trail.confirmed'), user: loaded.confirmer, at: loaded.confirmedAt },
                { label: t('sales.trail.closed'), user: loaded.closer, at: loaded.closedAt },
                { label: t('sales.trail.cancelled'), user: loaded.canceller, at: loaded.cancelledAt },
              ]}
            />
          )}
        </div>
      </div>

      {credit.dialog.open && <CreditOverrideDialog {...credit.dialog} />}
      <ConfirmDialog
        open={confirm === 'close'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('sales.confirm.closeTitle')}
        description={t('sales.confirm.closeText')}
        confirmLabel={t('sales.actions.close')}
        loading={action.isPending}
        onConfirm={() => run(id!, 'close', { onDone: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('sales.confirm.cancelOrderText')}
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
            onSuccess: () => navigate(SALES_ROUTES.order),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
