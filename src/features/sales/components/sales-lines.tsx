import { Fragment } from 'react';
import { useFieldArray, useWatch, type Control, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link2, Tag, Trash2 } from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/format';
import type { StockItem } from '@/types';
import { ChipsInput } from '@/components/common/chips-input';
import { FormField } from '@/components/common/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ItemPicker } from '@/features/inventory/components/item-picker';
import { ExistingBatch } from '@/features/purchase/components/purchase-lines';
import type { PurchaseLineValues } from '@/features/purchase/schemas';
import { fetchPrices, type SalesCalculation } from '../api/sales-api';
import { lineFromItem, type SalesLineValues, type SalesLinesForm as LinesForm } from '../schemas';

interface Props {
  form: UseFormReturn<LinesForm>;
  /** Show price, discount, tax and totals (everything except challans). */
  priced?: boolean;
  /** Goods move: pick batches and serials (lines delivered by a challan are skipped). */
  stock?: boolean;
  /** Goods come back (returns): any batch of the item, not only those in stock. */
  incoming?: boolean;
  customerId?: string | null;
  warehouseId?: string | null;
  taxGroups?: { id: string; name: string }[];
  calc?: SalesCalculation;
  readOnly?: boolean;
  /** Lines may only come from the source document. */
  allowAdd?: boolean;
}

const NONE = '__none__';
const label = (l: SalesLineValues) => (l.variantName ? `${l.name} — ${l.variantName}` : l.name);

/** Line editor of every sales document; new items get the customer's price-list price. */
export function SalesLines({
  form,
  priced = true,
  stock = false,
  incoming = false,
  customerId,
  warehouseId,
  taxGroups = [],
  calc,
  readOnly,
  allowAdd = true,
}: Props) {
  const { t } = useTranslation();
  const { control, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items', keyName: 'fieldKey' });
  const lines = useWatch({ control, name: 'items' }) ?? [];
  const movesStock = (l: SalesLineValues) => stock && !l.challanItemId;
  const showBatch = lines.some((l) => movesStock(l) && l.lotTracked);
  const rootError = form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message;
  const name = (i: number, n: keyof SalesLineValues) => `items.${i}.${n}` as FieldPath<LinesForm>;
  const colSpan = 3 + (showBatch ? 1 : 0) + (priced ? 4 : 0);

  /** Price of a line from the customer's price list (or the standard sale price). */
  const priceOf = async (line: Pick<SalesLineValues, 'productId' | 'variantId' | 'unitId' | 'quantity'>) => {
    try {
      const [p] = await fetchPrices({
        customerId: customerId || null,
        items: [
          {
            productId: line.productId,
            variantId: line.variantId,
            unitId: line.unitId,
            quantity: line.quantity || '1',
          },
        ],
      });
      return p;
    } catch (err) {
      toast.error((err as Error).message);
      return undefined;
    }
  };
  const sourceLabel = (p: Awaited<ReturnType<typeof priceOf>>) =>
    p?.source.type === 'price_list' ? p.source.name : '';

  const onPick = async (item: StockItem) => {
    const existing = lines.findIndex(
      (l) =>
        l.productId === item.productId &&
        l.variantId === item.variantId &&
        !l.lotTracked &&
        !l.trackSerial &&
        !l.orderItemId &&
        !l.challanItemId,
    );
    if (existing >= 0) {
      setValue(name(existing, 'quantity'), String(Number(lines[existing].quantity || 0) + 1), {
        shouldDirty: true,
      });
      return;
    }
    const line = lineFromItem(item);
    if (priced) {
      const p = await priceOf(line);
      if (p) {
        line.unitPrice = String(Number(p.unitPrice));
        line.taxGroupId = p.taxGroupId ?? line.taxGroupId;
        line.priceIncludesTax = p.priceIncludesTax;
        line.priceSource = sourceLabel(p);
      }
    }
    append(line);
  };

  /** A new unit has its own price (pack price or price-list row). */
  const onUnitChange = async (i: number, unitId: string) => {
    setValue(name(i, 'unitId'), unitId, { shouldDirty: true });
    if (!priced) return;
    const p = await priceOf({ ...getValues(`items.${i}`), unitId });
    if (!p) return;
    setValue(name(i, 'unitPrice'), String(Number(p.unitPrice)), { shouldDirty: true });
    setValue(name(i, 'priceSource'), sourceLabel(p));
  };

  const input = (
    i: number,
    key: keyof SalesLineValues,
    extra: { label: string; className?: string; numeric?: boolean; placeholder?: string; locked?: boolean },
  ) => (
    <FormField
      control={control}
      name={name(i, key)}
      render={({ field, aria }) => (
        <Input
          {...field}
          value={String(field.value ?? '')}
          {...aria}
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
                {priced && <TableHead className="min-w-28 text-right">{t('purchase.unitPrice')}</TableHead>}
                {priced && <TableHead className="min-w-36">{t('sales.discount')}</TableHead>}
                {priced && <TableHead className="min-w-36">{t('purchase.tax')}</TableHead>}
                {priced && <TableHead className="min-w-28 text-right">{t('purchase.lineTotal')}</TableHead>}
                <TableHead className="w-10">
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => {
                const line = lines[i] ?? (f as unknown as SalesLineValues);
                const unit = line.units.find((u) => u.unitId === line.unitId);
                const calcLine = calc?.lines[i];
                const linked = Boolean(line.orderItemId || line.challanItemId || line.invoiceItemId);
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
                          {line.challanItemId && stock && (
                            <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px] font-normal">
                              <Link2 className="size-2.5" aria-hidden /> {t('sales.deliveredByChallan')}
                            </Badge>
                          )}
                          {priced && line.priceSource && (
                            <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px] font-normal">
                              <Tag className="size-2.5" aria-hidden /> {line.priceSource}
                            </Badge>
                          )}
                        </div>
                        {line.info && <div className="mt-0.5 text-xs text-muted-foreground">{line.info}</div>}
                      </TableCell>
                      {showBatch && (
                        <TableCell>
                          {movesStock(line) && line.lotTracked ? (
                            <ExistingBatch
                              control={control as unknown as Control<{ items: PurchaseLineValues[] }>}
                              index={i}
                              line={line}
                              warehouseId={warehouseId}
                              readOnly={readOnly}
                              available={!incoming}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
                          {line.units.length > 1 && !linked ? (
                            <Select
                              value={line.unitId}
                              onValueChange={(u) => onUnitChange(i, u)}
                              disabled={readOnly}
                            >
                              <SelectTrigger className="w-24" aria-label={t('inventory.unit')}>
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
                          ) : (
                            <span className="pt-2 text-sm text-muted-foreground">
                              {unit?.code ?? line.baseUnitCode}
                            </span>
                          )}
                        </div>
                        {unit && unit.factor !== '1' && Number(line.quantity) > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            = {formatQuantity(Number(line.quantity) * Number(unit.factor))}{' '}
                            {line.baseUnitCode}
                          </p>
                        )}
                      </TableCell>
                      {priced && (
                        <TableCell>
                          {input(i, 'unitPrice', {
                            label: t('purchase.unitPrice'),
                            numeric: true,
                            placeholder: '0',
                          })}
                          {line.priceIncludesTax && (
                            <p className="mt-1 text-right text-xs text-muted-foreground">
                              {t('sales.inclTax')}
                            </p>
                          )}
                        </TableCell>
                      )}
                      {priced && (
                        <TableCell>
                          <div className="flex gap-1">
                            <FormField
                              control={control}
                              name={name(i, 'discountType')}
                              render={({ field, aria }) => (
                                <Select
                                  value={String(field.value)}
                                  onValueChange={field.onChange}
                                  disabled={readOnly}
                                >
                                  <SelectTrigger
                                    className="w-16 px-2"
                                    {...aria}
                                    aria-label={t('sales.discountType')}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percent">%</SelectItem>
                                    <SelectItem value="amount">{t('sales.fixed')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {input(i, 'discountValue', {
                              label: t('sales.discount'),
                              numeric: true,
                              placeholder: '0',
                              className: 'min-w-16',
                            })}
                          </div>
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
                              {Number(calcLine.discountAmount) > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  − {formatCurrency(calcLine.discountAmount)}
                                </div>
                              )}
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
                    {movesStock(line) && line.trackSerial && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={colSpan}>
                          <FormField
                            control={control}
                            name={name(i, 'serialNumbers')}
                            label={t('inventory.serialNumbersFor', { name: label(line) })}
                            description={t('sales.serialHint')}
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
