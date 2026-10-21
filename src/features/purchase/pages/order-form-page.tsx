import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, CheckCircle2, FileText, Lock, PackageCheck, Save, Send, Trash2, XCircle } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
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
import { RejectDialog } from '@/features/inventory/components/reject-dialog';
import { ordersApi, usePurchaseLookups } from '../api/purchase-api';
import { useLinesTotals, useRunAction } from '../components/form-helpers';
import { OrderPrintActions } from '../components/order-print-actions';
import { PurchaseLines } from '../components/purchase-lines';
import {
  ApprovalPanel,
  PurchaseStatusBadge,
  RelatedDocuments,
  TotalsCard,
  TrailCard,
} from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { linePayload, lineFromSaved, linesSchema, type PurchaseLineValues } from '../schemas';

const schema = z.object({
  supplierId: v.required(),
  warehouseId: v.required(),
  orderDate: v.required(),
  expectedDate: z.string(),
  paymentTermsDays: z.string().regex(/^\d{0,3}$/, 'validation.integer'),
  supplierReference: z.string().max(100, 'validation.tooLong'),
  notes: z.string().max(2000, 'validation.tooLong'),
  terms: z.string().max(5000, 'validation.tooLong'),
  items: linesSchema,
});
type Values = z.infer<typeof schema>;

/** Create, approve, receive and bill a purchase order. */
export default function OrderFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = usePurchaseLookups();
  const doc = ordersApi.useOne(isNew ? null : id);
  const save = ordersApi.useSave();
  const action = ordersApi.useAction();
  const remove = ordersApi.useRemove();
  const run = useRunAction(action);
  const [rejecting, setRejecting] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'close' | 'delete' | null>(null);
  const [pickedSupplier, setSupplierLabel] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      supplierId: '',
      warehouseId: '',
      orderDate: todayIn(timezone),
      expectedDate: '',
      paymentTermsDays: '',
      supplierReference: '',
      notes: '',
      terms: '',
      items: [],
    },
  });
  const [watchedWarehouseId] = useWatch({ control: form.control, name: ['warehouseId'] });
  const loaded = doc.data;
  const supplierLabel =
    pickedSupplier ?? (loaded ? `${loaded.supplier.name} (${loaded.supplier.code})` : null);
  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'purchase.create' : 'purchase.update');
  const lineForm = form as unknown as UseFormReturn<{ items: PurchaseLineValues[] }>;
  const calc = useLinesTotals(lineForm.control, editable);

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      supplierId: loaded.supplierId,
      warehouseId: loaded.warehouseId,
      orderDate: loaded.orderDate,
      expectedDate: loaded.expectedDate ?? '',
      paymentTermsDays: String(loaded.paymentTermsDays ?? ''),
      supplierReference: loaded.supplierReference ?? '',
      notes: loaded.notes ?? '',
      terms: loaded.terms ?? '',
      items: (loaded.items ?? []).map((l) =>
        lineFromSaved(l, {
          info:
            status === 'draft'
              ? ''
              : t('purchase.orders.lineProgress', {
                  received: formatQuantity(l.receivedBaseQuantity),
                  billed: formatQuantity(l.billedBaseQuantity),
                  ordered: formatQuantity(l.baseQuantity),
                  unit: l.product.baseUnit?.code ?? '',
                }),
        }),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    supplierId: values.supplierId,
    warehouseId: values.warehouseId,
    orderDate: values.orderDate,
    expectedDate: nullIfEmpty(values.expectedDate),
    paymentTermsDays: values.paymentTermsDays === '' ? undefined : Number(values.paymentTermsDays),
    supplierReference: nullIfEmpty(values.supplierReference),
    notes: nullIfEmpty(values.notes),
    terms: nullIfEmpty(values.terms),
    items: values.items.map((l) => linePayload(l, { price: true })),
  });

  const onError = (err: Error) => {
    if (applyServerErrors(err, form.setError)) toast.error(t('inventory.fixErrors'));
    else toast.error(err.message);
  };

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${DOC_ROUTES.order}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  const onSubmitDoc = form.handleSubmit(async (values) => {
    try {
      const saved =
        form.formState.isDirty || isNew
          ? await save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) })
          : loaded!;
      const result = await action.mutateAsync({ id: saved.id, action: 'submit' });
      toast.success(
        t(result.status === 'approved' ? 'purchase.toast.autoApproved' : 'purchase.toast.submit'),
      );
      if (isNew) navigate(`${DOC_ROUTES.order}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;
  const hasUnbilled = (loaded?.items ?? []).some((l) => Number(l.unbilledBaseQuantity) > 0);
  const receivable = ['approved', 'partially_received'].includes(status);
  const roles = lookups.data?.roles ?? [];

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('purchase.orders.new') : `${t('purchase.orders.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={status} /> {loaded.supplier.name} · {formatDate(loaded.orderDate)}
              {loaded.emailedAt && (
                <span className="text-xs">
                  · {t('purchase.orders.emailedAt', { at: formatDateTime(loaded.emailedAt) })}
                </span>
              )}
            </span>
          ) : (
            t('purchase.orders.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.orders.title'), to: DOC_ROUTES.order },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {loaded &&
              !['draft', 'pending_approval', 'cancelled'].includes(status) &&
              can('purchase.print') && (
                <OrderPrintActions
                  orderId={loaded.id}
                  number={loaded.number}
                  supplierEmail={loaded.supplier.email}
                  canEmail
                />
              )}
            {loaded && status === 'draft' && can('purchase.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {loaded &&
              ['draft', 'pending_approval', 'approved'].includes(status) &&
              can('purchase.update') && (
                <Button type="button" variant="outline" onClick={() => setConfirm('cancel')} disabled={busy}>
                  <Ban aria-hidden /> {t('purchase.actions.cancel')}
                </Button>
              )}
            {loaded &&
              ['approved', 'partially_received', 'received', 'billed'].includes(status) &&
              can('purchase.update') && (
                <Button type="button" variant="outline" onClick={() => setConfirm('close')} disabled={busy}>
                  <Lock aria-hidden /> {t('purchase.actions.close')}
                </Button>
              )}
            {editable && (
              <>
                <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                  {save.isPending && !action.isPending ? <Spinner /> : <Save aria-hidden />}{' '}
                  {t('inventory.actions.saveDraft')}
                </Button>
                <Button type="button" onClick={onSubmitDoc} disabled={busy}>
                  {action.isPending ? <Spinner /> : <Send aria-hidden />} {t('purchase.actions.submit')}
                </Button>
              </>
            )}
            {status === 'pending_approval' && can('purchase.approve') && (
              <>
                <Button type="button" variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                  <XCircle aria-hidden /> {t('inventory.actions.reject')}
                </Button>
                <Button type="button" onClick={() => run(id!, 'approve')} disabled={busy}>
                  <CheckCircle2 aria-hidden />{' '}
                  {t('purchase.actions.approveLevel', { level: loaded?.nextApprovalLevel?.name ?? '' })}
                </Button>
              </>
            )}
            {loaded && hasUnbilled && can('purchase.create') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => run(id!, 'convert-to-bill', { goTo: DOC_ROUTES.bill })}
                disabled={busy}
              >
                <FileText aria-hidden /> {t('purchase.convert.toBill')}
              </Button>
            )}
            {receivable && can('purchase.create') && (
              <Button
                type="button"
                onClick={() => run(id!, 'convert-to-receipt', { goTo: DOC_ROUTES.receipt })}
                disabled={busy}
              >
                <PackageCheck aria-hidden /> {t('purchase.convert.toReceipt')}
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
                          disabled={!editable || busy}
                          onChange={(sid, s) => {
                            field.onChange(sid);
                            setSupplierLabel(`${s.name} (${s.code})`);
                            if (!form.getValues('paymentTermsDays') && s.paymentTermsDays)
                              form.setValue('paymentTermsDays', String(s.paymentTermsDays));
                          }}
                          {...aria}
                        />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="warehouseId"
                      label={t('purchase.deliverTo')}
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
                      label={t('purchase.orderDate')}
                    />
                    <TextField
                      control={form.control}
                      name="expectedDate"
                      type="date"
                      label={t('purchase.expectedDate')}
                    />
                    <TextField
                      control={form.control}
                      name="paymentTermsDays"
                      inputMode="numeric"
                      label={t('purchase.paymentTerms')}
                      description={t('purchase.paymentTermsHint')}
                    />
                  </div>
                  <TextField
                    control={form.control}
                    name="supplierReference"
                    label={t('purchase.supplierReference')}
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
                <PurchaseLines
                  form={lineForm}
                  mode="priced"
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
                <FieldGroup>
                  <TextareaField control={form.control} name="notes" label={t('inventory.notes')} rows={2} />
                  <TextareaField
                    control={form.control}
                    name="terms"
                    label={t('purchase.terms')}
                    rows={3}
                    description={t('purchase.termsHint')}
                  />
                </FieldGroup>
              </fieldset>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <TotalsCard
            totals={editable ? calc.data?.totals : loaded}
            taxes={editable ? calc.data?.totals.taxes : undefined}
            loading={calc.isFetching}
          />
          {loaded && (
            <ApprovalPanel
              plan={loaded.approvalPlan ?? []}
              level={loaded.approvalLevel}
              status={status}
              history={loaded.approvals ?? []}
              roles={roles}
              rejectionReason={loaded.rejectionReason}
            />
          )}
          {loaded && (
            <RelatedDocuments
              groups={[
                {
                  label: t('purchase.requisitions.entity'),
                  route: DOC_ROUTES.requisition,
                  docs: loaded.requisition ? [loaded.requisition] : [],
                },
                {
                  label: t('purchase.rfqs.entity'),
                  route: DOC_ROUTES.rfq,
                  docs: loaded.rfq ? [loaded.rfq] : [],
                },
                {
                  label: t('purchase.receipts.title'),
                  route: DOC_ROUTES.receipt,
                  docs: loaded.receipts ?? [],
                },
                { label: t('purchase.bills.title'), route: DOC_ROUTES.bill, docs: loaded.bills ?? [] },
              ]}
            />
          )}
          {loaded && (
            <TrailCard
              entries={[
                { label: t('inventory.trail.created'), user: loaded.creator, at: loaded.createdAt },
                { label: t('inventory.trail.submitted'), user: loaded.submitter, at: loaded.submittedAt },
                { label: t('purchase.trail.approved'), at: loaded.approvedAt },
                { label: t('purchase.trail.closed'), user: loaded.closer, at: loaded.closedAt },
                { label: t('inventory.trail.cancelled'), user: loaded.canceller, at: loaded.cancelledAt },
              ]}
            />
          )}
        </div>
      </div>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        loading={action.isPending}
        onConfirm={(reason) => run(id!, 'reject', { body: { reason }, onDone: () => setRejecting(false) })}
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
        open={confirm === 'close'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('purchase.confirm.closeTitle')}
        description={t('purchase.confirm.closeText')}
        confirmLabel={t('purchase.actions.close')}
        loading={action.isPending}
        onConfirm={() => run(id!, 'close', { onDone: () => setConfirm(null) })}
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
          remove.mutate(id!, { onSuccess: () => navigate(DOC_ROUTES.order), onError: () => setConfirm(null) })
        }
      />
    </form>
  );
}
