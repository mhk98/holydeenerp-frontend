import { useEffect, type ReactNode } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { formatDate, formatQuantity } from '@/lib/format';
import { v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import { FormField } from '@/components/common/form-field';
import { SelectField, TextField } from '@/components/common/fields';
import { Button } from '@/components/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useBatches } from '@/features/inventory/api/inventory-api';
import { todayIn } from '@/features/inventory/schemas';
import { minutesLabel, productLabel } from '../lib';
import type { ManufacturingOrder, MoMaterial, MoOperation } from '../types';

interface StepProps<B> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mo: ManufacturingOrder;
  loading: boolean;
  onConfirm: (body: B) => void;
}

/** A dialog hosting one workflow step's form (Zod-validated, submit disabled while pending). */
function StepDialog<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  form,
  loading,
  submitLabel,
  onSubmit,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  form: UseFormReturn<T>;
  loading: boolean;
  submitLabel: string;
  onSubmit: (values: T) => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className={wide ? 'sm:max-w-2xl' : undefined}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <fieldset disabled={loading} className="contents">
            <FieldGroup>{children}</FieldGroup>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner />} {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** useForm reset to fresh defaults each time the dialog opens. */
function useStepForm<T extends FieldValues>(
  schema: z.ZodType<T>,
  open: boolean,
  defaults: () => DefaultValues<T>,
) {
  const form = useForm<T>({
    resolver: zodResolver(schema as never) as Resolver<T>,
    defaultValues: defaults(),
  });
  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);
  return form;
}

const today = () => todayIn(useSettingsStore.getState().timezone);
const net = (m: MoMaterial) => Number(m.issuedQuantity) - Number(m.returnedQuantity);
const fmt = (n: number) => String(Math.max(0, Math.round(n * 10000) / 10000));

// ── Issue / return materials ──────────────────────────────────────────────

const materialsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  lines: z.array(
    z.object({
      materialId: z.string(),
      quantity: v.decimal({ scale: 4, allowZero: true }),
      batchId: z.string(),
      lot: z.boolean(),
    }),
  ),
});
type MaterialsValues = z.infer<typeof materialsSchema>;

function BatchSelect({
  material,
  warehouseId,
  value,
  onChange,
}: {
  material: MoMaterial;
  warehouseId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const batches = useBatches({ productId: material.productId, variantId: material.variantId, warehouseId });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40" aria-label={t('manufacturing.batch')}>
        <SelectValue placeholder={t('manufacturing.batch')} />
      </SelectTrigger>
      <SelectContent>
        {(batches.data ?? []).map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.batchNo}
            {b.expiryDate ? ` · ${formatDate(b.expiryDate)}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Issue materials to production (prefilled with what is still to issue; lot-tracked items are picked
 * FEFO) or return unused ones (choose the batch for lot-tracked items).
 */
export function MaterialsDialog({
  mode,
  ...props
}: StepProps<{ date: string; lines: { materialId: string; quantity: string; batchId?: string | null }[] }> & {
  mode: 'issue' | 'return';
}) {
  const { t } = useTranslation();
  const { open, onOpenChange, mo, loading, onConfirm } = props;
  const materials = mo.materials ?? [];
  const form = useStepForm<MaterialsValues>(materialsSchema, open, () => ({
    date: today(),
    lines: materials.map((m) => ({
      materialId: m.id,
      quantity: mode === 'issue' ? fmt(Number(m.requiredQuantity) - net(m)) : '0',
      batchId: '',
      lot: Boolean(m.product?.trackBatch || m.product?.trackExpiry),
    })),
  }));
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const values = useWatch({ control: form.control, name: 'lines' });

  return (
    <StepDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      form={form}
      loading={loading}
      title={t(`manufacturing.dialogs.${mode}Title`)}
      description={t(`manufacturing.dialogs.${mode}Text`, { warehouse: mo.rawWarehouse?.name ?? '' })}
      submitLabel={t(`manufacturing.actions.${mode}`)}
      onSubmit={(v) =>
        onConfirm({
          date: v.date,
          lines: v.lines
            .filter((l) => Number(l.quantity) > 0)
            .map((l) => ({ materialId: l.materialId, quantity: l.quantity, batchId: l.batchId || null })),
        })
      }
    >
      <TextField
        control={form.control}
        name="date"
        type="date"
        label={t('manufacturing.date')}
        className="max-w-48"
      />
      <div className="max-h-[50vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manufacturing.product')}</TableHead>
              <TableHead className="text-right">
                {t(mode === 'issue' ? 'manufacturing.orders.toIssue' : 'manufacturing.orders.outNow')}
              </TableHead>
              <TableHead className="w-32 text-right">{t('manufacturing.quantity')}</TableHead>
              {mode === 'return' && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.fields.map((f, i) => {
              const m = materials[i];
              const left = mode === 'issue' ? Number(m.requiredQuantity) - net(m) : net(m);
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{productLabel(m.product, m.variant)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQuantity(fmt(left))}</TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`lines.${i}.quantity`}
                      render={({ field, aria }) => (
                        <Input {...field} {...aria} inputMode="decimal" className="text-right" />
                      )}
                    />
                  </TableCell>
                  {mode === 'return' && (
                    <TableCell>
                      {values?.[i]?.lot && Number(values[i].quantity) > 0 && (
                        <BatchSelect
                          material={m}
                          warehouseId={mo.rawWarehouseId}
                          value={values[i].batchId}
                          onChange={(id) => form.setValue(`lines.${i}.batchId`, id)}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </StepDialog>
  );
}

// ── Finish an operation ───────────────────────────────────────────────────

const finishSchema = z.object({ actualMinutes: v.decimal({ scale: 2, allowZero: true }) });

export function FinishOperationDialog({
  operation,
  onOpenChange,
  loading,
  onConfirm,
}: {
  operation: MoOperation | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (op: MoOperation, body: { actualMinutes: string }) => void;
}) {
  const { t } = useTranslation();
  const form = useStepForm(finishSchema, Boolean(operation), () => ({
    actualMinutes: operation ? String(Number(operation.plannedMinutes)) : '0',
  }));
  return (
    <StepDialog
      open={Boolean(operation)}
      onOpenChange={onOpenChange}
      form={form}
      loading={loading}
      title={t('manufacturing.dialogs.finishTitle', { name: operation?.name ?? '' })}
      description={t('manufacturing.dialogs.finishText', {
        planned: operation ? minutesLabel(operation.plannedMinutes) : '',
      })}
      submitLabel={t('manufacturing.actions.finishOp')}
      onSubmit={(v) => operation && onConfirm(operation, v)}
    >
      <TextField
        control={form.control}
        name="actualMinutes"
        inputMode="decimal"
        label={t('manufacturing.dialogs.actualMinutes')}
      />
    </StepDialog>
  );
}

// ── Production done → quality check ───────────────────────────────────────

const submitSchema = z.object({ producedQuantity: v.decimal({ scale: 4 }) });

export function SubmitDialog({
  open,
  onOpenChange,
  mo,
  loading,
  onConfirm,
}: StepProps<{ producedQuantity: string }>) {
  const { t } = useTranslation();
  const form = useStepForm(submitSchema, open, () => ({
    producedQuantity: String(Number(mo.quantity)),
  }));
  return (
    <StepDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      loading={loading}
      title={t('manufacturing.dialogs.submitTitle')}
      description={t('manufacturing.dialogs.submitText', { quantity: formatQuantity(mo.quantity) })}
      submitLabel={t('manufacturing.actions.submit')}
      onSubmit={onConfirm}
    >
      <TextField
        control={form.control}
        name="producedQuantity"
        inputMode="decimal"
        label={t('manufacturing.orders.produced')}
      />
    </StepDialog>
  );
}

// ── Quality check ─────────────────────────────────────────────────────────

const qualitySchema = z
  .object({
    name: v.required().max(150, 'validation.tooLong'),
    result: z.enum(['pass', 'fail']),
    failedQuantity: v.decimal({ scale: 4, allowZero: true }),
    action: z.enum(['scrap', 'rework']),
    reason: z.string().max(500, 'validation.tooLong'),
  })
  .refine((q) => q.result === 'pass' || Number(q.failedQuantity) > 0, {
    path: ['failedQuantity'],
    message: 'validation.positive',
  });
type QualityValues = z.infer<typeof qualitySchema>;

export function QualityDialog({
  open,
  onOpenChange,
  mo,
  loading,
  onConfirm,
}: StepProps<{
  name: string;
  result: 'pass' | 'fail';
  failedQuantity?: string;
  action?: string;
  reason: string | null;
}>) {
  const { t } = useTranslation();
  const done = new Set((mo.qualityChecks ?? []).map((q) => q.name));
  const pending = (mo.checkpoints ?? []).filter((c) => !done.has(c.name));
  const form = useStepForm<QualityValues>(qualitySchema, open, () => ({
    name: pending[0]?.name ?? mo.checkpoints?.[0]?.name ?? '',
    result: 'pass',
    failedQuantity: '0',
    action: 'scrap',
    reason: '',
  }));
  const result = useWatch({ control: form.control, name: 'result' });
  const left = Number(mo.producedQuantity) - Number(mo.scrappedQuantity);

  return (
    <StepDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      loading={loading}
      title={t('manufacturing.dialogs.qualityTitle')}
      description={t('manufacturing.dialogs.qualityText', { quantity: formatQuantity(fmt(left)) })}
      submitLabel={t('manufacturing.actions.record')}
      onSubmit={(q) =>
        onConfirm(
          q.result === 'pass'
            ? { name: q.name, result: 'pass', reason: v.nullIfEmpty(q.reason) }
            : { ...q, reason: v.nullIfEmpty(q.reason) },
        )
      }
    >
      {(mo.checkpoints?.length ?? 0) > 0 ? (
        <SelectField
          control={form.control}
          name="name"
          label={t('manufacturing.dialogs.checkpoint')}
          options={(mo.checkpoints ?? []).map((c) => ({ value: c.name, label: c.name }))}
        />
      ) : (
        <TextField control={form.control} name="name" label={t('manufacturing.dialogs.checkpoint')} />
      )}
      <FormField
        control={form.control}
        name="result"
        label={t('manufacturing.dialogs.result')}
        render={({ field, id }) => (
          <ToggleGroup
            id={id}
            type="single"
            variant="outline"
            value={field.value}
            onValueChange={(value) => value && field.onChange(value)}
            className="justify-start"
          >
            <ToggleGroupItem value="pass">{t('manufacturing.qcResult.pass')}</ToggleGroupItem>
            <ToggleGroupItem value="fail">{t('manufacturing.qcResult.fail')}</ToggleGroupItem>
          </ToggleGroup>
        )}
      />
      {result === 'fail' && (
        <>
          <TextField
            control={form.control}
            name="failedQuantity"
            inputMode="decimal"
            label={t('manufacturing.dialogs.failedQuantity')}
          />
          <SelectField
            control={form.control}
            name="action"
            label={t('manufacturing.dialogs.failAction')}
            description={t('manufacturing.dialogs.failActionHint')}
            options={(['scrap', 'rework'] as const).map((a) => ({
              value: a,
              label: t(`manufacturing.qcAction.${a}`),
            }))}
          />
        </>
      )}
      <TextField control={form.control} name="reason" label={t('manufacturing.dialogs.remarks')} />
    </StepDialog>
  );
}

// ── Scrap / wastage ───────────────────────────────────────────────────────

const scrapSchema = z.object({
  product: v.required(),
  quantity: v.decimal({ scale: 4 }),
  reason: v.required().max(255, 'validation.tooLong'),
});

export function ScrapDialog({
  open,
  onOpenChange,
  mo,
  loading,
  onConfirm,
}: StepProps<{ productId: string; variantId: string | null; quantity: string; reason: string }>) {
  const { t } = useTranslation();
  const key = (p: string, vId: string | null) => `${p}:${vId ?? ''}`;
  const options = [
    {
      value: key(mo.productId, mo.variantId),
      label: `${productLabel(mo.product, mo.variant)} (${t('manufacturing.orders.output')})`,
    },
    ...(mo.materials ?? []).map((m) => ({
      value: key(m.productId, m.variantId),
      label: productLabel(m.product, m.variant),
    })),
  ];
  const form = useStepForm(scrapSchema, open, () => ({
    product: options[1]?.value ?? options[0].value,
    quantity: '1',
    reason: '',
  }));
  return (
    <StepDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      loading={loading}
      title={t('manufacturing.dialogs.scrapTitle')}
      description={t('manufacturing.dialogs.scrapText')}
      submitLabel={t('manufacturing.actions.record')}
      onSubmit={(s) => {
        const [productId, variantId] = s.product.split(':');
        onConfirm({ productId, variantId: variantId || null, quantity: s.quantity, reason: s.reason });
      }}
    >
      <SelectField
        control={form.control}
        name="product"
        label={t('manufacturing.product')}
        options={options}
      />
      <TextField
        control={form.control}
        name="quantity"
        inputMode="decimal"
        label={t('manufacturing.quantity')}
      />
      <TextField control={form.control} name="reason" label={t('manufacturing.dialogs.reason')} />
    </StepDialog>
  );
}

// ── Complete: receive finished goods ──────────────────────────────────────

const completeSchema = z.object({
  outputDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  batchNo: z.string().max(60, 'validation.tooLong'),
  expiryDate: z.string(),
});

export function CompleteDialog({
  open,
  onOpenChange,
  mo,
  loading,
  onConfirm,
}: StepProps<{ outputDate: string; batchNo: string | null; expiryDate: string | null }>) {
  const { t } = useTranslation();
  const lot = Boolean(mo.product?.trackBatch || mo.product?.trackExpiry);
  const form = useStepForm(completeSchema, open, () => ({
    outputDate: today(),
    batchNo: mo.number,
    expiryDate: '',
  }));
  const good = Number(mo.producedQuantity) - Number(mo.scrappedQuantity);
  return (
    <StepDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      loading={loading}
      title={t('manufacturing.dialogs.completeTitle')}
      description={t('manufacturing.dialogs.completeText', {
        quantity: formatQuantity(fmt(good)),
        warehouse: mo.finishedWarehouse?.name ?? '',
      })}
      submitLabel={t('manufacturing.actions.complete')}
      onSubmit={(c) =>
        onConfirm({
          outputDate: c.outputDate,
          batchNo: lot ? v.nullIfEmpty(c.batchNo) : null,
          expiryDate: lot && c.expiryDate ? c.expiryDate : null,
        })
      }
    >
      <TextField control={form.control} name="outputDate" type="date" label={t('manufacturing.date')} />
      {lot && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="batchNo" label={t('manufacturing.batch')} />
          {mo.product?.trackExpiry && (
            <TextField
              control={form.control}
              name="expiryDate"
              type="date"
              label={t('manufacturing.expiry')}
            />
          )}
        </div>
      )}
    </StepDialog>
  );
}
