import { useEffect, useState } from 'react';
import { useForm, useWatch, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowRight, Ban, PackageCheck, Save, Trash2, Truck } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { applyServerErrors } from '@/lib/form';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { StockTransfer } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { transfersApi, useTransferDestinations } from '../api/inventory-api';
import { DocumentLines } from '../components/document-lines';
import { DocStatusBadge } from '../components/inventory-badges';
import { PostedLines } from '../components/posted-lines';
import { WarehouseSelect } from '../components/warehouse-select';
import { WorkflowSteps } from '../components/workflow-steps';
import {
  todayIn,
  transferPayload,
  transferSchema,
  transferToForm,
  type LineValues,
  type TransferValues,
} from '../schemas';

type Confirm = 'dispatch' | 'receive' | 'cancel' | 'delete';

/** Create a transfer, dispatch it from the source and receive it at the destination. */
export default function TransferFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const myBranches = useAuthStore((s) => s.user?.branches ?? []);
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin ?? false);

  const doc = transfersApi.useOne(isNew ? null : id);
  const save = transfersApi.useSave();
  const action = transfersApi.useAction();
  const remove = transfersApi.useRemove();
  const destinations = useTransferDestinations(can(['inventory.create', 'inventory.update']));
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const form = useForm<TransferValues>({
    resolver: zodResolver(transferSchema) as Resolver<TransferValues>,
    defaultValues: {
      fromWarehouseId: '',
      toWarehouseId: '',
      transferDate: todayIn(timezone),
      notes: '',
      items: [],
    },
  });
  const { control, reset } = form;
  const [fromWarehouseId] = useWatch({ control, name: ['fromWarehouseId'] });

  const loaded = doc.data;
  useEffect(() => {
    if (loaded) reset(transferToForm(loaded));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt, reset]);

  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'inventory.create' : 'inventory.update');
  const busy = save.isPending || action.isPending;
  const inBranch = (branchId?: string) => isSuperAdmin || myBranches.some((b) => b.id === branchId);
  const canReceive = status === 'in_transit' && can('inventory.update') && inBranch(loaded?.toBranchId);
  const canCancel =
    !isNew &&
    can('inventory.update') &&
    inBranch(loaded?.branchId) &&
    (status === 'draft' || (status === 'in_transit' && can('inventory.approve')));

  const onError = (err: Error) => {
    if (applyServerErrors(err, form.setError)) toast.error(t('inventory.fixErrors'));
    else toast.error(err.message);
  };

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: isNew ? undefined : id, data: transferPayload(values) });
      toast.success(t('inventory.savedDraft'));
      if (isNew) navigate(`/inventory/transfers/${saved.id}`, { replace: true });
    } catch (err) {
      onError(err as Error);
    }
  });

  /** Save (if needed) and dispatch. */
  const onDispatch = form.handleSubmit(async (values) => {
    try {
      const saved =
        form.formState.isDirty || isNew
          ? await save.mutateAsync({ id: isNew ? undefined : id, data: transferPayload(values) })
          : loaded!;
      await action.mutateAsync({ id: saved.id, action: 'dispatch' });
      toast.success(t('inventory.toast.dispatched'));
      setConfirm(null);
      if (isNew) navigate(`/inventory/transfers/${saved.id}`, { replace: true });
    } catch (err) {
      setConfirm(null);
      onError(err as Error);
    }
  });

  const run = (name: 'receive' | 'cancel') =>
    action.mutate(
      { id: id!, action: name },
      {
        onSuccess: () => {
          toast.success(t(name === 'receive' ? 'inventory.toast.received' : 'inventory.toast.cancel'));
          setConfirm(null);
        },
        onError: (err) => {
          toast.error(err.message);
          setConfirm(null);
        },
      },
    );

  if (!isNew && doc.isPending) return <PageSkeleton />;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('inventory.transfers.new') : `${t('inventory.transfers.entity')} ${loaded?.number}`}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <DocStatusBadge status={status} />
              <span className="inline-flex items-center gap-1">
                {loaded.fromWarehouse?.name} <ArrowRight className="size-3.5" aria-hidden />{' '}
                {loaded.toWarehouse?.name}
              </span>
              · {formatDate(loaded.transferDate)}
            </span>
          ) : (
            t('inventory.transfers.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.inventory') },
          { label: t('inventory.transfers.title'), to: '/inventory/transfers' },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <>
            {!isNew && status === 'draft' && can('inventory.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {canCancel && (
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
                <Button
                  type="button"
                  onClick={async () =>
                    (await form.trigger()) ? setConfirm('dispatch') : toast.error(t('inventory.fixErrors'))
                  }
                  disabled={busy}
                >
                  <Truck aria-hidden /> {t('inventory.actions.dispatch')}
                </Button>
              </>
            )}
            {canReceive && (
              <Button type="button" onClick={() => setConfirm('receive')} disabled={busy}>
                <PackageCheck aria-hidden /> {t('inventory.actions.receive')}
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
                      control={control}
                      name="fromWarehouseId"
                      label={t('inventory.transfers.from')}
                      render={({ field, aria }) => (
                        <WarehouseSelect
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? '')}
                          disabled={!editable || busy}
                          {...aria}
                        />
                      )}
                    />
                    <FormField
                      control={control}
                      name="toWarehouseId"
                      label={t('inventory.transfers.to')}
                      render={({ field, aria }) => (
                        <WarehouseSelect
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? '')}
                          warehouses={
                            destinations.data ??
                            (loaded
                              ? [
                                  {
                                    ...loaded.toWarehouse,
                                    branch: loaded.toBranch ?? { id: loaded.toBranchId, name: '', code: '' },
                                  },
                                ]
                              : [])
                          }
                          exclude={fromWarehouseId}
                          disabled={!editable || busy}
                          {...aria}
                        />
                      )}
                    />
                  </div>
                  <TextField
                    control={control}
                    name="transferDate"
                    type="date"
                    label={t('inventory.date')}
                    className="sm:max-w-[calc(50%-0.5rem)]"
                  />
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
              {loaded && status !== 'draft' ? (
                <PostedLines
                  items={loaded.items ?? []}
                  total={status !== 'cancelled' || loaded.dispatchedAt ? loaded.totalValue : undefined}
                />
              ) : (
                <fieldset disabled={!editable || busy} className="contents">
                  <DocumentLines
                    form={form as unknown as UseFormReturn<{ items: LineValues[] }>}
                    warehouseId={fromWarehouseId}
                    mode="transfer"
                    direction="out"
                    readOnly={!editable}
                  />
                </fieldset>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {loaded && <TransferWorkflow doc={loaded} />}
          {loaded && status !== 'draft' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('inventory.transfers.valueMoved')}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {formatCurrency(loaded.totalValue)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'dispatch'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('inventory.confirm.dispatchTitle')}
        description={t('inventory.confirm.dispatchText')}
        confirmLabel={t('inventory.actions.dispatch')}
        loading={busy}
        onConfirm={onDispatch}
      />
      <ConfirmDialog
        open={confirm === 'receive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('inventory.confirm.receiveTitle')}
        description={t('inventory.confirm.receiveText', { warehouse: loaded?.toWarehouse?.name })}
        confirmLabel={t('inventory.actions.receive')}
        loading={action.isPending}
        onConfirm={() => run('receive')}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={t('inventory.confirm.cancelTitle')}
        description={t(
          status === 'in_transit' ? 'inventory.confirm.cancelTransitText' : 'inventory.confirm.cancelText',
        )}
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
              navigate('/inventory/transfers');
            },
            onError: () => setConfirm(null),
          })
        }
      />
    </form>
  );
}

function TransferWorkflow({ doc }: { doc: StockTransfer }) {
  return (
    <WorkflowSteps
      steps={['draft', 'in_transit', 'received']}
      status={doc.status}
      trail={[
        { action: 'created', user: doc.creator, at: doc.createdAt },
        { action: 'dispatched', user: doc.dispatcher, at: doc.dispatchedAt },
        { action: 'received', user: doc.receiver, at: doc.receivedAt },
        { action: 'cancelled', user: doc.canceller, at: doc.cancelledAt },
      ]}
    />
  );
}
