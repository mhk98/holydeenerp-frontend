import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, CheckCircle2, FileMinus, Save, Trash2, Wallet } from 'lucide-react';
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
import { billsApi, usePurchaseLookups } from '../api/purchase-api';
import { useLinesTotals, useRunAction } from '../components/form-helpers';
import { PurchaseLines } from '../components/purchase-lines';
import { PurchaseStatusBadge, RelatedDocuments, TotalsCard, TrailCard } from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { linePayload, lineFromSaved, linesSchema, type PurchaseLineValues } from '../schemas';

const schema = z.object({
  supplierId: v.required(),
  orderId: z.string(),
  receiptId: z.string(),
  supplierInvoiceNo: z.string().max(100, 'validation.tooLong'),
  billDate: v.required(),
  dueDate: z.string(),
  notes: z.string().max(2000, 'validation.tooLong'),
  items: linesSchema,
});
type Values = z.infer<typeof schema>;

export default function BillFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = usePurchaseLookups();
  const doc = billsApi.useOne(isNew ? null : id);
  const save = billsApi.useSave();
  const action = billsApi.useAction();
  const remove = billsApi.useRemove();
  const run = useRunAction(action);
  const [confirm, setConfirm] = useState<'post' | 'cancel' | 'delete' | null>(null);
  const [pickedSupplier, setSupplierLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      supplierId: '',
      orderId: '',
      receiptId: '',
      supplierInvoiceNo: '',
      billDate: todayIn(timezone),
      dueDate: '',
      notes: '',
      items: [],
    },
  });
  const [watchedOrderId, watchedReceiptId] = useWatch({
    control: form.control,
    name: ['orderId', 'receiptId'],
  });
  const loaded = doc.data;
  const supplierLabel =
    pickedSupplier ?? (loaded ? `${loaded.supplier.name} (${loaded.supplier.code})` : null);
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'purchase.create' : 'purchase.update');
  const lineForm = form as unknown as UseFormReturn<{ items: PurchaseLineValues[] }>;
  const calc = useLinesTotals(lineForm.control, editable);
  const linked = Boolean(watchedOrderId || watchedReceiptId);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      supplierId: loaded.supplierId,
      orderId: loaded.orderId ?? '',
      receiptId: loaded.receiptId ?? '',
      supplierInvoiceNo: loaded.supplierInvoiceNo ?? '',
      billDate: loaded.billDate,
      dueDate: loaded.dueDate,
      notes: loaded.notes ?? '',
      items: (loaded.items ?? []).map((l) => lineFromSaved(l)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    supplierId: values.supplierId,
    orderId: values.orderId || null,
    receiptId: values.receiptId || null,
    supplierInvoiceNo: nullIfEmpty(values.supplierInvoiceNo),
    billDate: values.billDate,
    dueDate: nullIfEmpty(values.dueDate),
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) => linePayload(l, { price: true })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);
  const persist = (values: Values) => save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${DOC_ROUTES.bill}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onPost = form.handleSubmit(async (values) => {
    try {
      const saved = form.formState.isDirty || isNew ? await persist(values) : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'post' });
      toast.success(t('purchase.toast.billPosted'));
      setConfirm(null);
      if (isNew) navigate(`${DOC_ROUTES.bill}/${saved.id}`, { replace: true });
    } catch (err) {
      setConfirm(null);
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const open = ['unpaid', 'partially_paid'].includes(status);
  const overdue = open && loaded && loaded.dueDate < todayIn(timezone);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('purchase.bills.new') : `${t('purchase.bills.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={status} /> {loaded.supplier.name} · {formatDate(loaded.billDate)} ·{' '}
              <span className={overdue ? 'font-medium text-destructive' : undefined}>
                {t('purchase.bills.due', { date: formatDate(loaded.dueDate) })}
              </span>
            </span>
          ) : (
            t('purchase.bills.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.bills.title'), to: DOC_ROUTES.bill },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded && status === 'draft' && can('purchase.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded &&
              ['draft', 'unpaid'].includes(status) &&
              can('purchase.approve') &&
              Number(loaded.paidAmount) === 0 && (
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
                  <CheckCircle2 aria-hidden /> {t('purchase.bills.post')}
                </Button>
              </>
            )}
            {loaded && ['unpaid', 'partially_paid', 'paid'].includes(status) && can('purchase.create') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => run(id!, 'convert-to-debit-note', { goTo: DOC_ROUTES.return })}
                disabled={busy}
              >
                <FileMinus aria-hidden /> {t('purchase.convert.toDebitNote')}
              </Button>
            )}
            {loaded && open && can(['purchase.create', 'accounting.create']) && (
              <Button type="button" asChild>
                <Link to={`${DOC_ROUTES.payment}/new?supplierId=${loaded.supplierId}&billId=${loaded.id}`}>
                  <Wallet aria-hidden /> {t('purchase.convert.toPayment')}
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
                    <TextField
                      control={form.control}
                      name="supplierInvoiceNo"
                      label={t('purchase.supplierInvoiceNo')}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      control={form.control}
                      name="billDate"
                      type="date"
                      label={t('purchase.bills.date')}
                    />
                    <TextField
                      control={form.control}
                      name="dueDate"
                      type="date"
                      label={t('purchase.dueDate')}
                      description={t('purchase.bills.dueHint')}
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
                <PurchaseLines
                  form={lineForm}
                  mode="priced"
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
          <TotalsCard
            totals={editable ? calc.data?.totals : loaded}
            taxes={editable ? calc.data?.totals.taxes : undefined}
            loading={calc.isFetching}
            extra={
              loaded && status !== 'draft'
                ? [
                    { label: t('purchase.bills.paid'), value: formatCurrency(loaded.paidAmount) },
                    { label: t('purchase.balance'), value: formatCurrency(loaded.balance), strong: true },
                  ]
                : undefined
            }
          />
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
                        to={`${a.sourceType === 'payment' ? DOC_ROUTES.payment : DOC_ROUTES.return}/${a.sourceId}`}
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
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('purchase.orders.entity'),
                  route: DOC_ROUTES.order,
                  docs: loaded.order ? [loaded.order] : [],
                },
                {
                  label: t('purchase.receipts.entity'),
                  route: DOC_ROUTES.receipt,
                  docs: loaded.receipt ? [loaded.receipt] : [],
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
        title={t('purchase.confirm.postBillTitle')}
        description={t('purchase.confirm.postBillText', {
          qty: formatQuantity((loaded?.items ?? []).length),
        })}
        confirmLabel={t('purchase.bills.post')}
        loading={busy}
        onConfirm={onPost}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('purchase.confirm.cancelTitle')}
        description={t('purchase.confirm.cancelBillText')}
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
          remove.mutate(id!, { onSuccess: () => navigate(DOC_ROUTES.bill), onError: () => setConfirm(null) })
        }
      />
    </form>
  );
}
