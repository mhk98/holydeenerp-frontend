import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, CheckCircle2, FileQuestion, Save, Send, ShoppingCart, Trash2, X, XCircle } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate, formatQuantity } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import type { PurchaseOrder, PurchaseRfq } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Spinner } from '@/components/ui/spinner';
import { RejectDialog } from '@/features/inventory/components/reject-dialog';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { requisitionsApi } from '../api/purchase-api';
import { useRunAction } from '../components/form-helpers';
import { PurchaseLines } from '../components/purchase-lines';
import { PurchaseStatusBadge, TrailCard } from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, nullIfEmpty, todayIn } from '../lib';
import { linePayload, lineFromSaved, linesSchema, type PurchaseLineValues } from '../schemas';

const schema = z.object({
  warehouseId: z.string(),
  requisitionDate: v.required(),
  requiredBy: z.string(),
  notes: z.string().max(2000, 'validation.tooLong'),
  items: linesSchema,
});
type Values = z.infer<typeof schema>;

/** Convert dialog: one supplier → PO, or several → RFQ. */
function ConvertDialog({
  mode,
  requisitionId,
  warehouseId,
  onClose,
}: {
  mode: 'order' | 'rfq';
  requisitionId: string;
  warehouseId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const action = requisitionsApi.useAction<PurchaseOrder | PurchaseRfq>();
  const [supplier, setSupplier] = useState<string | null>(null);
  const [many, setMany] = useState<{ id: string; name: string }[]>([]);
  const [warehouse, setWarehouse] = useState<string | null>(warehouseId);
  const [deadline, setDeadline] = useState('');

  const convert = () =>
    action.mutate(
      mode === 'order'
        ? {
            id: requisitionId,
            action: 'convert-to-order',
            body: { supplierId: supplier, ...(warehouse && { warehouseId: warehouse }) },
          }
        : {
            id: requisitionId,
            action: 'convert-to-rfq',
            body: { supplierIds: many.map((s) => s.id), quoteDeadline: deadline || null },
          },
      {
        onSuccess: (doc) => {
          toast.success(
            t(mode === 'order' ? 'purchase.toast.orderCreated' : 'purchase.toast.rfqCreated', {
              number: doc.number,
            }),
          );
          navigate(`${mode === 'order' ? DOC_ROUTES.order : DOC_ROUTES.rfq}/${doc.id}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <Dialog open onOpenChange={(o) => !o && !action.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(mode === 'order' ? 'purchase.convert.toOrder' : 'purchase.convert.toRfq')}
          </DialogTitle>
          <DialogDescription>
            {t(mode === 'order' ? 'purchase.convert.toOrderHint' : 'purchase.convert.toRfqHint')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {mode === 'order' ? (
            <>
              <div className="flex flex-col gap-2">
                <Label>{t('purchase.supplier')}</Label>
                <SupplierSelect value={supplier} onChange={(id) => setSupplier(id)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('purchase.deliverTo')}</Label>
                <WarehouseSelect value={warehouse} onChange={setWarehouse} />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label>{t('purchase.rfqs.suppliers')}</Label>
                <SupplierSelect
                  value={null}
                  onChange={(id, s) =>
                    !many.some((x) => x.id === id) && setMany([...many, { id, name: s.name }])
                  }
                />
                <div className="flex flex-wrap gap-1.5">
                  {many.map((s) => (
                    <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                      {s.name}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                        aria-label={`${t('common.remove')} ${s.name}`}
                        onClick={() => setMany(many.filter((x) => x.id !== s.id))}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rfq-deadline">{t('purchase.quoteDeadline')}</Label>
                <Input
                  id="rfq-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={action.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={convert}
            disabled={action.isPending || (mode === 'order' ? !supplier || !warehouse : !many.length)}
          >
            {action.isPending && <Spinner />} {t('purchase.convert.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RequisitionFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const doc = requisitionsApi.useOne(isNew ? null : id);
  const save = requisitionsApi.useSave();
  const action = requisitionsApi.useAction();
  const remove = requisitionsApi.useRemove();
  const run = useRunAction(action);
  const [rejecting, setRejecting] = useState(false);
  const [converting, setConverting] = useState<'order' | 'rfq' | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      warehouseId: '',
      requisitionDate: todayIn(timezone),
      requiredBy: '',
      notes: '',
      items: [],
    },
  });
  const [watchedWarehouseId] = useWatch({ control: form.control, name: ['warehouseId'] });
  const loaded = doc.data;
  const status = loaded?.status ?? 'draft';
  const editable =
    ['draft', 'rejected'].includes(status) && can(isNew ? 'purchase.create' : 'purchase.update');

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      warehouseId: loaded.warehouseId ?? '',
      requisitionDate: loaded.requisitionDate,
      requiredBy: loaded.requiredBy ?? '',
      notes: loaded.notes ?? '',
      items: (loaded.items ?? []).map((l) =>
        lineFromSaved(l, {
          info: ['approved', 'ordered'].includes(loaded.status)
            ? t('purchase.requisitions.lineProgress', {
                ordered: formatQuantity(l.orderedBaseQuantity),
                requested: formatQuantity(l.baseQuantity),
                unit: l.product.baseUnit?.code ?? '',
              })
            : '',
        }),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const payload = (values: Values) => ({
    warehouseId: values.warehouseId || null,
    requisitionDate: values.requisitionDate,
    requiredBy: nullIfEmpty(values.requiredBy),
    notes: nullIfEmpty(values.notes),
    items: values.items.map((l) => linePayload(l, { estimate: true })),
  });
  const onError = (err: Error) =>
    applyServerErrors(err, form.setError) ? toast.error(t('inventory.fixErrors')) : toast.error(err.message);

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) });
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`${DOC_ROUTES.requisition}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });
  const onSubmitDoc = form.handleSubmit(async (values) => {
    try {
      const saved =
        form.formState.isDirty || isNew || status === 'rejected'
          ? await save.mutateAsync({ id: isNew ? undefined : id, data: payload(values) })
          : loaded!;
      const result = await action.mutateAsync({ id: saved.id, action: 'submit' });
      toast.success(
        t(result.status === 'approved' ? 'purchase.toast.autoApproved' : 'purchase.toast.submit'),
      );
      if (isNew) navigate(`${DOC_ROUTES.requisition}/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const busy = save.isPending || action.isPending;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={
          isNew ? t('purchase.requisitions.new') : `${t('purchase.requisitions.entity')} ${loaded?.number}`
        }
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <PurchaseStatusBadge status={status} /> {formatDate(loaded.requisitionDate)}
              {loaded.requiredBy &&
                ` · ${t('purchase.requiredByDate', { date: formatDate(loaded.requiredBy) })}`}
            </span>
          ) : (
            t('purchase.requisitions.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.requisitions.title'), to: DOC_ROUTES.requisition },
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
              ['draft', 'pending_approval', 'rejected', 'approved'].includes(status) &&
              can('purchase.update') && (
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
                  <CheckCircle2 aria-hidden /> {t('purchase.actions.approve')}
                </Button>
              </>
            )}
            {status === 'approved' && can('purchase.create') && (
              <>
                <Button type="button" variant="outline" onClick={() => setConverting('rfq')} disabled={busy}>
                  <FileQuestion aria-hidden /> {t('purchase.convert.toRfq')}
                </Button>
                <Button type="button" onClick={() => setConverting('order')} disabled={busy}>
                  <ShoppingCart aria-hidden /> {t('purchase.convert.toOrder')}
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
                  <div className="grid gap-4 sm:grid-cols-3">
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
                    <TextField
                      control={form.control}
                      name="requisitionDate"
                      type="date"
                      label={t('purchase.date')}
                    />
                    <TextField
                      control={form.control}
                      name="requiredBy"
                      type="date"
                      label={t('purchase.requiredBy')}
                    />
                  </div>
                  <TextareaField
                    control={form.control}
                    name="notes"
                    label={t('purchase.requisitions.purpose')}
                    rows={2}
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
                  form={form as unknown as UseFormReturn<{ items: PurchaseLineValues[] }>}
                  mode="requisition"
                  warehouseId={watchedWarehouseId || null}
                  readOnly={!editable}
                />
              </fieldset>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          {loaded?.rejectionReason && status === 'rejected' && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive">{t('inventory.rejectedBecause')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{loaded.rejectionReason}</CardContent>
            </Card>
          )}
          {loaded && (
            <TrailCard
              entries={[
                { label: t('inventory.trail.created'), user: loaded.creator, at: loaded.createdAt },
                { label: t('inventory.trail.submitted'), user: loaded.submitter, at: loaded.submittedAt },
                { label: t('inventory.trail.rejected'), user: loaded.rejecter, at: loaded.rejectedAt },
                { label: t('purchase.trail.approved'), user: loaded.approver, at: loaded.approvedAt },
                { label: t('inventory.trail.cancelled'), user: loaded.canceller, at: loaded.cancelledAt },
              ]}
            />
          )}
        </div>
      </div>

      {converting && loaded && (
        <ConvertDialog
          mode={converting}
          requisitionId={loaded.id}
          warehouseId={loaded.warehouseId}
          onClose={() => setConverting(null)}
        />
      )}
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
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('inventory.confirm.deleteTitle')}
        description={t('inventory.confirm.deleteText')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(id!, {
            onSuccess: () => navigate(DOC_ROUTES.requisition),
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}
