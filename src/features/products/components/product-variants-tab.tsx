import { useMemo, useState } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Sparkles, Trash2 } from 'lucide-react';
import type { ProductAttribute } from '@/types';
import { SwitchField } from '@/components/common/fields';
import { FormField } from '@/components/common/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toggle } from '@/components/ui/toggle';
import type { ProductValues } from '../schemas';

/** Cartesian product: [[a,b],[x,y]] → [[a,x],[a,y],[b,x],[b,y]] */
function combinations(groups: string[][]): string[][] {
  return groups.reduce<string[][]>((acc, group) => acc.flatMap((c) => group.map((g) => [...c, g])), [[]]);
}
const comboKey = (ids: string[]) => [...ids].sort().join('-');

/**
 * Variants (size × colour…): pick attribute values, generate the missing combinations,
 * then adjust SKU / barcode / price per variant. Blank SKU = "<product SKU>-<values>".
 */
export function ProductVariantsTab({
  form,
  attributes,
  readOnly,
}: {
  form: UseFormReturn<ProductValues>;
  attributes: ProductAttribute[];
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'variants', keyName: 'key' });
  const hasVariants = watch('hasVariants');
  const variants = watch('variants');

  const valueIndex = useMemo(() => {
    const map = new Map<string, { value: string; attributeId: string; attribute: string; order: number }>();
    for (const a of attributes)
      for (const x of a.values)
        map.set(x.id, { value: x.value, attributeId: a.id, attribute: a.name, order: a.sortOrder });
    return map;
  }, [attributes]);

  // Values already used by variants start selected.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(variants.flatMap((x) => x.attributeValueIds)),
  );
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const label = (ids: string[]) =>
    ids
      .map((id) => valueIndex.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.order - b!.order)
      .map((x) => x!.value)
      .join(' / ');

  const generate = () => {
    const groups = attributes
      .map((a) => a.values.filter((x) => selected.has(x.id)).map((x) => x.id))
      .filter((g) => g.length > 0);
    if (!groups.length) {
      toast.error(t('products.variants.pickValues'));
      return;
    }
    const existing = new Set(variants.map((x) => comboKey(x.attributeValueIds)));
    const missing = combinations(groups).filter((c) => !existing.has(comboKey(c)));
    for (const ids of missing)
      append({
        attributeValueIds: ids,
        sku: '',
        barcode: '',
        purchasePrice: '',
        salePrice: '',
        isActive: true,
      });
    toast.success(t('products.variants.generated', { count: missing.length }));
  };

  return (
    <div className="flex flex-col gap-5">
      <SwitchField
        control={control}
        name="hasVariants"
        label={t('products.variants.enable')}
        description={t('products.variants.enableHint')}
      />

      {hasVariants && (
        <>
          {attributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('products.variants.noAttributes')}</p>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              {attributes.map((a) => (
                <div key={a.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-24 shrink-0 text-sm font-medium">{a.name}</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={a.name}>
                    {a.values.map((x) => (
                      <Toggle
                        key={x.id}
                        size="sm"
                        variant="outline"
                        disabled={readOnly}
                        pressed={selected.has(x.id)}
                        onPressedChange={(on) => toggle(x.id, on)}
                      >
                        {x.value}
                      </Toggle>
                    ))}
                  </div>
                </div>
              ))}
              {!readOnly && (
                <Button type="button" size="sm" variant="secondary" className="self-start" onClick={generate}>
                  <Sparkles aria-hidden /> {t('products.variants.generate')}
                </Button>
              )}
            </div>
          )}

          {fields.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-32">{t('products.variants.variant')}</TableHead>
                    <TableHead className="min-w-40">{t('products.sku')}</TableHead>
                    <TableHead className="min-w-40">{t('products.barcode')}</TableHead>
                    <TableHead className="min-w-28">{t('products.purchasePrice')}</TableHead>
                    <TableHead className="min-w-28">{t('products.salePrice')}</TableHead>
                    <TableHead>{t('common.active')}</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">{t('common.actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f, i) => (
                    <TableRow key={f.key} className="align-top">
                      <TableCell className="pt-4 font-medium">
                        {label(variants[i]?.attributeValueIds ?? [])}
                      </TableCell>
                      {(['sku', 'barcode', 'purchasePrice', 'salePrice'] as const).map((key) => (
                        <TableCell key={key}>
                          <FormField
                            control={control}
                            name={`variants.${i}.${key}`}
                            render={({ field, aria }) => (
                              <Input
                                {...field}
                                {...aria}
                                readOnly={readOnly}
                                aria-label={`${label(variants[i]?.attributeValueIds ?? [])} ${t(`products.${key}`)}`}
                                placeholder={
                                  key === 'sku'
                                    ? t('products.variants.autoSku')
                                    : key === 'barcode'
                                      ? ''
                                      : t('products.variants.samePrice')
                                }
                                className={key === 'sku' || key === 'barcode' ? 'font-mono' : 'tabular-nums'}
                              />
                            )}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="pt-3.5">
                        <Switch
                          disabled={readOnly}
                          checked={watch(`variants.${i}.isActive`)}
                          onCheckedChange={(c) =>
                            form.setValue(`variants.${i}.isActive`, c, { shouldDirty: true })
                          }
                          aria-label={`${label(variants[i]?.attributeValueIds ?? [])} ${t('common.active')}`}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
