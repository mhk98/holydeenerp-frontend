import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { v } from '@/lib/form';
import type { ProductAttribute } from '@/types';
import { ChipsInput } from '@/components/common/chips-input';
import { sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { TextField } from '@/components/common/fields';
import { FormField } from '@/components/common/form-field';
import { Badge } from '@/components/ui/badge';
import { attributesResource } from '../api/products-api';

const schema = z.object({
  name: v.required().max(60, 'validation.tooLong'),
  sortOrder: z.coerce.number().int().min(0, 'validation.nonNegative'),
  values: z
    .array(z.string())
    .min(1, 'validation.required')
    .refine((vals) => new Set(vals.map((x) => x.toLowerCase())).size === vals.length, 'validation.unique'),
});
type Values = z.infer<typeof schema>;
const EMPTY: Values = { name: '', sortOrder: 0, values: [] };

export default function AttributesPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<ProductAttribute, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'values',
        enableSorting: false,
        meta: { label: t('products.attributes.values') },
        header: t('products.attributes.values'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.values.map((x) => (
              <Badge key={x.id} variant="outline" className="font-normal">
                {x.value}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'sortOrder',
        meta: { label: t('products.sortOrder') },
        header: sortableHeader(t('products.sortOrder')),
        cell: ({ row }) => row.original.sortOrder,
      },
    ],
    [t],
  );

  return (
    <CrudPage
      resource={attributesResource}
      i18nKey="products.attributes"
      permission="products"
      defaultSort="sortOrder"
      breadcrumbs={[{ label: t('nav.inventory') }, { label: t('products.attributes.title') }]}
      intro={<p className="mb-4 text-sm text-muted-foreground">{t('products.attributes.intro')}</p>}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      toValues={(a) => ({ name: a.name, sortOrder: a.sortOrder, values: a.values.map((x) => x.value) })}
      renderFields={({ control }) => (
        <>
          <TextField control={control} name="name" label={t('fields.name')} placeholder="Size" />
          <TextField
            control={control}
            name="sortOrder"
            label={t('products.sortOrder')}
            type="number"
            min={0}
          />
          <FormField
            control={control}
            name="values"
            label={t('products.attributes.values')}
            description={t('products.attributes.valuesHint')}
            render={({ field, aria }) => (
              <ChipsInput value={field.value} onChange={field.onChange} placeholder="S, M, L, XL" {...aria} />
            )}
          />
        </>
      )}
    />
  );
}
