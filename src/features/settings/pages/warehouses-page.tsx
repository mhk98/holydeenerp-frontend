import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { v } from '@/lib/form';
import { useAuthStore } from '@/stores/auth-store';
import type { Warehouse } from '@/types';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { Badge } from '@/components/ui/badge';
import { warehousesResource } from '../api/settings-api';

const schema = z.object({
  branchId: z.string().min(1, 'validation.required'),
  name: v.required().max(150, 'validation.tooLong'),
  code: v.code(),
  phone: v.phone(),
  address: z.string().max(1000, 'validation.tooLong'),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function WarehousesPage() {
  const { t } = useTranslation();
  // Only the user's own branches can hold their warehouses.
  const branches = useAuthStore((s) => s.user?.branches ?? []);
  const branchOptions = branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  const empty: Values = {
    branchId: branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? '',
    name: '',
    code: '',
    phone: '',
    address: '',
    isDefault: false,
    isActive: true,
  };

  const columns = useMemo<ColumnDef<Warehouse, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: w } }) => (
          <div className="flex items-center gap-2 font-medium">
            {w.name}
            {w.isDefault && (
              <Badge variant="secondary" className="font-normal">
                {t('settings.warehouses.default')}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((w) => w.code),
      },
      {
        id: 'branch',
        meta: { label: t('fields.branch') },
        enableSorting: false,
        header: t('fields.branch'),
        cell: ({ row }) => `${row.original.branch?.name ?? '—'}`,
      },
      {
        id: 'address',
        meta: { label: t('fields.address') },
        enableSorting: false,
        header: t('fields.address'),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-72 text-muted-foreground">{row.original.address ?? '—'}</span>
        ),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      resource={warehousesResource}
      i18nKey="settings.warehouses"
      columns={columns}
      schema={schema}
      emptyValues={empty}
      toValues={(w) => ({
        branchId: w.branchId,
        name: w.name,
        code: w.code,
        phone: w.phone ?? '',
        address: w.address ?? '',
        isDefault: w.isDefault,
        isActive: w.isActive,
      })}
      toPayload={(values) => ({
        ...values,
        phone: v.nullIfEmpty(values.phone),
        address: v.nullIfEmpty(values.address),
      })}
      filters={[
        { key: 'branchId', label: t('fields.branch'), options: branchOptions },
        {
          key: 'isActive',
          label: t('common.status'),
          options: [
            { value: 'true', label: t('common.active') },
            { value: 'false', label: t('common.inactive') },
          ],
        },
      ]}
      exportColumns={[
        { header: t('fields.name'), value: (w) => w.name },
        { header: t('fields.code'), value: (w) => w.code },
        { header: t('fields.branch'), value: (w) => w.branch?.name },
        { header: t('fields.address'), value: (w) => w.address },
      ]}
      renderFields={({ control }) => (
        <>
          <SelectField control={control} name="branchId" label={t('fields.branch')} options={branchOptions} />
          <TextField
            control={control}
            name="name"
            label={t('fields.name')}
            placeholder="Tejgaon Central Warehouse"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={control} name="code" label={t('fields.code')} placeholder="WH-TEJ" />
            <TextField control={control} name="phone" label={t('fields.phone')} type="tel" />
          </div>
          <TextareaField control={control} name="address" label={t('fields.address')} />
          <SwitchField
            control={control}
            name="isDefault"
            label={t('settings.warehouses.default')}
            description={t('settings.warehouses.defaultHint')}
          />
          <SwitchField control={control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
