import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, PackageCheck, Receipt, Save, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
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
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { useRunAction } from '@/features/purchase/components/form-helpers';
import { RelatedDocuments, TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { challansApi } from '../api/sales-api';
import { SalesLines } from '../components/sales-lines';
import { SalesStatusBadge } from '../components/sales-ui';
import { SALES_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { lineFromSaved, linePayload, salesLinesSchema, type SalesLinesForm } from '../schemas';

const schema = z.object({
  customerId: v.required(),
  warehouseId: v.required(),
  orderId: z.string(),
  challanDate: v.required(),
  shippingAddress: z.string().max(500, 'validation.tooLong'),
  vehicleNo: z.string().max(50, 'validation.tooLong'),
  driverName: z.string().max(100, 'validation.tooLong'),
  notes: z.string().max(2000, 'validation.tooLong'),
  items: salesLinesSchema,
});
type Values = z.infer<typeof schema>;

/** Delivery challan: goods leave the warehouse when it is posted (partial deliveries of an order). */
export default function ChallanFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const doc = challansApi.useOne(isNew ? null : id);
  const save = challansApi.useSave();
  const action = challansApi.useAction();
  const remove = challansApi.useRemove();
  const run = useRunAction(action, 'sales');
  const [confirm, setConfirm] = useState<'post' | 'cancel' | 'delete' | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      customerId: '',
      warehouseId: '',
      orderId: '',
      challanDate: todayIn(timezone),
      shippingAddress: '',
      vehicleNo: '',
      driverName: '',
      notes: '',
      items: [],
    },
  });
  const [customerId, warehouseId, orderId] = useWatch({
    control: form.control,
    name: ['customerId', 'warehouseId', 'orderId'],
  });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(['sales.create', 'sales.update']);
  const lineForm = form as unknown as UseFormReturn<SalesLinesForm>;
  const linked = Boolean(orderId);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      customerId: loaded.customerId,
      warehouseId: loaded.warehouseId,
      orderId: loaded.orderId ?? '',
      challanDate: loaded.challanDate,
      shippingAddress: loaded.shippingAddress ?? '',
      vehicleNo: loaded.vehicleNo ?? '',
      driverName: loaded.driverName ?? '',
      notes: loaded.notes ?? '',
      items: (loaded.items ?? []).map((l) =>
        lineFromSaved(l, {
          info: l.orderItem
            ? t('sales.challans.orderedInfo', {
                ordered: formatQuantity(l.orderItem.baseQuantity),
                delivered: formatQuantity(l.orderItem.deliveredBaseQuantity),
                unit: l.product.baseUnit?.code ?? '',
              })
            : '',
        }),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    customerId: values.customerId,
    warehouseId: values.warehouseId,
    orderId: values.orderId || null,
    challanDate: values.challanDate,
    shippingAddress: nullIfEmpty(values.shippingAddress),
    vehicleNo: nullIfEmpty(values.vehicleNo),
    driverName: nullIfEmpty(values.driverName),
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) => linePayload(l, { stock: true })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);
  const persist = (values: Values) => save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${SALES_ROUTES.challan}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onPost = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'post' });
      toast.success(t('sales.toast.delivered'));
      setConfirm(null);
      if (isNew) navigate(`${SALES_ROUTES.challan}/${saved.id}`, { replace: true });
    } catch (err) {
      setConfirm(null);
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const uninvoiced =
    loaded?.status === 'posted' && !(loaded.invoices ?? []).some((i) => i.status !== 'cancelled');

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('sales.challans.new') : `${t('sales.challans.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStatusBadge status={status} /> {loaded.customer.name} · {formatDate(loaded.challanDate)} ·{' '}
              {loaded.warehouse.name}
            </span>
          ) : (
            t('sales.challans.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.challans.title'), to: SALES_ROUTES.challan },
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
                <Button
                  type="button"
                  onClick={async () =>
                    (await form.trigger()) ? setConfirm('post') : toast.error(t('inventory.fixErrors'))
                  }
                  disabled={busy}
                >
                  <PackageCheck aria-hidden /> {t('sales.challans.post')}
                </Button>
              </>
            )}
            {loaded && uninvoiced && can('sales.create') && (
              <Button
                type="button"
                onClick={() => run(id!, 'convert-to-invoice', { goTo: SALES_ROUTES.invoice })}
                disabled={busy}
              >
                <Receipt aria-hidden /> {t('sales.convert.toInvoice')}
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
                          disabled={!editable || busy || linked}
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
                          disabled={!editable || busy || linked}
                          {...aria}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextField
                      control={form.control}
                      name="challanDate"
                      type="date"
                      label={t('purchase.date')}
                    />
                    <TextField
                      control={form.control}
                      name="vehicleNo"
                      label={t('sales.challans.vehicleNo')}
                    />
                    <TextField
                      control={form.control}
                      name="driverName"
                      label={t('sales.challans.driverName')}
                    />
                  </div>
                  <TextField
                    control={form.control}
                    name="shippingAddress"
                    label={t('sales.shippingAddress')}
                  />
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
                  priced={false}
                  stock
                  customerId={customerId}
                  warehouseId={warehouseId}
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
          {loaded && status === 'posted' && can('inventory.view') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('sales.challans.cost')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(loaded.costTotal)}</span>
                <p className="text-muted-foreground">{t('sales.challans.costHint')}</p>
              </CardContent>
            </Card>
          )}
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('sales.orders.entity'),
                  route: SALES_ROUTES.order,
                  docs: loaded.order ? [loaded.order] : [],
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
                { label: t('sales.trail.delivered'), user: loaded.poster, at: loaded.postedAt },
              ]}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'post'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('sales.confirm.postChallanTitle')}
        description={t('sales.confirm.postChallanText')}
        confirmLabel={t('sales.challans.post')}
        loading={busy}
        onConfirm={onPost}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('sales.confirm.cancelChallanText')}
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
            onSuccess: () => navigate(SALES_ROUTES.challan),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
