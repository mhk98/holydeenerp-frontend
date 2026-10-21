import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, CheckCircle2, FileMinus, Repeat, Save, Trash2, Undo2, Wallet } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { useRunAction } from '@/features/purchase/components/form-helpers';
import { RelatedDocuments, TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { invoicesApi, useSalesLookups } from '../api/sales-api';
import { InvoiceActions } from '../components/invoice-actions';
import { RecurringDialog } from '../components/recurring-dialog';
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
  warehouseId: z.string(),
  orderId: z.string(),
  challanId: z.string(),
  invoiceDate: v.required(),
  dueDate: z.string(),
  customerReference: z.string().max(100, 'validation.tooLong'),
  notes: z.string().max(2000, 'validation.tooLong'),
  terms: z.string().max(5000, 'validation.tooLong'),
  discountType: z.enum(['percent', 'amount']),
  discountValue: z.string().regex(/^(\d+(\.\d{1,4})?)?$/, 'validation.decimal'),
  items: salesLinesSchema,
});
type Values = z.infer<typeof schema>;

export default function InvoiceFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = useSalesLookups();
  const doc = invoicesApi.useOne(isNew ? null : id);
  const save = invoicesApi.useSave();
  const action = invoicesApi.useAction();
  const remove = invoicesApi.useRemove();
  const run = useRunAction(action, 'sales');
  const credit = useCreditOverride();
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [dialog, setDialog] = useState<'recurring' | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      customerId: '',
      warehouseId: '',
      orderId: '',
      challanId: '',
      invoiceDate: todayIn(timezone),
      dueDate: '',
      customerReference: '',
      notes: '',
      terms: '',
      discountType: 'percent',
      discountValue: '',
      items: [],
    },
  });
  const [customerId, warehouseId, orderId, challanId, items] = useWatch({
    control: form.control,
    name: ['customerId', 'warehouseId', 'orderId', 'challanId', 'items'],
  });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'sales.create' : 'sales.update');
  const lineForm = form as unknown as UseFormReturn<SalesLinesForm>;
  const calc = useSalesTotals(lineForm.control, editable);
  const linked = Boolean(orderId || challanId);
  const directLines = (items ?? []).some((l) => !l.challanItemId);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      customerId: loaded.customerId,
      warehouseId: loaded.warehouseId ?? '',
      orderId: loaded.orderId ?? '',
      challanId: loaded.challanId ?? '',
      invoiceDate: loaded.invoiceDate,
      dueDate: loaded.dueDate ?? '',
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
    warehouseId: values.warehouseId || null,
    orderId: values.orderId || null,
    challanId: values.challanId || null,
    invoiceDate: values.invoiceDate,
    dueDate: nullIfEmpty(values.dueDate),
    customerReference: nullIfEmpty(values.customerReference),
    notes: nullIfEmpty(values.notes),
    terms: nullIfEmpty(values.terms),
    discountType: values.discountType,
    discountValue: values.discountValue || '0',
    items: values.items.map((l) => linePayload(l, { price: true, stock: true })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);
  const persist = (values: Values) => save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${SALES_ROUTES.invoice}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onPost = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      const openSaved = () => isNew && navigate(`${SALES_ROUTES.invoice}/${saved.id}`, { replace: true });
      const done = await credit.run(async (body) => {
        await action.mutateAsync({ id: saved.id, action: 'post', body });
        toast.success(t('sales.toast.post'));
      }, openSaved);
      if (!done) toast.warning(t('sales.credit.needsOverride'));
    } catch (err) {
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const open = ['unpaid', 'partially_paid'].includes(status);
  const posted = ['unpaid', 'partially_paid', 'paid'].includes(status);
  const overdue = open && loaded && loaded.dueDate < todayIn(timezone);
  const cancellable =
    loaded && (status === 'draft' || (status === 'unpaid' && Number(loaded.paidAmount) === 0));

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('sales.invoices.new') : `${t('sales.invoices.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStatusBadge status={status} /> {loaded.customer.name} · {formatDate(loaded.invoiceDate)} ·{' '}
              <span className={overdue ? 'font-medium text-destructive' : undefined}>
                {t('purchase.bills.due', { date: formatDate(loaded.dueDate) })}
              </span>
              {loaded.recurringId && (
                <Badge variant="outline" className="gap-1">
                  <Repeat className="size-3" aria-hidden /> {t('sales.recurring.badge')}
                </Badge>
              )}
            </span>
          ) : (
            t('sales.invoices.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.invoices.title'), to: SALES_ROUTES.invoice },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('sales.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {cancellable && can('sales.approve') && (
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
                <Button type="button" onClick={onPost} disabled={busy}>
                  <CheckCircle2 aria-hidden /> {t('sales.invoices.post')}
                </Button>
              </>
            )}
            {loaded && posted && (
              <InvoiceActions
                invoiceId={loaded.id}
                number={loaded.number}
                customerEmail={loaded.customer.email}
                canEmail={can('sales.print')}
                canRemind={open && can('sales.update')}
              />
            )}
            {loaded && posted && can('sales.create') && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    run(id!, 'convert-to-return', { body: { type: 'return' }, goTo: SALES_ROUTES.return })
                  }
                  disabled={busy}
                >
                  <Undo2 aria-hidden /> {t('sales.convert.toReturn')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    run(id!, 'convert-to-return', {
                      body: { type: 'credit_note' },
                      goTo: SALES_ROUTES.return,
                    })
                  }
                  disabled={busy}
                >
                  <FileMinus aria-hidden /> {t('sales.convert.toCreditNote')}
                </Button>
                {!loaded.recurringId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialog('recurring')}
                    disabled={busy}
                  >
                    <Repeat aria-hidden /> {t('sales.recurring.make')}
                  </Button>
                )}
              </>
            )}
            {loaded && open && can(['sales.create', 'accounting.create']) && (
              <Button type="button" asChild>
                <Link
                  to={`${SALES_ROUTES.receipt}/new?customerId=${loaded.customerId}&invoiceId=${loaded.id}`}
                >
                  <Wallet aria-hidden /> {t('sales.convert.toReceipt')}
                </Link>
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
                      description={t('sales.invoices.warehouseHint')}
                      render={({ field, aria }) => (
                        <WarehouseSelect
                          value={field.value || null}
                          onChange={(w) => field.onChange(w ?? '')}
                          disabled={!editable || busy || !directLines}
                          {...aria}
                        />
                      )}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <TextField
                      control={form.control}
                      name="invoiceDate"
                      type="date"
                      label={t('purchase.date')}
                    />
                    <TextField
                      control={form.control}
                      name="dueDate"
                      type="date"
                      label={t('purchase.dueDate')}
                      description={t('sales.invoices.dueHint')}
                    />
                    <TextField
                      control={form.control}
                      name="customerReference"
                      label={t('sales.customerReference')}
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
                  stock={editable && Boolean(warehouseId)}
                  customerId={customerId}
                  warehouseId={warehouseId || null}
                  taxGroups={lookups.data?.taxGroups}
                  calc={editable ? calc.data : undefined}
                  readOnly={!editable}
                  allowAdd={!challanId}
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
            extra={
              loaded && posted
                ? [
                    { label: t('purchase.bills.paid'), value: formatCurrency(loaded.paidAmount) },
                    { label: t('purchase.balance'), value: formatCurrency(loaded.balance), strong: true },
                  ]
                : undefined
            }
          />
          <CreditOverridesCard entries={loaded?.creditOverrides} />
          {loaded && Boolean(loaded.allocations?.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('purchase.bills.settlements')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {loaded.allocations!.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <Link
                        to={`${a.sourceType === 'receipt' ? SALES_ROUTES.receipt : SALES_ROUTES.return}/${a.sourceId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {a.sourceNumber}
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatDate(a.sourceDate)}</span>
                      <span className="tabular-nums">{formatCurrency(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {loaded && Boolean(loaded.reminders?.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('sales.remind.history')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-xs">
                  {loaded.reminders!.map((r) => (
                    <li key={r.id} className="flex flex-col">
                      <span>
                        <span
                          className={r.status === 'failed' ? 'font-medium text-destructive' : 'font-medium'}
                        >
                          {t(`sales.remind.kinds.${r.kind}`, { days: r.offsetDays ?? 0 })}
                        </span>{' '}
                        · {formatDateTime(r.createdAt)}
                      </span>
                      <span className="text-muted-foreground">{r.error ?? r.sentTo}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('sales.quotations.entity'),
                  route: SALES_ROUTES.quotation,
                  docs: loaded.quotation ? [loaded.quotation] : [],
                },
                {
                  label: t('sales.orders.entity'),
                  route: SALES_ROUTES.order,
                  docs: loaded.order ? [loaded.order] : [],
                },
                {
                  label: t('sales.challans.entity'),
                  route: SALES_ROUTES.challan,
                  docs: loaded.challan ? [loaded.challan] : [],
                },
                { label: t('sales.returns.title'), route: SALES_ROUTES.return, docs: loaded.returns ?? [] },
              ]}
            />
          )}
          {loaded && (
            <TrailCard
              entries={[
                { label: t('inventory.trail.created'), user: loaded.creator, at: loaded.createdAt },
                { label: t('purchase.trail.posted'), user: loaded.poster, at: loaded.postedAt },
                { label: t('sales.trail.emailed'), at: loaded.emailedAt },
                { label: t('sales.trail.reminded'), at: loaded.lastReminderAt },
              ]}
            />
          )}
        </div>
      </div>

      {credit.dialog.open && <CreditOverrideDialog {...credit.dialog} />}
      {dialog === 'recurring' && loaded && (
        <RecurringDialog
          invoiceId={loaded.id}
          defaultName={`${loaded.customer.name} — ${loaded.number}`}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('sales.confirm.cancelInvoiceText')}
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
            onSuccess: () => navigate(SALES_ROUTES.invoice),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
