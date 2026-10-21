import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Barcode, Printer, Save, Wand2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatPercent } from '@/lib/format';
import { applyServerErrors } from '@/lib/form';
import { cn } from '@/lib/utils';
import { FormField } from '@/components/common/form-field';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  attributesResource,
  brandsResource,
  flattenTree,
  generateBarcode,
  productsResource,
  useCategoryTree,
  useProductLookups,
  useSaveProduct,
} from '../api/products-api';
import { ProductImagesTab } from '../components/product-images-tab';
import { ProductUnitsTable } from '../components/product-units-table';
import { ProductVariantsTab } from '../components/product-variants-tab';
import {
  emptyProduct,
  NONE,
  PRODUCT_TYPES,
  productSchema,
  toFormValues,
  toPayload,
  type ProductValues,
} from '../schemas';

type Tab = 'general' | 'pricing' | 'inventory' | 'variants' | 'images';

/** Which tab shows each top-level field (to flag tabs that contain errors). */
const TAB_FIELDS: Record<Tab, (keyof ProductValues)[]> = {
  general: [
    'name',
    'sku',
    'type',
    'barcode',
    'barcodeType',
    'categoryId',
    'brandId',
    'baseUnitId',
    'description',
  ],
  pricing: ['purchasePrice', 'salePrice', 'taxGroupId', 'priceIncludesTax', 'units'],
  inventory: ['reorderLevel', 'trackBatch', 'trackSerial', 'trackExpiry'],
  variants: ['variants', 'hasVariants'],
  images: [],
};
const tabOf = (errors: FieldErrors<ProductValues>) =>
  (Object.keys(TAB_FIELDS) as Tab[]).find((tab) => TAB_FIELDS[tab].some((f) => errors[f]));

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const readOnly = !can(isNew ? 'products.create' : 'products.update');

  const product = productsResource.useOne(isNew ? null : id);
  const lookups = useProductLookups();
  const tree = useCategoryTree();
  const brands = brandsResource.useOptions();
  const attributes = attributesResource.useOptions({ sort: 'sortOrder' });
  const save = useSaveProduct();
  const [tab, setTab] = useState<Tab>('general');
  const [generating, setGenerating] = useState(false);

  const form = useForm<ProductValues>({
    resolver: zodResolver(productSchema) as Resolver<ProductValues>,
    defaultValues: emptyProduct(),
  });
  const { control, reset, setValue, getValues, formState } = form;

  // Load the product, or default the base unit to "pcs" for a new one.
  // Re-load only when another version of the product arrives (image uploads keep unsaved edits).
  const loaded = product.data;
  useEffect(() => {
    if (!isNew && loaded) reset(toFormValues(loaded));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on id/updatedAt on purpose
  }, [isNew, loaded?.id, loaded?.updatedAt, reset]);
  useEffect(() => {
    if (isNew && lookups.data && !getValues('baseUnitId')) {
      const pcs = lookups.data.units.find((u) => u.code === 'pcs') ?? lookups.data.units[0];
      if (pcs) setValue('baseUnitId', pcs.id);
    }
  }, [isNew, lookups.data, getValues, setValue]);

  const [type, purchase, sale] = useWatch({ control, name: ['type', 'purchasePrice', 'salePrice'] });
  const margin = useMemo(() => {
    const p = Number(purchase);
    const s = Number(sale);
    return p > 0 && s > 0 ? ((s - p) / s) * 100 : null;
  }, [purchase, sale]);
  const errorTab = tabOf(formState.errors);

  const onSubmit = form.handleSubmit(
    (values) =>
      save.mutate(
        { id: isNew ? undefined : id, data: toPayload(values) },
        {
          onSuccess: (saved) => {
            toast.success(t(isNew ? 'crud.created' : 'crud.updated', { entity: t('products.entityCap') }));
            if (isNew) navigate(`/inventory/products/${saved.id}`, { replace: true });
            else reset(toFormValues(saved));
          },
          onError: (err) => {
            if (applyServerErrors(err, form.setError)) {
              const next = tabOf(form.formState.errors);
              if (next) setTab(next);
            }
            toast.error(err.message);
          },
        },
      ),
    (errors) => {
      const next = tabOf(errors);
      if (next) setTab(next);
    },
  );

  const suggestBarcode = async () => {
    setGenerating(true);
    try {
      const code = await generateBarcode(getValues('barcodeType'), getValues('sku') || undefined);
      setValue('barcode', code, { shouldDirty: true, shouldValidate: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (!isNew && product.isPending) return <PageSkeleton />;

  const title = isNew ? t('crud.createTitle', { entity: t('products.entity') }) : (product.data?.name ?? '');
  const unitOptions = (lookups.data?.units ?? []).map((u) => ({
    value: u.id,
    label: `${u.name} (${u.code})`,
  }));
  const tabTrigger = (value: Tab) => (
    <TabsTrigger value={value} className="relative">
      {t(`products.tabs.${value}`)}
      {errorTab === value && (
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" aria-hidden />
      )}
    </TabsTrigger>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title={title}
        description={isNew ? t('products.form.newHint') : product.data?.sku}
        breadcrumbs={[
          { label: t('nav.inventory') },
          { label: t('products.title'), to: '/inventory/products' },
          { label: isNew ? t('common.new') : (product.data?.sku ?? '') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && can('products.print') && (
              <Button type="button" variant="outline" asChild>
                <Link to={`/inventory/labels?ids=${id}`}>
                  <Printer aria-hidden /> {t('products.printLabels')}
                </Link>
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => navigate('/inventory/products')}>
              {t('common.cancel')}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('common.save')}
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-auto">
          {tabTrigger('general')}
          {tabTrigger('pricing')}
          {tabTrigger('inventory')}
          {tabTrigger('variants')}
          {tabTrigger('images')}
        </TabsList>

        <fieldset disabled={readOnly} className="contents">
          <TabsContent value="general" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <TextField
                    control={control}
                    name="name"
                    label={t('fields.name')}
                    className="md:col-span-2"
                    placeholder="Teer Soybean Oil 5 L"
                  />
                  <TextField
                    control={control}
                    name="sku"
                    label={t('products.sku')}
                    placeholder={isNew ? t('products.form.skuAuto') : ''}
                    description={isNew ? t('products.form.skuHint') : undefined}
                    className="font-mono"
                  />
                  <SelectField
                    control={control}
                    name="type"
                    label={t('fields.type')}
                    options={PRODUCT_TYPES.map((v) => ({ value: v, label: t(`products.types.${v}`) }))}
                  />
                  <FormField
                    control={control}
                    name="barcode"
                    label={t('products.barcode')}
                    description={t('products.form.barcodeHint')}
                    render={({ field, aria }) => (
                      <InputGroup>
                        <InputGroupAddon>
                          <Barcode aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput {...field} {...aria} className="font-mono" />
                        {!readOnly && (
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton size="xs" onClick={suggestBarcode} disabled={generating}>
                              {generating ? <Spinner /> : <Wand2 aria-hidden />} {t('products.form.generate')}
                            </InputGroupButton>
                          </InputGroupAddon>
                        )}
                      </InputGroup>
                    )}
                  />
                  <SelectField
                    control={control}
                    name="barcodeType"
                    label={t('products.barcodeType')}
                    options={[
                      { value: 'EAN13', label: 'EAN-13' },
                      { value: 'CODE128', label: 'Code 128' },
                    ]}
                  />
                  <SelectField
                    control={control}
                    name="categoryId"
                    label={t('products.category')}
                    options={[
                      { value: NONE, label: t('common.none') },
                      ...flattenTree(tree.data ?? []).map((o) => ({ value: o.value, label: o.path })),
                    ]}
                  />
                  <SelectField
                    control={control}
                    name="brandId"
                    label={t('products.brand')}
                    options={[
                      { value: NONE, label: t('common.none') },
                      ...(brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <SelectField
                    control={control}
                    name="baseUnitId"
                    label={t('products.baseUnit')}
                    description={t('products.form.baseUnitHint')}
                    options={unitOptions}
                  />
                  <div className="flex items-end pb-2">
                    <SwitchField control={control} name="isActive" label={t('common.active')} />
                  </div>
                  <TextareaField
                    control={control}
                    name="description"
                    label={t('fields.description')}
                    className="md:col-span-2"
                    rows={4}
                  />
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="pricing"
            forceMount
            className="flex flex-col gap-4 data-[state=inactive]:hidden"
          >
            <Card>
              <CardContent>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <TextField
                    control={control}
                    name="purchasePrice"
                    label={t('products.purchasePrice')}
                    inputMode="decimal"
                  />
                  <TextField
                    control={control}
                    name="salePrice"
                    label={t('products.salePrice')}
                    inputMode="decimal"
                    description={
                      margin !== null
                        ? t('products.form.margin', {
                            margin: formatPercent(margin, { decimals: 1 }),
                            profit: formatCurrency(Number(sale) - Number(purchase)),
                          })
                        : undefined
                    }
                  />
                  <SelectField
                    control={control}
                    name="taxGroupId"
                    label={t('products.taxGroup')}
                    options={[
                      { value: NONE, label: t('common.none') },
                      ...(lookups.data?.taxGroups ?? []).map((g) => ({
                        value: g.id,
                        label: `${g.name} (${g.code})`,
                      })),
                    ]}
                  />
                  <div className="flex items-end pb-2">
                    <SwitchField
                      control={control}
                      name="priceIncludesTax"
                      label={t('products.priceIncludesTax')}
                    />
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('products.units.title')}</CardTitle>
                <CardDescription>{t('products.units.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductUnitsTable form={form} units={lookups.data?.units ?? []} readOnly={readOnly} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardContent>
                <FieldGroup>
                  <TextField
                    control={control}
                    name="reorderLevel"
                    label={t('products.reorderLevel')}
                    description={t('products.form.reorderHint')}
                    inputMode="decimal"
                    className="max-w-xs"
                  />
                  <div
                    className={cn(
                      'flex flex-col gap-4',
                      type === 'service' && 'pointer-events-none opacity-50',
                    )}
                  >
                    <SwitchField
                      control={control}
                      name="trackBatch"
                      label={t('products.trackBatch')}
                      description={t('products.form.trackBatchHint')}
                    />
                    <SwitchField
                      control={control}
                      name="trackSerial"
                      label={t('products.trackSerial')}
                      description={t('products.form.trackSerialHint')}
                    />
                    <SwitchField
                      control={control}
                      name="trackExpiry"
                      label={t('products.trackExpiry')}
                      description={t('products.form.trackExpiryHint')}
                    />
                  </div>
                  {type === 'service' && (
                    <p className="text-sm text-muted-foreground">{t('products.form.serviceNoStock')}</p>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variants" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardContent>
                {attributes.isPending ? (
                  <Spinner />
                ) : (
                  <ProductVariantsTab
                    key={product.data?.updatedAt ?? 'new'}
                    form={form}
                    attributes={attributes.data ?? []}
                    readOnly={readOnly}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </fieldset>

        <TabsContent value="images">
          <Card>
            <CardContent>
              <ProductImagesTab
                productId={isNew ? undefined : id}
                images={product.data?.images ?? []}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  );
}
