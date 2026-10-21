import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Archive, CheckCircle2, Copy, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/format';
import { applyServerErrors, v } from '@/lib/form';
import type { StockItem } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ItemPicker } from '@/features/inventory/components/item-picker';
import { itemLabel } from '@/features/inventory/lib';
import {
  useBom,
  useBomAction,
  useSaveBom,
  workCentersResource,
  type BomAction,
} from '../api/manufacturing-api';
import { BomTreeCard } from '../components/bom-tree';
import { BOM_TONE, MFG_ROUTES, productLabel } from '../lib';
import type { Bom } from '../types';

const qty = () => v.decimal({ scale: 4 });
const percent = () => v.decimal({ scale: 4, allowZero: true, max: 100 });
const minutes = () => v.decimal({ scale: 2, allowZero: true });
const item = { productId: z.string(), variantId: z.string().nullable(), label: z.string(), unit: z.string() };

const schema = z.object({
  code: v.code(40),
  name: v.required().max(150, 'validation.tooLong'),
  productId: v.required(),
  variantId: z.string().nullable(),
  productName: z.string(),
  quantity: qty(),
  notes: z.string().max(2000, 'validation.tooLong'),
  items: z
    .array(
      z.object({
        ...item,
        quantity: qty(),
        wastagePercent: percent(),
        notes: z.string().max(255, 'validation.tooLong'),
      }),
    )
    .min(1, 'manufacturing.validation.components'),
  byproducts: z.array(z.object({ ...item, quantity: qty(), costSharePercent: percent() })),
  operations: z.array(
    z.object({
      name: v.required().max(150, 'validation.tooLong'),
      workCenterId: v.required(),
      setupMinutes: minutes(),
      runMinutes: minutes(),
    }),
  ),
  qualityChecks: z.array(
    z.object({
      name: v.required().max(150, 'validation.tooLong'),
      instructions: z.string().max(500, 'validation.tooLong'),
    }),
  ),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  code: '',
  name: '',
  productId: '',
  variantId: null,
  productName: '',
  quantity: '1',
  notes: '',
  items: [],
  byproducts: [],
  operations: [],
  qualityChecks: [],
};
const n = (s: string) => String(Number(s));

function toValues(b: Bom): Values {
  return {
    code: b.code,
    name: b.name,
    productId: b.productId,
    variantId: b.variantId,
    productName: productLabel(b.product, b.variant),
    quantity: n(b.quantity),
    notes: b.notes ?? '',
    items: (b.components ?? []).map((c) => ({
      productId: c.productId,
      variantId: c.variantId,
      label: productLabel(c.product, c.variant),
      unit: c.unit?.code ?? '',
      quantity: n(c.quantity),
      wastagePercent: n(c.wastagePercent),
      notes: c.notes ?? '',
    })),
    byproducts: (b.byproducts ?? []).map((p) => ({
      productId: p.productId,
      variantId: p.variantId,
      label: productLabel(p.product, p.variant),
      unit: '',
      quantity: n(p.quantity),
      costSharePercent: n(p.costSharePercent),
    })),
    operations: (b.operations ?? []).map((o) => ({
      name: o.name,
      workCenterId: o.workCenterId,
      setupMinutes: n(o.setupMinutes),
      runMinutes: n(o.runMinutes),
    })),
    qualityChecks: (b.qualityChecks ?? []).map((q) => ({ name: q.name, instructions: q.instructions ?? '' })),
  };
}

const pickLine = (i: StockItem) => ({
  productId: i.productId,
  variantId: i.variantId,
  label: itemLabel(i),
  unit: i.baseUnit.code,
});

/** Create or edit a draft bill of materials; view, activate, version and archive saved ones. */
export default function BomPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const bom = useBom(isNew ? null : id);
  const save = useSaveBom();
  const action = useBomAction();
  const centers = workCentersResource.useOptions({ isActive: 'true' });
  const [confirm, setConfirm] = useState<BomAction | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema) as Resolver<Values>, defaultValues: EMPTY });
  const { control, reset, setValue } = form;
  const items = useFieldArray({ control, name: 'items' });
  const byproducts = useFieldArray({ control, name: 'byproducts' });
  const operations = useFieldArray({ control, name: 'operations' });
  const checks = useFieldArray({ control, name: 'qualityChecks' });
  const productName = useWatch({ control, name: 'productName' });
  const { errors } = form.formState;
  const itemsError = errors.items?.root?.message ?? errors.items?.message;

  const loaded = bom.data;
  useEffect(() => {
    if (loaded) reset(toValues(loaded));
  }, [loaded, reset]);

  const status = loaded?.status ?? 'draft';
  const editable = status === 'draft' && can(isNew ? 'manufacturing.create' : 'manufacturing.update');
  const busy = save.isPending || action.isPending;

  const onSave = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: isNew ? undefined : id,
        data: {
          code: values.code,
          name: values.name,
          productId: values.productId,
          variantId: values.variantId,
          quantity: values.quantity,
          notes: v.nullIfEmpty(values.notes),
          items: values.items.map((c) => ({
            productId: c.productId,
            variantId: c.variantId,
            unitId: null,
            quantity: c.quantity,
            wastagePercent: c.wastagePercent,
            notes: v.nullIfEmpty(c.notes),
          })),
          byproducts: values.byproducts.map((b) => ({
            productId: b.productId,
            variantId: b.variantId,
            quantity: b.quantity,
            costSharePercent: b.costSharePercent,
          })),
          operations: values.operations.map((o) => ({ ...o, notes: null })),
          qualityChecks: values.qualityChecks.map((q) => ({
            name: q.name,
            instructions: v.nullIfEmpty(q.instructions),
          })),
        },
      });
      toast.success(t('manufacturing.boms.saved'));
      if (isNew) navigate(`${MFG_ROUTES.boms}/${saved.id}`, { replace: true });
    } catch (err) {
      if (applyServerErrors(err as Error, form.setError)) toast.error(t('manufacturing.fixErrors'));
      else toast.error((err as Error).message);
    }
  });

  const run = (name: BomAction) =>
    action.mutate(
      { id: id!, action: name },
      {
        onSuccess: (result) => {
          toast.success(t(`manufacturing.boms.toast.${name}`));
          setConfirm(null);
          if (name === 'delete') navigate(MFG_ROUTES.boms);
          if (name === 'new-version' && result) navigate(`${MFG_ROUTES.boms}/${result.id}`);
        },
        onError: (err) => {
          toast.error(err.message);
          setConfirm(null);
        },
      },
    );

  if (!isNew && bom.isPending) return <PageSkeleton />;

  const cost = loaded?.standardCost;
  const title = isNew ? t('manufacturing.boms.new') : `${loaded?.code} · v${loaded?.version}`;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <PageHeader
        title={title}
        description={
          loaded ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={BOM_TONE[status]}>{t(`manufacturing.bomStatus.${status}`)}</StatusBadge>
              {loaded.isDefault && (
                <span className="flex items-center gap-1 text-sm">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  {t('manufacturing.boms.default')}
                </span>
              )}
              {loaded.name}
            </span>
          ) : (
            t('manufacturing.boms.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.manufacturing') },
          { label: t('manufacturing.boms.title'), to: MFG_ROUTES.boms },
          { label: isNew ? t('common.new') : (loaded?.code ?? '') },
        ]}
        actions={
          <>
            {!isNew && status !== 'active' && can('manufacturing.delete') && (
              <Button type="button" variant="ghost" onClick={() => setConfirm('delete')} disabled={busy}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {!isNew && status !== 'draft' && can('manufacturing.create') && (
              <Button type="button" variant="outline" onClick={() => run('new-version')} disabled={busy}>
                <Copy aria-hidden /> {t('manufacturing.boms.newVersion')}
              </Button>
            )}
            {status === 'active' && can('manufacturing.approve') && (
              <>
                {!loaded?.isDefault && (
                  <Button type="button" variant="outline" onClick={() => run('default')} disabled={busy}>
                    <Star aria-hidden /> {t('manufacturing.boms.makeDefault')}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setConfirm('archive')} disabled={busy}>
                  <Archive aria-hidden /> {t('manufacturing.boms.archive')}
                </Button>
              </>
            )}
            {editable && (
              <Button type="button" variant="outline" onClick={onSave} disabled={busy}>
                {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('common.save')}
              </Button>
            )}
            {!isNew && status === 'draft' && can('manufacturing.approve') && (
              <Button
                type="button"
                onClick={() =>
                  form.formState.isDirty
                    ? toast.error(t('manufacturing.boms.saveFirst'))
                    : setConfirm('activate')
                }
                disabled={busy}
              >
                <CheckCircle2 aria-hidden /> {t('manufacturing.boms.activate')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <fieldset disabled={!editable || busy} className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('manufacturing.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    control={control}
                    name="code"
                    label={t('fields.code')}
                    placeholder="BOM-HAMPER"
                  />
                  <TextField control={control} name="name" label={t('fields.name')} />
                </div>
                <FormField
                  control={control}
                  name="productId"
                  label={t('manufacturing.boms.makes')}
                  description={t('manufacturing.boms.makesHint')}
                  render={() => (
                    <div className="flex flex-col gap-2">
                      {productName && <div className="text-sm font-medium">{productName}</div>}
                      {editable && (
                        <ItemPicker
                          onPick={(i) => {
                            setValue('productId', i.productId, { shouldDirty: true, shouldValidate: true });
                            setValue('variantId', i.variantId, { shouldDirty: true });
                            setValue('productName', itemLabel(i), { shouldDirty: true });
                            if (!form.getValues('name')) setValue('name', itemLabel(i));
                          }}
                        />
                      )}
                    </div>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    control={control}
                    name="quantity"
                    inputMode="decimal"
                    label={t('manufacturing.boms.output')}
                    description={t('manufacturing.boms.outputHint')}
                  />
                </div>
                <TextareaField control={control} name="notes" label={t('manufacturing.notes')} rows={2} />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('manufacturing.boms.components')}</CardTitle>
              <CardDescription>{t('manufacturing.boms.componentsHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {editable && (
                <ItemPicker
                  onPick={(i) =>
                    items.append({ ...pickLine(i), quantity: '1', wastagePercent: '0', notes: '' })
                  }
                />
              )}
              {itemsError && (
                <p role="alert" className="text-sm text-destructive">
                  {t(itemsError)}
                </p>
              )}
              {items.fields.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('manufacturing.product')}</TableHead>
                        <TableHead className="w-32 text-right">{t('manufacturing.quantity')}</TableHead>
                        <TableHead className="w-28 text-right">{t('manufacturing.boms.wastage')}</TableHead>
                        <TableHead>{t('manufacturing.notes')}</TableHead>
                        {editable && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.fields.map((f, i) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.label}</TableCell>
                          <TableCell>
                            <FormField
                              control={control}
                              name={`items.${i}.quantity`}
                              render={({ field, aria }) => (
                                <div className="flex items-center gap-1">
                                  <Input {...field} {...aria} inputMode="decimal" className="text-right" />
                                  {f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
                                </div>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={control}
                              name={`items.${i}.wastagePercent`}
                              render={({ field, aria }) => (
                                <div className="flex items-center gap-1">
                                  <Input {...field} {...aria} inputMode="decimal" className="text-right" />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={control}
                              name={`items.${i}.notes`}
                              render={({ field, aria }) => <Input {...field} {...aria} />}
                            />
                          </TableCell>
                          {editable && (
                            <TableCell>
                              <RemoveButton onClick={() => items.remove(i)} label={f.label} />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('manufacturing.boms.operations')}</CardTitle>
              <CardDescription>{t('manufacturing.boms.operationsHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {operations.fields.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>{t('manufacturing.operation')}</TableHead>
                        <TableHead>{t('manufacturing.workCenter')}</TableHead>
                        <TableHead className="w-28 text-right">{t('manufacturing.boms.setup')}</TableHead>
                        <TableHead className="w-28 text-right">{t('manufacturing.boms.run')}</TableHead>
                        {editable && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.fields.map((f, i) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-muted-foreground tabular-nums">{(i + 1) * 10}</TableCell>
                          <TableCell>
                            <FormField
                              control={control}
                              name={`operations.${i}.name`}
                              render={({ field, aria }) => <Input {...field} {...aria} />}
                            />
                          </TableCell>
                          <TableCell className="min-w-44">
                            <FormField
                              control={control}
                              name={`operations.${i}.workCenterId`}
                              render={({ field, aria }) => (
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={!editable}
                                >
                                  <SelectTrigger className="w-full" {...aria}>
                                    <SelectValue placeholder={t('manufacturing.pickWorkCenter')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(centers.data ?? []).map((w) => (
                                      <SelectItem key={w.id} value={w.id}>
                                        {w.code} · {w.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </TableCell>
                          {(['setupMinutes', 'runMinutes'] as const).map((k) => (
                            <TableCell key={k}>
                              <FormField
                                control={control}
                                name={`operations.${i}.${k}`}
                                render={({ field, aria }) => (
                                  <Input {...field} {...aria} inputMode="decimal" className="text-right" />
                                )}
                              />
                            </TableCell>
                          ))}
                          {editable && (
                            <TableCell>
                              <RemoveButton onClick={() => operations.remove(i)} label={f.name} />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    operations.append({ name: '', workCenterId: '', setupMinutes: '0', runMinutes: '0' })
                  }
                >
                  <Plus aria-hidden /> {t('manufacturing.boms.addOperation')}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('manufacturing.boms.byproducts')}</CardTitle>
                <CardDescription>{t('manufacturing.boms.byproductsHint')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {byproducts.fields.map((f, i) => (
                  <div key={f.id} className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium">
                      {f.label}
                      {editable && <RemoveButton onClick={() => byproducts.remove(i)} label={f.label} />}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        control={control}
                        name={`byproducts.${i}.quantity`}
                        inputMode="decimal"
                        label={t('manufacturing.quantity')}
                      />
                      <TextField
                        control={control}
                        name={`byproducts.${i}.costSharePercent`}
                        inputMode="decimal"
                        label={t('manufacturing.boms.costShare')}
                      />
                    </div>
                  </div>
                ))}
                {editable && (
                  <ItemPicker
                    onPick={(i) =>
                      byproducts.append({ ...pickLine(i), quantity: '1', costSharePercent: '0' })
                    }
                  />
                )}
                {!editable && byproducts.fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('common.none')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('manufacturing.boms.qualityChecks')}</CardTitle>
                <CardDescription>{t('manufacturing.boms.qualityChecksHint')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {checks.fields.map((f, i) => (
                  <div key={f.id} className="flex items-start gap-2">
                    <div className="flex flex-1 flex-col gap-2">
                      <TextField
                        control={control}
                        name={`qualityChecks.${i}.name`}
                        label={t('fields.name')}
                      />
                      <TextField
                        control={control}
                        name={`qualityChecks.${i}.instructions`}
                        label={t('manufacturing.boms.instructions')}
                      />
                    </div>
                    {editable && <RemoveButton onClick={() => checks.remove(i)} label={f.name} />}
                  </div>
                ))}
                {editable && (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    onClick={() => checks.append({ name: '', instructions: '' })}
                  >
                    <Plus aria-hidden /> {t('manufacturing.boms.addCheck')}
                  </Button>
                )}
                {!editable && checks.fields.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('common.none')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </fieldset>

        <div className="flex flex-col gap-4">
          {cost && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('manufacturing.boms.standardCost')}</CardTitle>
                <CardDescription>
                  {t('manufacturing.boms.standardCostFor', { quantity: formatQuantity(cost.quantity) })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  {(['material', 'labour', 'overhead'] as const).map((k) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{t(`manufacturing.cost.${k}`)}</dt>
                      <dd className="text-right tabular-nums">{formatCurrency(cost[k])}</dd>
                    </div>
                  ))}
                  {Number(cost.byproductCost) > 0 && (
                    <>
                      <dt className="text-muted-foreground">{t('manufacturing.cost.byproducts')}</dt>
                      <dd className="text-right tabular-nums">−{formatCurrency(cost.byproductCost)}</dd>
                    </>
                  )}
                  <dt className="border-t pt-2 font-medium">{t('manufacturing.cost.unit')}</dt>
                  <dd className="border-t pt-2 text-right text-base font-semibold tabular-nums">
                    {formatCurrency(cost.unitCost)}
                  </dd>
                </dl>
              </CardContent>
            </Card>
          )}
          {loaded && <BomTreeCard bomId={loaded.id} defaultQuantity={loaded.quantity} />}
          {loaded?.activatedAt && (
            <p className="text-xs text-muted-foreground">
              {t('manufacturing.boms.activatedBy', {
                name: loaded.activator?.name ?? '—',
                at: formatDateTime(loaded.activatedAt),
              })}
            </p>
          )}
          {!isNew && (
            <Button variant="link" asChild className="self-start px-0">
              <Link to={`${MFG_ROUTES.orders}/new?bomId=${id}`}>{t('manufacturing.orders.newFromBom')}</Link>
            </Button>
          )}
        </div>
      </div>

      {(['activate', 'archive', 'delete'] as const).map((name) => (
        <ConfirmDialog
          key={name}
          open={confirm === name}
          onOpenChange={(o) => !o && setConfirm(null)}
          destructive={name !== 'activate'}
          title={t(`manufacturing.boms.confirm.${name}Title`)}
          description={t(`manufacturing.boms.confirm.${name}Text`)}
          confirmLabel={t(name === 'delete' ? 'common.delete' : `manufacturing.boms.${name}`)}
          loading={action.isPending}
          onConfirm={() => run(name)}
        />
      ))}
    </form>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={onClick}
      aria-label={`${t('common.remove')} ${label}`}
    >
      <X aria-hidden />
    </Button>
  );
}
