import { Fragment } from 'react';
import { useFieldArray, useWatch, type Control, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Lock, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import type { StockItem } from '@/types';
import { ChipsInput } from '@/components/common/chips-input';
import { FormField } from '@/components/common/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBatches } from '@/features/inventory/api/inventory-api';
import { ItemPicker } from '@/features/inventory/components/item-picker';
import type { CalculatedTotals } from '../api/purchase-api';
import { lineFromItem, type PurchaseLineValues } from '../schemas';

/**
 * requisition  quantity + estimated price
 * priced       price, discount, tax (orders, bills, debit notes)
 * receipt      quantity, price (locked when from a PO), batch no. + expiry, serials
 * return       priced + existing batch + serials (goods leave stock)
 */
export type LinesMode = 'requisition' | 'priced' | 'receipt' | 'return';

interface LinesForm {
  items: PurchaseLineValues[];
}

interface Props {
  form: UseFormReturn<LinesForm>;
  mode: LinesMode;
  warehouseId?: string | null;
  taxGroups?: { id: string; name: string; rate: string }[];
  calc?: CalculatedTotals;
  readOnly?: boolean;
  /** Lines may only come from the source document (e.g. a GRN against a PO). */
  allowAdd?: boolean;
}

const NONE = '__none__';
const label = (l: PurchaseLineValues) => (l.variantName ? `${l.name} — ${l.variantName}` : l.name);

/** Pick an available batch of the line's item (goods leaving stock). */
export function ExistingBatch({
  control,
  index,
  line,
  warehouseId,
  readOnly,
  available = true,
}: {
  control: Control<LinesForm>;
  index: number;
  line: Pick<PurchaseLineValues, 'productId' | 'variantId'>;
  /** Only batches with stock (goods leaving); false lists sold-out batches too (goods coming back). */
  available?: boolean;
  warehouseId?: string | null;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const batches = useBatches({
    productId: line.productId,
    variantId: line.variantId,
    warehouseId: warehouseId ?? undefined,
    ...(available && { available: true }),
  });
  return (
    <FormField
      control={control}
      name={`items.${index}.batchId` as FieldPath<LinesForm>}
      render={({ field, aria }) => (
        <Select value={String(field.value ?? '')} onValueChange={field.onChange} disabled={readOnly}>
          <SelectTrigger className="w-full min-w-40" {...aria} aria-label={t('inventory.batch')}>
            <SelectValue placeholder={t('inventory.pickBatch')} />
          </SelectTrigger>
          <SelectContent>
            {(batches.data ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <span className="font-mono">{b.batchNo}</span>
                <span className="text-xs text-muted-foreground">
                  {b.expiryDate ? `· ${formatDate(b.expiryDate)}` : ''} · {formatQuantity(b.quantity)}
                </span>
              </SelectItem>
            ))}
            {!batches.isPending && !batches.data?.length && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('inventory.noBatches')}</div>
            )}
          </SelectContent>
        </Select>
      )}
    />
  );
}

export function PurchaseLines({
  form,
  mode,
  warehouseId,
  taxGroups = [],
  calc,
  readOnly,
  allowAdd = true,
}: Props) {
  const { t } = useTranslation();
  const { control, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items', keyName: 'fieldKey' });
  const lines = useWatch({ control, name: 'items' }) ?? [];
  const priced = mode === 'priced' || mode === 'return';
  const showBatch = (mode === 'receipt' || mode === 'return') && lines.some((l) => l.lotTracked);
  const showSerials = mode === 'receipt' || mode === 'return';
  const rootError = form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message;
  const name = (i: number, n: keyof PurchaseLineValues) => `items.${i}.${n}` as FieldPath<LinesForm>;
  // item + quantity + price + actions, plus the optional columns
  const colSpan = 4 + (showBatch ? 1 : 0) + (priced ? 3 : 0);

  const onPick = (item: StockItem) => {
    const existing = lines.findIndex(
      (l) =>
        l.productId === item.productId &&
        l.variantId === item.variantId &&
        !l.lotTracked &&
        !l.trackSerial &&
        !l.orderItemId,
    );
    if (existing >= 0) {
      setValue(name(existing, 'quantity'), String(Number(lines[existing].quantity || 0) + 1), {
        shouldDirty: true,
      });
      return;
    }
    append(lineFromItem(item));
  };

  const input = (
    i: number,
    key: keyof PurchaseLineValues,
    extra: {
      label: string;
      className?: string;
      numeric?: boolean;
      type?: string;
      placeholder?: string;
      locked?: boolean;
    },
  ) => (
    <FormField
      control={control}
      name={name(i, key)}
      render={({ field, aria }) => (
        <Input
          {...field}
          value={String(field.value ?? '')}
          {...aria}
          type={extra.type}
          readOnly={readOnly || extra.locked}
          inputMode={extra.numeric ? 'decimal' : undefined}
          placeholder={extra.placeholder}
          className={`${extra.numeric ? 'text-right tabular-nums' : ''} ${extra.className ?? ''}`}
          aria-label={extra.label}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && allowAdd && <ItemPicker warehouseId={warehouseId} onPick={onPick} />}
      {fields.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">{t('inventory.item')}</TableHead>
                {showBatch && <TableHead className="min-w-44">{t('inventory.batch')}</TableHead>}
                <TableHead className="min-w-40">{t('inventory.quantity')}</TableHead>
                <TableHead className="min-w-28 text-right">
                  {mode === 'requisition' ? t('purchase.estimatedPrice') : t('purchase.unitPrice')}
                </TableHead>
                {priced && <TableHead className="min-w-20 text-right">{t('purchase.discountPct')}</TableHead>}
                {priced && <TableHead className="min-w-36">{t('purchase.tax')}</TableHead>}
                {priced && <TableHead className="min-w-28 text-right">{t('purchase.lineTotal')}</TableHead>}
                <TableHead className="w-10">
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => {
                const line = lines[i] ?? (f as unknown as PurchaseLineValues);
                const unit = line.units.find((u) => u.unitId === line.unitId);
                const calcLine = calc?.lines[i];
                return (
                  <Fragment key={f.fieldKey}>
                    <TableRow className="align-top">
                      <TableCell>
                        <div className="font-medium">{label(line)}</div>
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
                        {line.info && <div className="mt-0.5 text-xs text-muted-foreground">{line.info}</div>}
                      </TableCell>
                      {showBatch && (
                        <TableCell>
                          {!line.lotTracked ? (
                            <span className="text-muted-foreground">—</span>
                          ) : mode === 'return' ? (
                            <ExistingBatch
                              control={control}
                              index={i}
                              line={line}
                              warehouseId={warehouseId}
                              readOnly={readOnly}
                            />
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {input(i, 'batchNo', {
                                label: t('inventory.batchNo'),
                                className: 'font-mono',
                                placeholder: t('inventory.batchNo'),
                              })}
                              {line.trackExpiry &&
                                input(i, 'expiryDate', { label: t('inventory.expiryDate'), type: 'date' })}
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            {input(i, 'quantity', {
                              label: t('inventory.quantity'),
                              numeric: true,
                              className: 'min-w-20',
                            })}
                          </div>
                          {line.units.length > 1 ? (
                            <FormField
                              control={control}
                              name={name(i, 'unitId')}
                              render={({ field, aria }) => (
                                <Select
                                  value={String(field.value)}
                                  onValueChange={field.onChange}
                                  disabled={readOnly || line.priceLocked}
                                >
                                  <SelectTrigger className="w-24" {...aria} aria-label={t('inventory.unit')}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {line.units.map((u) => (
                                      <SelectItem key={u.unitId} value={u.unitId}>
                                        {u.code}
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
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {line.priceLocked && (
                            <Lock
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={t('purchase.priceFromOrder')}
                            />
                          )}
                          {input(i, 'unitPrice', {
                            label: t('purchase.unitPrice'),
                            numeric: true,
                            locked: line.priceLocked,
                            placeholder: mode === 'requisition' ? t('purchase.optional') : '0',
                          })}
                        </div>
                      </TableCell>
                      {priced && (
                        <TableCell>
                          {input(i, 'discountPercent', {
                            label: t('purchase.discountPct'),
                            numeric: true,
                            placeholder: '0',
                          })}
                        </TableCell>
                      )}
                      {priced && (
                        <TableCell>
                          <FormField
                            control={control}
                            name={name(i, 'taxGroupId')}
                            render={({ field, aria }) => (
                              <Select
                                value={String(field.value) || NONE}
                                onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                                disabled={readOnly}
                              >
                                <SelectTrigger className="w-full" {...aria} aria-label={t('purchase.tax')}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE}>{t('purchase.noTax')}</SelectItem>
                                  {taxGroups.map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                      {g.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                      )}
                      {priced && (
                        <TableCell className="pt-4 text-right tabular-nums">
                          {calcLine ? (
                            <>
                              <div className="font-medium">{formatCurrency(calcLine.lineTotal)}</div>
                              {Number(calcLine.taxAmount) > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {t('purchase.taxShort')} {formatCurrency(calcLine.taxAmount)}
                                </div>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      )}
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
                    {showSerials && line.trackSerial && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={colSpan}>
                          <FormField
                            control={control}
                            name={name(i, 'serialNumbers')}
                            label={t('inventory.serialNumbersFor', { name: label(line) })}
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
