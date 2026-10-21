import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { applyServerErrors, v } from '@/lib/form';
import { formatQuantity } from '@/lib/format';
import type { Unit, UnitCategory } from '@/types';
import { Can } from '@/components/common/can';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextField } from '@/components/common/fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { conversionsResource, unitsResource } from '../api/settings-api';

const CATEGORIES: UnitCategory[] = ['count', 'weight', 'volume', 'length', 'area', 'time', 'other'];

const unitSchema = z.object({
  name: v.required().max(60, 'validation.tooLong'),
  code: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(20, 'validation.tooLong')
    .regex(/^[A-Za-z0-9.²³/_-]+$/, 'validation.code'),
  category: z.enum(CATEGORIES),
  allowDecimal: z.boolean(),
  isActive: z.boolean(),
});
type UnitValues = z.infer<typeof unitSchema>;

const conversionSchema = z
  .object({
    fromUnitId: z.string().min(1, 'validation.required'),
    toUnitId: z.string().min(1, 'validation.required'),
    factor: v.decimal(),
  })
  .refine((d) => d.fromUnitId !== d.toUnitId, { path: ['toUnitId'], message: 'validation.differentUnits' });
type ConversionValues = z.infer<typeof conversionSchema>;

/** "1 box = 12 pcs" list with an inline add form. */
function ConversionsCard() {
  const { t } = useTranslation();
  const conversions = conversionsResource.useList({ limit: 100 });
  const units = unitsResource.useOptions({ isActive: 'true' });
  const save = conversionsResource.useSave();
  const remove = conversionsResource.useRemove();
  const [adding, setAdding] = useState(false);
  const form = useForm<ConversionValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: { fromUnitId: '', toUnitId: '', factor: '' },
  });
  const unitOptions = (units.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }));

  const onSubmit = form.handleSubmit((data) =>
    save.mutate(
      { data },
      {
        onSuccess: () => {
          toast.success(t('settings.units.conversionAdded'));
          form.reset({ fromUnitId: '', toUnitId: '', factor: '' });
          setAdding(false);
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t('settings.units.conversionsTitle')}</CardTitle>
          <CardDescription>{t('settings.units.conversionsDescription')}</CardDescription>
        </div>
        <Can permission="settings.create">
          {!adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden /> {t('settings.units.addConversion')}
            </Button>
          )}
        </Can>
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <form
            onSubmit={onSubmit}
            noValidate
            className="grid items-start gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-[1fr_8rem_1fr_auto]"
          >
            <SelectField
              control={form.control}
              name="fromUnitId"
              label={t('settings.units.from')}
              options={unitOptions}
              placeholder="box"
            />
            <TextField
              control={form.control}
              name="factor"
              label={t('settings.units.equals')}
              inputMode="decimal"
              placeholder="12"
            />
            <SelectField
              control={form.control}
              name="toUnitId"
              label={t('settings.units.to')}
              options={unitOptions}
              placeholder="pcs"
            />
            <div className="flex gap-2 sm:pt-6">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Spinner />}
                {t('common.save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}
        <ul className="divide-y rounded-lg border">
          {conversions.isPending && (
            <li className="p-3">
              <Skeleton className="h-8" />
            </li>
          )}
          {conversions.data?.rows.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">{t('settings.units.noConversions')}</li>
          )}
          {conversions.data?.rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">1 {c.fromUnit.name}</span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium tabular-nums">{formatQuantity(c.factor, { decimals: 6 })}</span>{' '}
                {c.toUnit.name}
              </span>
              <Can permission="settings.delete">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={t('common.delete')}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(c.id, {
                      onSuccess: () => toast.success(t('settings.units.conversionDeleted')),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </Can>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function UnitsPage() {
  const { t } = useTranslation();
  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: t(`settings.units.categories.${c}`) }));

  const columns = useMemo<ColumnDef<Unit, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((u) => u.code),
      },
      {
        id: 'category',
        meta: { label: t('settings.units.category') },
        header: sortableHeader(t('settings.units.category')),
        cell: ({ row }) => t(`settings.units.categories.${row.original.category}`),
      },
      {
        id: 'allowDecimal',
        meta: { label: t('settings.units.allowDecimal') },
        enableSorting: false,
        header: t('settings.units.allowDecimal'),
        cell: ({ row }) => (row.original.allowDecimal ? t('common.yes') : t('common.no')),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <>
      <CrudPage
        resource={unitsResource}
        i18nKey="settings.units"
        columns={columns}
        schema={unitSchema}
        emptyValues={
          { name: '', code: '', category: 'count', allowDecimal: false, isActive: true } satisfies UnitValues
        }
        toValues={(u) => ({
          name: u.name,
          code: u.code,
          category: u.category,
          allowDecimal: u.allowDecimal,
          isActive: u.isActive,
        })}
        filters={[{ key: 'category', label: t('settings.units.category'), options: categoryOptions }]}
        renderFields={({ control }) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={control} name="name" label={t('fields.name')} placeholder="Box" />
              <TextField control={control} name="code" label={t('fields.code')} placeholder="box" />
            </div>
            <SelectField
              control={control}
              name="category"
              label={t('settings.units.category')}
              options={categoryOptions}
            />
            <SwitchField
              control={control}
              name="allowDecimal"
              label={t('settings.units.allowDecimal')}
              description={t('settings.units.allowDecimalHint')}
            />
            <SwitchField control={control} name="isActive" label={t('common.active')} />
          </>
        )}
      />
      <ConversionsCard />
    </>
  );
}
