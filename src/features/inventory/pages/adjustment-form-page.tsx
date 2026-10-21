import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Info, Save, Send, Trash2, XCircle } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { applyServerErrors } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import type { AdjustmentKind, StockAdjustment } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { SelectField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAppConfig } from '@/features/settings/api/settings-api';
import { adjustmentsApi } from '../api/inventory-api';
import { DocumentLines } from '../components/document-lines';
import { DocStatusBadge } from '../components/inventory-badges';
import { PostedLines } from '../components/posted-lines';
import { RejectDialog } from '../components/reject-dialog';
import { WarehouseSelect } from '../components/warehouse-select';
import { WorkflowSteps } from '../components/workflow-steps';
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_REASONS,
  adjustmentPayload,
  adjustmentSchema,
  adjustmentToForm,
  todayIn,
  type AdjustmentValues,
  type LineValues,
} from '../schemas';

const FIXED_DIRECTION: Partial<Record<AdjustmentKind, 'in' | 'out'>> = {
  opening: 'in',
  damage: 'out',
  scrap: 'out',
};
const EDITABLE = ['draft', 'rejected'];

/** Create, edit, submit and approve a stock adjustment / opening stock / damage / scrap document. */
export default function AdjustmentFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const config = useAppConfig();
  const requireApproval = config.data?.inventory?.requireApproval ?? true;

  const doc = adjustmentsApi.useOne(isNew ? null : id);
  const save = adjustmentsApi.useSave();
  const action = adjustmentsApi.useAction();
  const remove = adjustmentsApi.useRemove();
  const [rejecting, setRejecting] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | 'approve' | null>(null);

  const initialKind = (ADJUSTMENT_KINDS as string[]).includes(params.get('kind') ?? '')
    ? (params.get('kind') as AdjustmentKind)
    : 'adjustment';
  const form = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema) as Resolver<AdjustmentValues>,
    defaultValues: {
      kind: initialKind,
      warehouseId: '',
      adjustmentDate: todayIn(timezone),
      reason: '',
      notes: '',
      items: [],
    },
  });
  const { control, reset, setValue, getValues } = form;
  const [kind, warehouseId] = useWatch({ control, name: ['kind', 'warehouseId'] });

  const loaded = doc.data;
  useEffect(() => {
    if (loaded) reset(adjustmentToForm(loaded));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt, reset]);

  // Fixed-direction kinds force the direction of every line.
  useEffect(() => {
    const dir = FIXED_DIRECTION[kind];
    if (!dir) return;
    getValues('items').forEach((l, i) => l.direction !== dir && setValue(`items.${i}.direction`, dir));
  }, [kind, getValues, setValue]);

  const status = loaded?.status ?? 'draft';
  const editable = EDITABLE.includes(status) && can(isNew ? 'inventory.create' : 'inventory.update');
  const busy = save.isPending || action.isPending;

  const persist = (values: AdjustmentValues) =>
    save.mutateAsync({ id: isNew ? undefined : id, data: adjustmentPayload(values) });

  const onError = (err: Error) => {
    if (applyServerErrors(err, form.setError)) toast.error(t('inventory.fixErrors'));
    else toast.error(err.message);
  };

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await persist(values);
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`/inventory/adjustments/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  const onSubmitDoc = form.handleSubmit(async (values) => {
    try {
      const saved =
        form.formState.isDirty || isNew || status === 'rejected' ? await persist(values) : loaded!;
      const result = await action.mutateAsync({ id: saved.id, action: 'submit' });
      toast.success(t(result.status === 'posted' ? 'inventory.toast.posted' : 'inventory.toast.submitted'));
      if (isNew) navigate(`/inventory/adjustments/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  const run = (name: string, body?: unknown, message?: string) =>
    action.mutate(
      { id: id!, action: name, body },
      {
        onSuccess: () => {
          toast.success(t(message ?? `inventory.toast.${name}`));
          setConfirm(null);
          setRejecting(false);
        },
        onError: (err) => {
          toast.error(err.message);
          setConfirm(null);
        },
      },
    );

  if (!isNew && doc.isPending) return <PageSkeleton />;

  const title = isNew
    ? t(`inventory.kindsNew.${kind}`)
    : `${t(`inventory.kinds.${loaded?.kind}`)} ${loaded?.number}`;
  const showPosted = loaded && (status === 'posted' || (!editable && status !== 'pending_approval'));

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={title}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <DocStatusBadge status={status} /> {loaded.warehouse?.name} ·{' '}
              {formatDate(loaded.adjustmentDate)}
            </span>
          ) : (
            t(`inventory.kindsHint.${kind}`)
          )
        }
        breadcrumbs={[
          { label: t('nav.inventory') },
          { label: t('inventory.adjustments.title'), to: '/inventory/adjustments' },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {!isNew && status === 'draft' && can('inventory.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {!isNew &&
              ['draft', 'pending_approval', 'rejected'].includes(status) &&
              can('inventory.update') && (
                <Button type="button" variant="outline" onClick={() => setConfirm('cancel')} disabled={busy}>
                  <Ban aria-hidden /> {t('inventory.actions.cancel')}
                </Button>
              )}
            {editable && (
              <>
                <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                  {save.isPending && !action.isPending ? <Spinner /> : <Save aria-hidden />}{' '}
                  {t('inventory.actions.saveDraft')}
                </Button>
                <Button type="button" onClick={onSubmitDoc} disabled={busy}>
                  {action.isPending ? <Spinner /> : <Send aria-hidden />}{' '}
                  {t(requireApproval ? 'inventory.actions.submit' : 'inventory.actions.post')}
                </Button>
              </>
            )}
            {status === 'pending_approval' && can('inventory.approve') && (
              <>
                <Button type="button" variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
                  <XCircle aria-hidden /> {t('inventory.actions.reject')}
                </Button>
                <Button type="button" onClick={() => setConfirm('approve')} disabled={busy}>
                  <CheckCircle2 aria-hidden /> {t('inventory.actions.approve')}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {editable && requireApproval && (
            <Alert>
              <Info aria-hidden />
              <AlertDescription>{t('inventory.approvalNotice')}</AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!editable || busy} className="contents">
                <FieldGroup>
                  {isNew && (
                    <FormField
                      control={control}
                      name="kind"
                      label={t('fields.type')}
                      render={({ field, id: fieldId }) => (
                        <ToggleGroup
                          id={fieldId}
                          type="single"
                          variant="outline"
                          value={field.value}
                          onValueChange={(v) => v && field.onChange(v)}
                          className="flex-wrap justify-start"
                        >
                          {ADJUSTMENT_KINDS.map((k) => (
                            <ToggleGroupItem key={k} value={k}>
                              {t(`inventory.kinds.${k}`)}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      )}
                    />
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="warehouseId"
                      label={t('inventory.warehouse')}
                      render={({ field, aria }) => (
                        <WarehouseSelect
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? '')}
                          disabled={!editable || busy}
                          {...aria}
                        />
                      )}
                    />
                    <TextField
                      control={control}
                      name="adjustmentDate"
                      type="date"
                      label={t('inventory.date')}
                    />
                  </div>
                  {kind === 'adjustment' && (
                    <SelectField
                      control={control}
                      name="reason"
                      label={t('inventory.defaultReason')}
                      description={t('inventory.defaultReasonHint')}
                      placeholder={t('inventory.pickReason')}
                      options={ADJUSTMENT_REASONS.map((r) => ({
                        value: r,
                        label: t(`inventory.reasons.${r}`),
                      }))}
                    />
                  )}
                  <TextareaField control={control} name="notes" label={t('inventory.notes')} rows={2} />
                </FieldGroup>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.items')}</CardTitle>
            </CardHeader>
            <CardContent>
              {showPosted ? (
                <PostedLines
                  items={loaded.items ?? []}
                  total={status === 'posted' ? loaded.totalValue : undefined}
                />
              ) : (
                <fieldset disabled={!editable || busy} className="contents">
                  <DocumentLines
                    form={form as unknown as UseFormReturn<{ items: LineValues[] }>}
                    warehouseId={warehouseId}
                    mode="adjustment"
                    direction={FIXED_DIRECTION[kind]}
                    readOnly={!editable}
                  />
                </fieldset>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {loaded && <AdjustmentWorkflow doc={loaded} />}
          {loaded?.status === 'posted' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('inventory.postedValue')}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {formatCurrency(loaded.totalValue)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        loading={action.isPending}
        onConfirm={(reason) => run('reject', { reason })}
      />
      <ConfirmDialog
        open={confirm === 'approve'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('inventory.confirm.approveTitle')}
        description={t('inventory.confirm.approveText')}
        confirmLabel={t('inventory.actions.approve')}
        loading={action.isPending}
        onConfirm={() => run('approve')}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('inventory.confirm.cancelTitle')}
        description={t('inventory.confirm.cancelText')}
        confirmLabel={t('inventory.actions.cancel')}
        loading={action.isPending}
        onConfirm={() => run('cancel')}
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
            onSuccess: () => {
              toast.success(t('inventory.toast.deleted'));
              navigate('/inventory/adjustments');
            },
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}

function AdjustmentWorkflow({ doc }: { doc: StockAdjustment }) {
  return (
    <WorkflowSteps
      steps={['draft', 'pending_approval', 'posted']}
      status={doc.status}
      rejectionReason={doc.rejectionReason}
      trail={[
        { action: 'created', user: doc.creator, at: doc.createdAt },
        { action: 'submitted', user: doc.submitter, at: doc.submittedAt },
        { action: 'rejected', user: doc.rejecter, at: doc.rejectedAt },
        { action: 'approved', user: doc.approver, at: doc.approvedAt },
        { action: 'cancelled', user: doc.canceller, at: doc.cancelledAt },
      ]}
    />
  );
}
