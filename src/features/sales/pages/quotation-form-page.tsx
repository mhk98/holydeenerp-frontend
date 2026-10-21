import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, Check, Receipt, Save, Send, ShoppingCart, Trash2, X } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate } from '@/lib/format';
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
import { useRunAction } from '@/features/purchase/components/form-helpers';
import { RelatedDocuments, TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { quotationsApi, useSalesLookups } from '../api/sales-api';
import { SalesLines } from '../components/sales-lines';
import { SalesStatusBadge, SalesTotalsCard } from '../components/sales-ui';
import { useSalesTotals } from '../components/use-sales-totals';
import { WarehouseDialog } from '../components/warehouse-dialog';
import { SALES_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { lineFromSaved, linePayload, salesLinesSchema, type SalesLinesForm } from '../schemas';

const schema = z.object({
  customerId: v.required(),
  quotationDate: v.required(),
  validUntil: z.string(),
  customerReference: z.string().max(100, 'validation.tooLong'),
  notes: z.string().max(2000, 'validation.tooLong'),
  terms: z.string().max(5000, 'validation.tooLong'),
  discountType: z.enum(['percent', 'amount']),
  discountValue: z.string().regex(/^(\d+(\.\d{1,4})?)?$/, 'validation.decimal'),
  items: salesLinesSchema,
});
type Values = z.infer<typeof schema>;

export default function QuotationFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = useSalesLookups();
  const doc = quotationsApi.useOne(isNew ? null : id);
  const save = quotationsApi.useSave();
  const action = quotationsApi.useAction();
  const remove = quotationsApi.useRemove();
  const run = useRunAction(action, 'sales');
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | 'decline' | null>(null);
  const [convert, setConvert] = useState<'order' | 'invoice' | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      customerId: '',
      quotationDate: todayIn(timezone),
      validUntil: '',
      customerReference: '',
      notes: '',
      terms: '',
      discountType: 'percent',
      discountValue: '',
      items: [],
    },
  });
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'sales.create' : 'sales.update');
  const lineForm = form as unknown as UseFormReturn<SalesLinesForm>;
  const calc = useSalesTotals(lineForm.control, editable);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      customerId: loaded.customerId,
      quotationDate: loaded.quotationDate,
      validUntil: loaded.validUntil ?? '',
      customerReference: loaded.customerReference ?? '',
      notes: loaded.notes ?? '',
      terms: loaded.terms ?? '',
      discountType: loaded.discountType,
      discountValue: Number(loaded.discountValue) ? String(Number(loaded.discountValue)) : '',
      items: (loaded.items ?? []).map((l) => lineFromSaved(l)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    customerId: values.customerId,
    quotationDate: values.quotationDate,
    validUntil: nullIfEmpty(values.validUntil),
    customerReference: nullIfEmpty(values.customerReference),
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
      if (isNew) navigate(`${SALES_ROUTES.quotation}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onSend = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'send' });
      toast.success(t('sales.toast.sent'));
      if (isNew) navigate(`${SALES_ROUTES.quotation}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const open = ['draft', 'sent', 'accepted'].includes(status);
  const expired = loaded?.validUntil && loaded.validUntil < todayIn(timezone) && open;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('sales.quotations.new') : `${t('sales.quotations.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStatusBadge status={status} /> {loaded.customer.name} · {formatDate(loaded.quotationDate)}
              {loaded.validUntil && (
                <span className={expired ? 'font-medium text-destructive' : undefined}>
                  · {t('sales.quotations.validUntilDate', { date: formatDate(loaded.validUntil) })}
                </span>
              )}
            </span>
          ) : (
            t('sales.quotations.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.quotations.title'), to: SALES_ROUTES.quotation },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('sales.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded && open && can('sales.update') && (
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
                <Button type="button" onClick={onSend} disabled={busy}>
                  <Send aria-hidden /> {t('sales.actions.markSent')}
                </Button>
              </>
            )}
            {loaded && status === 'sent' && can(['sales.create', 'sales.update']) && (
              <>
                <Button type="button" variant="outline" onClick={() => setConfirm('decline')} disabled={busy}>
                  <X aria-hidden /> {t('sales.actions.decline')}
                </Button>
                <Button type="button" variant="outline" onClick={() => run(id!, 'accept')} disabled={busy}>
                  <Check aria-hidden /> {t('sales.actions.accept')}
                </Button>
              </>
            )}
            {loaded && ['sent', 'accepted'].includes(status) && can('sales.create') && (
              <>
                <Button type="button" variant="outline" onClick={() => setConvert('invoice')} disabled={busy}>
                  <Receipt aria-hidden /> {t('sales.convert.toInvoice')}
                </Button>
                <Button type="button" onClick={() => setConvert('order')} disabled={busy}>
                  <ShoppingCart aria-hidden /> {t('sales.convert.toOrder')}
                </Button>
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
                          disabled={!editable || busy}
                          onChange={(cid, c) => {
                            field.onChange(cid);
                            setCustomerLabel(`${c.name} (${c.code})`);
                          }}
                          {...aria}
                        />
                      )}
                    />
                    <TextField
                      control={form.control}
                      name="customerReference"
                      label={t('sales.customerReference')}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      control={form.control}
                      name="quotationDate"
                      type="date"
                      label={t('purchase.date')}
                    />
                    <TextField
                      control={form.control}
                      name="validUntil"
                      type="date"
                      label={t('sales.validUntil')}
                      description={t('sales.quotations.validHint', {
                        days: lookups.data?.settings.quotationValidityDays ?? 15,
                      })}
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
          {loaded && (
            <RelatedDocuments
              groups={[
                { label: t('sales.orders.entity'), route: SALES_ROUTES.order, docs: loaded.orders ?? [] },
                {
                  label: t('sales.invoices.entity'),
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
                { label: t('sales.trail.sent'), at: loaded.sentAt },
              ]}
            />
          )}
        </div>
      </div>

      {convert && (
        <WarehouseDialog
          title={t(convert === 'order' ? 'sales.convert.toOrder' : 'sales.convert.toInvoice')}
          description={t('sales.convert.pickWarehouse')}
          confirmLabel={t('sales.convert.create')}
          loading={action.isPending}
          onClose={() => setConvert(null)}
          onConfirm={(warehouseId) =>
            run(id!, `convert-to-${convert}`, {
              body: { warehouseId },
              goTo: convert === 'order' ? SALES_ROUTES.order : SALES_ROUTES.invoice,
              onDone: () => setConvert(null),
            })
          }
        />
      )}
      <ConfirmDialog
        open={confirm === 'decline'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('sales.confirm.declineTitle')}
        description={t('sales.confirm.declineText')}
        confirmLabel={t('sales.actions.decline')}
        loading={action.isPending}
        onConfirm={() => run(id!, 'decline', { onDone: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('sales.confirm.cancelQuotationText')}
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
            onSuccess: () => navigate(SALES_ROUTES.quotation),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
