import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { formatCurrency } from '@/lib/format';
import { v } from '@/lib/form';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { workCentersResource } from '../api/manufacturing-api';
import { MFG_ROUTES } from '../lib';
import type { WorkCenter } from '../types';

const schema = z.object({
  code: v.code(),
  name: v.required().max(150, 'validation.tooLong'),
  capacityHours: v.decimal({ scale: 2, max: 24 }),
  labourCostPerHour: v.decimal({ scale: 4, allowZero: true }),
  overheadCostPerHour: v.decimal({ scale: 4, allowZero: true }),
  notes: z.string().max(500, 'validation.tooLong'),
  isActive: z.boolean(),
});

/** Work centers: where operations run, with their capacity and hourly labour / overhead rates. */
export default function WorkCentersPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<WorkCenter, unknown>[]>(
    () => [
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((c) => c.code),
      },
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'capacity',
        enableSorting: false,
        meta: { label: t('manufacturing.workCenters.capacity'), cellClassName: 'tabular-nums' },
        header: t('manufacturing.workCenters.capacity'),
        cell: ({ row }) =>
          t('manufacturing.workCenters.hoursPerDay', { hours: Number(row.original.capacityHours) }),
      },
      {
        id: 'labour',
        enableSorting: false,
        meta: {
          label: t('manufacturing.workCenters.labour'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('manufacturing.workCenters.labour'),
        cell: ({ row }) => formatCurrency(row.original.labourCostPerHour),
      },
      {
        id: 'overhead',
        enableSorting: false,
        meta: {
          label: t('manufacturing.workCenters.overhead'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('manufacturing.workCenters.overhead'),
        cell: ({ row }) => formatCurrency(row.original.overheadCostPerHour),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      resource={workCentersResource}
      i18nKey="manufacturing.workCenters"
      breadcrumbs={[
        { label: t('nav.manufacturing') },
        { label: t('manufacturing.boms.title'), to: MFG_ROUTES.boms },
        { label: t('manufacturing.workCenters.title') },
      ]}
      permission="manufacturing"
      defaultSort="code"
      columns={columns}
      schema={schema}
      emptyValues={{
        code: '',
        name: '',
        capacityHours: '8',
        labourCostPerHour: '0',
        overheadCostPerHour: '0',
        notes: '',
        isActive: true,
      }}
      toValues={(c) => ({
        code: c.code,
        name: c.name,
        capacityHours: String(Number(c.capacityHours)),
        labourCostPerHour: String(Number(c.labourCostPerHour)),
        overheadCostPerHour: String(Number(c.overheadCostPerHour)),
        notes: c.notes ?? '',
        isActive: c.isActive,
      })}
      toPayload={(values) => ({ ...values, notes: v.nullIfEmpty(values.notes) })}
      renderFields={(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="code" label={t('fields.code')} placeholder="ASSY" />
            <TextField
              control={form.control}
              name="capacityHours"
              inputMode="decimal"
              label={t('manufacturing.workCenters.capacity')}
              description={t('manufacturing.workCenters.capacityHint')}
            />
          </div>
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            placeholder={t('manufacturing.workCenters.namePlaceholder')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="labourCostPerHour"
              inputMode="decimal"
              label={t('manufacturing.workCenters.labourPerHour')}
            />
            <TextField
              control={form.control}
              name="overheadCostPerHour"
              inputMode="decimal"
              label={t('manufacturing.workCenters.overheadPerHour')}
            />
          </div>
          <TextareaField control={form.control} name="notes" label={t('manufacturing.notes')} rows={2} />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
