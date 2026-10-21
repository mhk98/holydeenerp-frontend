import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/common/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductLookups } from '../api/products-api';
import type { ProductValues } from '../schemas';

/**
 * Packs / alternate units of measure: "1 carton = 12 pcs" with their own barcode and prices.
 * Empty prices fall back to factor × the base price.
 */
export function ProductUnitsTable({
  form,
  units,
  readOnly,
}: {
  form: UseFormReturn<ProductValues>;
  units: ProductLookups['units'];
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { control, watch, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'units' });
  const baseUnitId = watch('baseUnitId');
  const baseCode = units.find((u) => u.id === baseUnitId)?.code ?? '';
  const rootError = form.formState.errors.units?.root?.message ?? form.formState.errors.units?.message;

  /** Only one default purchase / sale pack. */
  const setDefault = (index: number, key: 'isDefaultPurchase' | 'isDefaultSale', checked: boolean) =>
    fields.forEach((_, i) =>
      setValue(`units.${i}.${key}`, i === index ? checked : false, { shouldDirty: true }),
    );

  return (
    <div className="flex flex-col gap-3">
      {fields.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-36">{t('products.unit')}</TableHead>
                <TableHead className="min-w-28">{t('products.units.factor', { unit: baseCode })}</TableHead>
                <TableHead className="min-w-36">{t('products.barcode')}</TableHead>
                <TableHead className="min-w-28">{t('products.purchasePrice')}</TableHead>
                <TableHead className="min-w-28">{t('products.salePrice')}</TableHead>
                <TableHead className="text-center">{t('products.units.defaultPurchase')}</TableHead>
                <TableHead className="text-center">{t('products.units.defaultSale')}</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => (
                <TableRow key={f.id} className="align-top">
                  <TableCell>
                    <FormField
                      control={control}
                      name={`units.${i}.unitId`}
                      render={({ field, aria }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                          <SelectTrigger className="w-full" {...aria} aria-label={t('products.unit')}>
                            <SelectValue placeholder={t('products.units.pick')} />
                          </SelectTrigger>
                          <SelectContent>
                            {units
                              .filter((u) => u.id !== baseUnitId)
                              .map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name} ({u.code})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </TableCell>
                  {(['factor', 'barcode', 'purchasePrice', 'salePrice'] as const).map((key) => (
                    <TableCell key={key}>
                      <FormField
                        control={control}
                        name={`units.${i}.${key}`}
                        render={({ field, aria }) => (
                          <Input
                            {...field}
                            {...aria}
                            readOnly={readOnly}
                            inputMode={key === 'barcode' ? undefined : 'decimal'}
                            aria-label={t(
                              key === 'factor' ? 'products.units.factorShort' : `products.${key}`,
                            )}
                            placeholder={
                              key === 'purchasePrice' || key === 'salePrice' ? t('products.units.auto') : ''
                            }
                            className={key === 'barcode' ? 'font-mono' : 'tabular-nums'}
                          />
                        )}
                      />
                    </TableCell>
                  ))}
                  {(['isDefaultPurchase', 'isDefaultSale'] as const).map((key) => (
                    <TableCell key={key} className="text-center">
                      <Checkbox
                        className="mt-2"
                        disabled={readOnly}
                        checked={watch(`units.${i}.${key}`)}
                        onCheckedChange={(c) => setDefault(i, key, c === true)}
                        aria-label={t(
                          key === 'isDefaultPurchase'
                            ? 'products.units.defaultPurchase'
                            : 'products.units.defaultSale',
                        )}
                      />
                    </TableCell>
                  ))}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {rootError && <p className="text-sm text-destructive">{t(rootError)}</p>}
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={!baseUnitId}
          onClick={() =>
            append({
              unitId: '',
              factor: '',
              barcode: '',
              purchasePrice: '',
              salePrice: '',
              isDefaultPurchase: false,
              isDefaultSale: false,
            })
          }
        >
          <Plus aria-hidden /> {t('products.units.add')}
        </Button>
      )}
    </div>
  );
}
