import { Fragment } from 'react';
import { useFieldArray, useWatch, type Control, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StockItem } from '@/types';
import { ChipsInput } from '@/components/common/chips-input';
import { FormField } from '@/components/common/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBatches } from '../api/inventory-api';
import { ADJUSTMENT_REASONS, lineFromItem, type LineValues } from '../schemas';
import { itemLabel } from '../lib';
import { ItemPicker } from './item-picker';

const NEW_BATCH = '__new__';

/** Form shape shared by adjustment and transfer forms. */
interface LinesForm {
  items: LineValues[];
}

interface Props {
  form: UseFormReturn<LinesForm>;
  warehouseId: string | null | undefined;
  /** adjustment: cost/reason columns; transfer: stock-out only. */
  mode: 'adjustment' | 'transfer';
  /** Fixed direction (opening = in, damage/scrap/transfer = out); undefined = per line. */
  direction?: 'in' | 'out';
  readOnly?: boolean;
}

function BatchCell({
  control,
  index,
  line,
  warehouseId,
  readOnly,
}: {
  control: Control<LinesForm>;
  index: number;
  line: LineValues;
  warehouseId?: string | null;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const out = line.direction === 'out';
  const batches = useBatches({
    productId: line.productId,
    variantId: line.variantId,
    warehouseId: warehouseId ?? undefined,
    available: out,
  });
  const isNew = !out && !line.batchId;
  const name = (n: keyof LineValues) => `items.${index}.${n}` as FieldPath<LinesForm>;

  return (
    <div className="flex min-w-48 flex-col gap-2">
      <FormField
        control={control}
        name={name('batchId')}
        render={({ field, aria }) => (
          <Select
            value={field.value ? String(field.value) : isNew ? NEW_BATCH : ''}
            onValueChange={(value) => field.onChange(value === NEW_BATCH ? '' : value)}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full" {...aria} aria-label={t('inventory.batch')}>
              <SelectValue placeholder={t('inventory.pickBatch')} />
            </SelectTrigger>
            <SelectContent>
              {!out && <SelectItem value={NEW_BATCH}>{t('inventory.newBatch')}</SelectItem>}
              {!out && Boolean(batches.data?.length) && <SelectSeparator />}
              {(batches.data ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="font-mono">{b.batchNo}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.expiryDate ? `· ${formatDate(b.expiryDate)}` : ''} · {formatQuantity(b.quantity)}
                  </span>
                </SelectItem>
              ))}
              {out && !batches.isPending && !batches.data?.length && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('inventory.noBatches')}</div>
              )}
            </SelectContent>
          </Select>
        )}
      />
      {isNew && (
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={control}
            name={name('batchNo')}
            render={({ field, aria }) => (
              <Input
                {...field}
                value={String(field.value ?? '')}
                {...aria}
                readOnly={readOnly}
                className="font-mono"
                placeholder={t('inventory.batchNo')}
                aria-label={t('inventory.batchNo')}
              />
            )}
          />
          <FormField
            control={control}
            name={name('expiryDate')}
            render={({ field, aria }) => (
              <Input
                type="date"
                {...field}
                value={String(field.value ?? '')}
                {...aria}
                readOnly={readOnly}
                aria-label={t('inventory.expiryDate')}
                title={t('inventory.expiryDate')}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Lines of an adjustment or transfer. Quantities can be entered in any unit of the item;
 * the server converts them to the base unit.
 */
export function DocumentLines({ form, warehouseId, mode, direction, readOnly }: Props) {
  const { t } = useTranslation();
  const { control, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items', keyName: 'fieldKey' });
  const lines = useWatch({ control, name: 'items' }) ?? [];
  const perLineDirection = mode === 'adjustment' && !direction;
  const showCost = mode === 'adjustment' && lines.some((l) => l.direction === 'in');
  const showReason = mode === 'adjustment';
  const showBatch = lines.some((l) => l.lotTracked);
  const rootError = form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message;
  const name = (i: number, n: keyof LineValues) => `items.${i}.${n}` as FieldPath<LinesForm>;

  const onPick = (item: StockItem) => {
    const dir = direction ?? 'in';
    // Scanning the same plain item again adds one more instead of a new line.
    const existing = lines.findIndex(
      (l) => l.key === item.key && !l.lotTracked && !l.trackSerial && l.direction === dir,
    );
    if (existing >= 0) {
      setValue(name(existing, 'quantity'), String(Number(lines[existing].quantity || 0) + 1), {
        shouldDirty: true,
      });
      toast.success(t('inventory.picker.incremented', { name: itemLabel(item) }));
      return;
    }
    append(lineFromItem(item, dir));
  };

  const colSpan =
    4 + (perLineDirection ? 1 : 0) + (showBatch ? 1 : 0) + (showCost ? 1 : 0) + (showReason ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && <ItemPicker warehouseId={warehouseId} onPick={onPick} disabled={!warehouseId} />}
      {!warehouseId && !readOnly && (
        <p className="text-sm text-muted-foreground">{t('inventory.pickWarehouseFirst')}</p>
      )}

      {fields.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">{t('inventory.item')}</TableHead>
                {perLineDirection && <TableHead className="min-w-28">{t('inventory.direction')}</TableHead>}
                {showBatch && <TableHead>{t('inventory.batch')}</TableHead>}
                <TableHead className="min-w-44">{t('inventory.quantity')}</TableHead>
                {showCost && <TableHead className="min-w-32">{t('inventory.unitCost')}</TableHead>}
                {showReason && <TableHead className="min-w-40">{t('inventory.reason')}</TableHead>}
                <TableHead className="min-w-40">{t('inventory.notes')}</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => {
                const line = lines[i] ?? (f as unknown as LineValues);
                const unit = line.units.find((u) => u.unitId === line.unitId);
                return (
                  <Fragment key={f.fieldKey}>
                    <TableRow className="align-top">
                      <TableCell>
                        <div className="font-medium">{itemLabel(line)}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <code className="font-mono">{line.sku}</code>
                          {line.lotTracked && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                              {t(line.trackExpiry ? 'inventory.tracking.expiry' : 'inventory.tracking.batch')}
                            </Badge>
                          )}
                          {line.trackSerial && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                              {t('inventory.tracking.serial')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {perLineDirection && (
                        <TableCell>
                          <FormField
                            control={control}
                            name={name(i, 'direction')}
                            render={({ field, aria }) => (
                              <Select
                                value={String(field.value)}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  // A stock-out takes an existing batch.
                                  if (value === 'out') setValue(name(i, 'batchNo'), '');
                                }}
                                disabled={readOnly}
                              >
                                <SelectTrigger
                                  className={cn(
                                    'w-full',
                                    field.value === 'in'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-red-700 dark:text-red-400',
                                  )}
                                  {...aria}
                                  aria-label={t('inventory.direction')}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in">{t('inventory.stockIn')}</SelectItem>
                                  <SelectItem value="out">{t('inventory.stockOut')}</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                      )}
                      {showBatch && (
                        <TableCell>
                          {line.lotTracked ? (
                            <BatchCell
                              control={control}
                              index={i}
                              line={line}
                              warehouseId={warehouseId}
                              readOnly={readOnly}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-2">
                          <FormField
                            control={control}
                            name={name(i, 'quantity')}
                            className="flex-1"
                            render={({ field, aria }) => (
                              <Input
                                {...field}
                                value={String(field.value ?? '')}
                                {...aria}
                                readOnly={readOnly}
                                inputMode="decimal"
                                className="min-w-20 tabular-nums"
                                aria-label={t('inventory.quantity')}
                              />
                            )}
                          />
                          {line.units.length > 1 ? (
                            <FormField
                              control={control}
                              name={name(i, 'unitId')}
                              render={({ field, aria }) => (
                                <Select
                                  value={String(field.value)}
                                  onValueChange={field.onChange}
                                  disabled={readOnly}
                                >
                                  <SelectTrigger className="w-24" {...aria} aria-label={t('inventory.unit')}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {line.units.map((u) => (
                                      <SelectItem key={u.unitId} value={u.unitId}>
                                        {u.code}
                                        {u.factor !== '1' && (
                                          <span className="text-xs text-muted-foreground">
                                            = {formatQuantity(u.factor)} {line.baseUnitCode}
                                          </span>
                                        )}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          ) : (
                            <span className="pt-2 text-sm text-muted-foreground">{line.baseUnitCode}</span>
                          )}
                        </div>
                        {unit && unit.factor !== '1' && Number(line.quantity) > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            = {formatQuantity(Number(line.quantity) * Number(unit.factor))}{' '}
                            {line.baseUnitCode}
                          </p>
                        )}
                      </TableCell>
                      {showCost && (
                        <TableCell>
                          {line.direction === 'in' ? (
                            <FormField
                              control={control}
                              name={name(i, 'unitCost')}
                              render={({ field, aria }) => (
                                <Input
                                  {...field}
                                  value={String(field.value ?? '')}
                                  {...aria}
                                  readOnly={readOnly}
                                  inputMode="decimal"
                                  className="tabular-nums"
                                  placeholder={
                                    line.avgCost ? formatCurrency(line.avgCost) : t('inventory.autoCost')
                                  }
                                  aria-label={t('inventory.unitCostPer', { unit: line.baseUnitCode })}
                                />
                              )}
                            />
                          ) : (
                            <span className="pt-2 text-xs text-muted-foreground">
                              {t('inventory.costAtPosting')}
                            </span>
                          )}
                        </TableCell>
                      )}
                      {showReason && (
                        <TableCell>
                          <FormField
                            control={control}
                            name={name(i, 'reason')}
                            render={({ field, aria }) => (
                              <Select
                                value={String(field.value ?? '')}
                                onValueChange={field.onChange}
                                disabled={readOnly}
                              >
                                <SelectTrigger
                                  className="w-full"
                                  {...aria}
                                  aria-label={t('inventory.reason')}
                                >
                                  <SelectValue placeholder={t('inventory.sameAsDocument')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {ADJUSTMENT_REASONS.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {t(`inventory.reasons.${r}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <FormField
                          control={control}
                          name={name(i, 'notes')}
                          render={({ field, aria }) => (
                            <Input
                              {...field}
                              value={String(field.value ?? '')}
                              {...aria}
                              readOnly={readOnly}
                              aria-label={t('inventory.notes')}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="mt-0.5"
                            onClick={() => remove(i)}
                            aria-label={t('common.remove')}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {line.trackSerial && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={colSpan}>
                          <FormField
                            control={control}
                            name={name(i, 'serialNumbers')}
                            label={t('inventory.serialNumbersFor', { name: itemLabel(line) })}
                            description={t('inventory.serialHint')}
                            render={({ field, aria }) => (
                              <ChipsInput
                                value={(field.value as string[]) ?? []}
                                onChange={field.onChange}
                                placeholder={readOnly ? undefined : t('inventory.serialPlaceholder')}
                                {...aria}
                              />
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {rootError && <p className="text-sm text-destructive">{t(rootError)}</p>}
    </div>
  );
}
