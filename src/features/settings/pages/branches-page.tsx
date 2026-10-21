import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Star } from 'lucide-react';
import { v } from '@/lib/form';
import type { BranchRecord } from '@/types';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { Badge } from '@/components/ui/badge';
import { branchesResource } from '../api/settings-api';

const schema = z.object({
  name: v.required().max(150, 'validation.tooLong'),
  code: v.code(),
  email: v.optionalEmail(),
  phone: v.phone(),
  address: z.string().max(1000, 'validation.tooLong'),
  isHeadOffice: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const empty: Values = {
  name: '',
  code: '',
  email: '',
  phone: '',
  address: '',
  isHeadOffice: false,
  isActive: true,
};

export default function BranchesPage() {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<BranchRecord, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: b } }) => (
          <div className="flex items-center gap-2 font-medium">
            {b.name}
            {b.isHeadOffice && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <Star className="size-3" aria-hidden /> {t('settings.branches.headOffice')}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((b) => b.code),
      },
      {
        id: 'phone',
        meta: { label: t('fields.phone') },
        enableSorting: false,
        header: t('fields.phone'),
        cell: ({ row }) => row.original.phone ?? '—',
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
      resource={branchesResource}
      i18nKey="settings.branches"
      columns={columns}
      schema={schema}
      emptyValues={empty}
      toValues={(b) => ({
        name: b.name,
        code: b.code,
        email: b.email ?? '',
        phone: b.phone ?? '',
        address: b.address ?? '',
        isHeadOffice: b.isHeadOffice,
        isActive: b.isActive,
      })}
      toPayload={(values) => ({
        ...values,
        email: v.nullIfEmpty(values.email),
        phone: v.nullIfEmpty(values.phone),
        address: v.nullIfEmpty(values.address),
      })}
      canDelete={(b) => !b.isHeadOffice}
      filters={[
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
        { header: t('fields.name'), value: (b) => b.name },
        { header: t('fields.code'), value: (b) => b.code },
        { header: t('fields.phone'), value: (b) => b.phone },
        { header: t('fields.email'), value: (b) => b.email },
        { header: t('fields.address'), value: (b) => b.address },
      ]}
      renderFields={({ control }) => (
        <>
          <TextField control={control} name="name" label={t('fields.name')} placeholder="Khulna Branch" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={control}
              name="code"
              label={t('fields.code')}
              placeholder="KHL"
              description={t('settings.branches.codeHint')}
            />
            <TextField control={control} name="phone" label={t('fields.phone')} type="tel" />
          </div>
          <TextField control={control} name="email" label={t('fields.email')} type="email" />
          <TextareaField control={control} name="address" label={t('fields.address')} />
          <SwitchField
            control={control}
            name="isHeadOffice"
            label={t('settings.branches.headOffice')}
            description={t('settings.branches.headOfficeHint')}
          />
          <SwitchField control={control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
