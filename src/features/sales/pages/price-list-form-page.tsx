import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Save, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { applyServerErrors, v } from '@/lib/form';
import type { StockItem } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ItemPicker } from '@/features/inventory/components/item-picker';
import { priceListsApi, useSalesLookups } from '../api/sales-api';
import { SALES_ROUTES, nullIfEmpty } from '../lib';

const decimal = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d{1,4})?)?$/, 'validation.decimal');
const ANY_UNIT = '__any__';
const ALL_GROUPS = '__all__';

const rowSchema = z
  .object({
    key: z.string(),
    productId: z.string(),
    variantId: z.string().nullable(),
    label: z.string(),
    sku: z.string(),
    units: z.array(z.object({ unitId: z.string(), code: z.string() })),
    unitId: z.string(),
    mode: z.enum(['price', 'percent']),
    value: decimal,
    minQuantity: decimal,
  })
  .superRefine((r, ctx) => {
    if (!r.value) ctx.addIssue({ code: 'custom', path: ['value'], message: 'validation.required' });
    if (r.mode === 'percent' && Number(r.value) > 100)
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'validation.tooLarge' });
  });

const schema = z.object({
  name: v.required(z.string().max(150, 'validation.tooLong')),
  code: v.code(),
  customerGroupId: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  priority: z.string().regex(/^-?\d{0,3}$/, 'validation.integer'),
  isActive: z.boolean(),
  notes: z.string().max(500, 'validation.tooLong'),
  items: z.array(rowSchema),
});
type Values = z.infer<typeof schema>;
type Row = Values['items'][number];

const num = (s: string | null | undefined) => (s == null ? '' : String(Number(s)));

export default function PriceListFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const lookups = useSalesLookups();
  const doc = priceListsApi.useOne(isNew ? null : id);
  const save = priceListsApi.useSave();
  const remove = priceListsApi.useRemove();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = can(isNew ? 'sales.create' : 'sales.update');

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      name: '',
      code: '',
      customerGroupId: '',
      validFrom: '',
      validTo: '',
      priority: '0',
      isActive: true,
      notes: '',
      items: [],
    },
  });
  const {
    fields,
    append,
    remove: removeRow,
  } = useFieldArray({ control: form.control, name: 'items', keyName: 'fieldKey' });
  const rows = useWatch({ control: form.control, name: 'items' }) ?? [];
  const loaded = doc.data;

  useEffect(() => {
    if (!loaded) return;
    form.reset({
      name: loaded.name,
      code: loaded.code,
      customerGroupId: loaded.customerGroupId ?? '',
      validFrom: loaded.validFrom ?? '',
      validTo: loaded.validTo ?? '',
      priority: String(loaded.priority),
      isActive: loaded.isActive,
      notes: loaded.notes ?? '',
      items: (loaded.items ?? []).map((i) => {
        const units = [{ unitId: i.product.baseUnitId, code: i.product.baseUnit?.code ?? '' }];
        if (i.unit && i.unitId !== i.product.baseUnitId) units.push({ unitId: i.unit.id, code: i.unit.code });
        return {
          key: i.id,
          productId: i.productId,
          variantId: i.variantId,
          label: i.variant ? `${i.product.name} — ${i.variant.name}` : i.product.name,
          sku: i.variant?.sku ?? i.product.sku,
          units,
          unitId: i.unitId ?? '',
          mode: i.price != null ? 'price' : 'percent',
          value: num(i.price ?? i.discountPercent),
          minQuantity: Number(i.minQuantity) ? num(i.minQuantity) : '',
        } satisfies Row;
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the document changes
  }, [loaded?.id, loaded?.updatedAt]);

  const onPick = (item: StockItem) =>
    append({
      key: `${item.key}:${Date.now()}`,
      productId: item.productId,
      variantId: item.variantId,
      label: item.variantName ? `${item.name} — ${item.variantName}` : item.name,
      sku: item.sku,
      units: item.units.map((u) => ({ unitId: u.unitId, code: u.code })),
      unitId: '',
      mode: 'price',
      value: '',
      minQuantity: '',
    });

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: isNew ? undefined : id,
        data: {
          name: values.name,
          code: values.code,
          customerGroupId: values.customerGroupId || null,
          validFrom: nullIfEmpty(values.validFrom),
          validTo: nullIfEmpty(values.validTo),
          priority: Number(values.priority || 0),
          isActive: values.isActive,
          notes: nullIfEmpty(values.notes),
          items: values.items.map((r) => ({
            productId: r.productId,
            variantId: r.variantId,
            unitId: r.unitId || null,
            price: r.mode === 'price' ? r.value : null,
            discountPercent: r.mode === 'percent' ? r.value : null,
            minQuantity: r.minQuantity || '0',
          })),
        },
      });
      toast.success(t('sales.priceLists.saved'));
      if (isNew) navigate(`${SALES_ROUTES.priceList}/${saved.id}`, { replace: true });
    } catch (err) {
      if (applyServerErrors(err, form.setError)) toast.error(t('inventory.fixErrors'));
      else toast.error((err as Error).message);
    }
  });

  if (!isNew && doc.isPending) return <PageSkeleton />;
  const name = (i: number, k: keyof Row) => `items.${i}.${k}` as const;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={isNew ? t('sales.priceLists.new') : (loaded?.name ?? '')}
        description={t('sales.priceLists.formHint')}
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.priceLists.title'), to: SALES_ROUTES.priceList },
          { label: isNew ? t('common.new') : (loaded?.code ?? '') },
        ]}
        actions={
          <>
            {loaded && can('sales.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {editable && (
              <Button type="button" onClick={onSave} disabled={save.isPending}>
                {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('common.save')}
              </Button>
            )}
          </>
        }
      />
      <fieldset disabled={!editable || save.isPending} className="contents">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardContent className="pt-6">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField control={form.control} name="name" label={t('sales.priceLists.name')} />
                  <TextField
                    control={form.control}
                    name="code"
                    label={t('sales.priceLists.code')}
                    className="font-mono uppercase"
                  />
                  <FormField
                    control={form.control}
                    name="customerGroupId"
                    label={t('sales.priceLists.customerGroup')}
                    description={t('sales.priceLists.groupHint')}
                    render={({ field, aria }) => (
                      <Select
                        value={field.value || ALL_GROUPS}
                        onValueChange={(v) => field.onChange(v === ALL_GROUPS ? '' : v)}
                      >
                        <SelectTrigger className="w-full" {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_GROUPS}>{t('sales.priceLists.allCustomers')}</SelectItem>
                          {(lookups.data?.customerGroups ?? []).map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <TextField
                    control={form.control}
                    name="validFrom"
                    type="date"
                    label={t('sales.priceLists.validFrom')}
                  />
                  <TextField
                    control={form.control}
                    name="validTo"
                    type="date"
                    label={t('sales.priceLists.validTo')}
                  />
                  <TextField
                    control={form.control}
                    name="priority"
                    inputMode="numeric"
                    label={t('sales.priceLists.priority')}
                    description={t('sales.priceLists.priorityHint')}
                  />
                  <SwitchField control={form.control} name="isActive" label={t('common.active')} />
                </div>
                <TextareaField control={form.control} name="notes" label={t('inventory.notes')} rows={2} />
              </FieldGroup>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{t('sales.priceLists.prices')}</CardTitle>
              <CardDescription>{t('sales.priceLists.pricesHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {editable && <ItemPicker onPick={onPick} />}
              {fields.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-56">{t('inventory.item')}</TableHead>
                        <TableHead className="min-w-28">{t('inventory.unit')}</TableHead>
                        <TableHead className="min-w-56">{t('sales.priceLists.rule')}</TableHead>
                        <TableHead className="min-w-28 text-right">{t('sales.priceLists.minQty')}</TableHead>
                        <TableHead className="w-10">
                          <span className="sr-only">{t('common.actions')}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((f, i) => {
                        const row = rows[i] ?? (f as unknown as Row);
                        return (
                          <TableRow key={f.fieldKey} className="align-top">
                            <TableCell>
                              <div className="font-medium">{row.label}</div>
                              <code className="font-mono text-xs text-muted-foreground">{row.sku}</code>
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={name(i, 'unitId')}
                                render={({ field }) => (
                                  <Select
                                    value={String(field.value) || ANY_UNIT}
                                    onValueChange={(v) => field.onChange(v === ANY_UNIT ? '' : v)}
                                  >
                                    <SelectTrigger className="w-28" aria-label={t('inventory.unit')}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={ANY_UNIT}>
                                        {t('sales.priceLists.anyUnit')}
                                      </SelectItem>
                                      {row.units.map((u) => (
                                        <SelectItem key={u.unitId} value={u.unitId}>
                                          {u.code}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <FormField
                                  control={form.control}
                                  name={name(i, 'mode')}
                                  render={({ field }) => (
                                    <Select value={String(field.value)} onValueChange={field.onChange}>
                                      <SelectTrigger className="w-32" aria-label={t('sales.priceLists.rule')}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="price">
                                          {t('sales.priceLists.fixedPrice')}
                                        </SelectItem>
                                        <SelectItem value="percent">
                                          {t('sales.priceLists.percentOff')}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={name(i, 'value')}
                                  render={({ field, aria }) => (
                                    <Input
                                      {...field}
                                      value={String(field.value ?? '')}
                                      {...aria}
                                      inputMode="decimal"
                                      className="text-right tabular-nums"
                                      placeholder={row.mode === 'percent' ? '%' : '0'}
                                      aria-label={t('sales.priceLists.value')}
                                    />
                                  )}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={name(i, 'minQuantity')}
                                render={({ field, aria }) => (
                                  <Input
                                    {...field}
                                    value={String(field.value ?? '')}
                                    {...aria}
                                    inputMode="decimal"
                                    className="text-right tabular-nums"
                                    placeholder="—"
                                    aria-label={t('sales.priceLists.minQty')}
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              {editable && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="mt-0.5"
                                  onClick={() => removeRow(i)}
                                  aria-label={t('common.remove')}
                                >
                                  <Trash2 aria-hidden />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </fieldset>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title={t('sales.priceLists.deleteTitle')}
        description={t('sales.priceLists.deleteText')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(id!, {
            onSuccess: () => navigate(SALES_ROUTES.priceList),
            onError: () => setConfirmDelete(false),
          })
        }
      />
    </form>
  );
}
