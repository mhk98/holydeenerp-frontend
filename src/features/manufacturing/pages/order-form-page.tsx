import { useEffect } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Save } from 'lucide-react';
import { applyServerErrors, v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import { FormField } from '@/components/common/form-field';
import { SelectField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ItemPicker } from '@/features/inventory/components/item-picker';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { itemLabel } from '@/features/inventory/lib';
import { todayIn } from '@/features/inventory/schemas';
import { useBom, useOrder, useProductBoms, useSaveOrder } from '../api/manufacturing-api';
import { MFG_ROUTES, PRIORITIES, productLabel } from '../lib';
import type { Priority } from '../types';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date');
const schema = z
  .object({
    productId: v.required(),
    variantId: z.string().nullable(),
    productName: z.string(),
    bomId: z.string(),
    quantity: v.decimal({ scale: 4 }),
    rawWarehouseId: v.required(),
    finishedWarehouseId: z.string(),
    priority: z.enum(PRIORITIES as [Priority, ...Priority[]]),
    plannedStart: date,
    plannedEnd: z.string(),
    notes: z.string().max(2000, 'validation.tooLong'),
  })
  .refine((o) => !o.plannedEnd || o.plannedEnd >= o.plannedStart, {
    path: ['plannedEnd'],
    message: 'manufacturing.validation.endBeforeStart',
  });
type Values = z.infer<typeof schema>;

/** New manufacturing order (or edit a draft): what to make, how many, from where and when. */
export default function OrderFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useSettingsStore((s) => s.timezone);
  const order = useOrder(isNew ? null : id);
  const fromBom = useBom(isNew ? params.get('bomId') : null);
  const save = useSaveOrder();

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      productId: '',
      variantId: null,
      productName: '',
      bomId: '',
      quantity: '1',
      rawWarehouseId: '',
      finishedWarehouseId: '',
      priority: 'normal',
      plannedStart: todayIn(timezone),
      plannedEnd: '',
      notes: '',
    },
  });
  const { control, reset, setValue } = form;
  const [productId, productName] = useWatch({ control, name: ['productId', 'productName'] });
  const boms = useProductBoms(productId || null);

  const loaded = order.data;
  useEffect(() => {
    if (!loaded) return;
    reset({
      productId: loaded.productId,
      variantId: loaded.variantId,
      productName: productLabel(loaded.product, loaded.variant),
      bomId: loaded.bomId,
      quantity: String(Number(loaded.quantity)),
      rawWarehouseId: loaded.rawWarehouseId,
      finishedWarehouseId: loaded.finishedWarehouseId,
      priority: loaded.priority,
      plannedStart: loaded.plannedStart,
      plannedEnd: loaded.plannedEnd,
      notes: loaded.notes ?? '',
    });
  }, [loaded, reset]);
  // "Make with this BOM" from a BOM page.
  useEffect(() => {
    const b = fromBom.data;
    if (!b) return;
    setValue('productId', b.productId);
    setValue('variantId', b.variantId);
    setValue('productName', productLabel(b.product, b.variant));
    setValue('bomId', b.id);
    setValue('quantity', String(Number(b.quantity)));
  }, [fromBom.data, setValue]);
  // Default to the product's default BOM.
  useEffect(() => {
    if (!boms.data?.length || form.getValues('bomId')) return;
    setValue('bomId', (boms.data.find((b) => b.isDefault) ?? boms.data[0]).id);
  }, [boms.data, form, setValue]);

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: isNew ? undefined : id,
        data: {
          productId: values.productId,
          variantId: values.variantId,
          bomId: values.bomId || null,
          quantity: values.quantity,
          rawWarehouseId: values.rawWarehouseId,
          finishedWarehouseId: values.finishedWarehouseId || null,
          priority: values.priority,
          plannedStart: values.plannedStart,
          plannedEnd: values.plannedEnd || undefined,
          notes: v.nullIfEmpty(values.notes),
        },
      });
      toast.success(t('manufacturing.orders.saved'));
      navigate(`${MFG_ROUTES.orders}/${saved.id}`, { replace: true });
    } catch (err) {
      if (applyServerErrors(err as Error, form.setError)) toast.error(t('manufacturing.fixErrors'));
      else toast.error((err as Error).message);
    }
  });

  if (!isNew && order.isPending) return <PageSkeleton />;

  return (
    <form onSubmit={onSave} noValidate>
      <PageHeader
        title={
          isNew ? t('manufacturing.orders.new') : t('manufacturing.orders.edit', { number: loaded?.number })
        }
        description={t('manufacturing.orders.newHint')}
        breadcrumbs={[
          { label: t('nav.manufacturing') },
          { label: t('manufacturing.orders.title'), to: MFG_ROUTES.orders },
          { label: isNew ? t('common.new') : (loaded?.number ?? '') },
        ]}
        actions={
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('manufacturing.orders.saveDraft')}
          </Button>
        }
      />
      <Card className="max-w-3xl">
        <CardContent>
          <fieldset disabled={save.isPending} className="contents">
            <FieldGroup>
              <FormField
                control={control}
                name="productId"
                label={t('manufacturing.product')}
                render={() => (
                  <div className="flex flex-col gap-2">
                    {productName && <div className="text-sm font-medium">{productName}</div>}
                    <ItemPicker
                      onPick={(i) => {
                        setValue('productId', i.productId, { shouldDirty: true, shouldValidate: true });
                        setValue('variantId', i.variantId);
                        setValue('productName', itemLabel(i));
                        setValue('bomId', '');
                      }}
                    />
                  </div>
                )}
              />
              <SelectField
                control={control}
                name="bomId"
                label={t('manufacturing.orders.bom')}
                description={
                  productId && boms.data && !boms.data.length ? t('manufacturing.orders.noBom') : undefined
                }
                placeholder={t('manufacturing.orders.pickBom')}
                disabled={!boms.data?.length}
                options={(boms.data ?? []).map((b) => ({
                  value: b.id,
                  label: `${b.code} · v${b.version}${b.isDefault ? ` (${t('manufacturing.boms.default')})` : ''}`,
                }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="quantity"
                  inputMode="decimal"
                  label={t('manufacturing.quantity')}
                />
                <SelectField
                  control={control}
                  name="priority"
                  label={t('manufacturing.priority')}
                  options={PRIORITIES.map((p) => ({ value: p, label: t(`manufacturing.priorities.${p}`) }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="rawWarehouseId"
                  label={t('manufacturing.orders.rawWarehouse')}
                  description={t('manufacturing.orders.rawWarehouseHint')}
                  render={({ field, aria }) => (
                    <WarehouseSelect
                      value={field.value || null}
                      onChange={(w) => field.onChange(w ?? '')}
                      {...aria}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name="finishedWarehouseId"
                  label={t('manufacturing.orders.finishedWarehouse')}
                  description={t('manufacturing.orders.finishedWarehouseHint')}
                  render={({ field, aria }) => (
                    <WarehouseSelect
                      value={field.value || null}
                      onChange={(w) => field.onChange(w ?? '')}
                      {...aria}
                    />
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="plannedStart"
                  type="date"
                  label={t('manufacturing.orders.plannedStart')}
                />
                <TextField
                  control={control}
                  name="plannedEnd"
                  type="date"
                  label={t('manufacturing.orders.plannedEnd')}
                  description={t('manufacturing.orders.plannedEndHint')}
                />
              </div>
              <TextareaField control={control} name="notes" label={t('manufacturing.notes')} rows={2} />
            </FieldGroup>
          </fieldset>
        </CardContent>
      </Card>
    </form>
  );
}
