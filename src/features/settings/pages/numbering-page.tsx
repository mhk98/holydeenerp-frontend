import { useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { v } from '@/lib/form';
import { formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentSequence } from '@/types';
import { activeColumn, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextField } from '@/components/common/fields';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { sequencesResource, useSequencePreview } from '../api/settings-api';

const DOC_TYPES = [
  'sales_invoice',
  'pos_sale',
  'quotation',
  'sales_order',
  'delivery_note',
  'sales_return',
  'money_receipt',
  'purchase_requisition',
  'purchase_rfq',
  'purchase_order',
  'goods_receipt',
  'purchase_bill',
  'purchase_return',
  'payment_voucher',
  'journal_entry',
  'stock_transfer',
  'stock_adjustment',
  'opening_stock',
  'stock_count',
  'production_order',
  'product_sku',
  'customer_code',
  'supplier_code',
] as const;

const COMPANY_WIDE = 'all';
const affix = z
  .string()
  .max(50, 'validation.tooLong')
  .regex(/^[A-Za-z0-9/._\-{}#]*$/, 'validation.affix')
  .refine((s) => !/\{(?!BRANCH\}|YYYY\}|YY\}|MM\})/.test(s), 'validation.token');

const schema = z.object({
  docType: z.enum(DOC_TYPES),
  name: v.required().max(100, 'validation.tooLong'),
  branchId: z.string(),
  prefix: affix,
  suffix: affix,
  padding: z.string().regex(/^([1-9]|10)$/, 'validation.padding'),
  nextNumber: z.string().regex(/^[1-9]\d{0,8}$/, 'validation.integer'),
  resetYearly: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  docType: 'sales_invoice',
  name: '',
  branchId: COMPANY_WIDE,
  prefix: 'INV-{BRANCH}-{YYYY}-',
  suffix: '',
  padding: '5',
  nextNumber: '1',
  resetYearly: true,
  isActive: true,
};

/** Live "next number" preview while editing (server formats it — same code as real numbering). */
function NumberPreview({ form }: { form: UseFormReturn<Values> }) {
  const { t } = useTranslation();
  const values = useWatch({ control: form.control });
  const draft = useDebouncedValue(
    {
      prefix: values.prefix ?? '',
      suffix: values.suffix ?? '',
      padding: Number(values.padding) || 5,
      nextNumber: Number(values.nextNumber) || 1,
      branchId: values.branchId && values.branchId !== COMPANY_WIDE ? values.branchId : null,
    },
    300,
  );
  const preview = useSequencePreview(draft);

  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-4" aria-live="polite">
      <p className="text-xs text-muted-foreground">{t('settings.numbering.preview')}</p>
      <p className="mt-1 flex items-center gap-2 font-mono text-lg font-semibold">
        {preview.isError ? (
          <span className="text-sm font-normal text-destructive">{t('settings.numbering.previewError')}</span>
        ) : (
          preview.data
        )}
        {preview.isFetching && <Spinner className="size-4 text-muted-foreground" />}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{t('settings.numbering.tokens')}</p>
    </div>
  );
}

export default function NumberingPage() {
  const { t } = useTranslation();
  const branches = useAuthStore((s) => s.user?.branches ?? []);
  const docTypeOptions = DOC_TYPES.map((d) => ({ value: d, label: t(`settings.numbering.docTypes.${d}`) }));
  const branchOptions = [
    { value: COMPANY_WIDE, label: t('settings.numbering.companyWide') },
    ...branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
  ];

  const columns = useMemo<ColumnDef<DocumentSequence, unknown>[]>(
    () => [
      {
        id: 'docType',
        enableHiding: false,
        meta: { label: t('settings.numbering.docType') },
        header: sortableHeader(t('settings.numbering.docType')),
        cell: ({ row: { original: s } }) => (
          <div>
            <p className="font-medium">
              {t(`settings.numbering.docTypes.${s.docType}`, { defaultValue: s.docType })}
            </p>
            <p className="text-xs text-muted-foreground">{s.name}</p>
          </div>
        ),
      },
      {
        id: 'branch',
        meta: { label: t('fields.branch') },
        enableSorting: false,
        header: t('fields.branch'),
        cell: ({ row }) =>
          row.original.branch ? (
            row.original.branch.name
          ) : (
            <Badge variant="outline" className="font-normal">
              {t('settings.numbering.companyWide')}
            </Badge>
          ),
      },
      {
        id: 'format',
        meta: { label: t('settings.numbering.format') },
        enableSorting: false,
        header: t('settings.numbering.format'),
        cell: ({ row: { original: s } }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {s.prefix}
            {'#'.repeat(s.padding)}
            {s.suffix}
          </code>
        ),
      },
      {
        id: 'nextNumber',
        meta: { label: t('settings.numbering.nextNumber') },
        enableSorting: false,
        header: t('settings.numbering.nextNumber'),
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.nextNumber)}</span>,
      },
      {
        id: 'resetYearly',
        meta: { label: t('settings.numbering.resetYearly') },
        enableSorting: false,
        header: t('settings.numbering.resetYearly'),
        cell: ({ row }) => (row.original.resetYearly ? t('common.yes') : t('common.no')),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      resource={sequencesResource}
      i18nKey="settings.numbering"
      defaultSort="docType"
      columns={columns}
      schema={schema}
      rowLabel={(s) => s.name}
      emptyValues={EMPTY}
      toValues={(s) => ({
        docType: s.docType as Values['docType'],
        name: s.name,
        branchId: s.branchId ?? COMPANY_WIDE,
        prefix: s.prefix,
        suffix: s.suffix,
        padding: String(s.padding),
        nextNumber: String(s.nextNumber),
        resetYearly: s.resetYearly,
        isActive: s.isActive,
      })}
      toPayload={(values) => ({
        ...values,
        branchId: values.branchId === COMPANY_WIDE ? null : values.branchId,
        padding: Number(values.padding),
        nextNumber: Number(values.nextNumber),
      })}
      filters={[
        { key: 'docType', label: t('settings.numbering.docType'), options: docTypeOptions },
        { key: 'branchId', label: t('fields.branch'), options: branchOptions.slice(1) },
      ]}
      intro={<p className="mb-4 text-sm text-muted-foreground">{t('settings.numbering.intro')}</p>}
      renderFields={(form, { isEdit }) => (
        <>
          <SelectField
            control={form.control}
            name="docType"
            label={t('settings.numbering.docType')}
            options={docTypeOptions}
            disabled={isEdit}
          />
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            placeholder="Sales invoice — Dhaka"
          />
          <SelectField
            control={form.control}
            name="branchId"
            label={t('fields.branch')}
            options={branchOptions}
            disabled={isEdit}
            description={t('settings.numbering.branchHint')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="prefix"
              label={t('settings.numbering.prefix')}
              className="font-mono"
            />
            <TextField
              control={form.control}
              name="suffix"
              label={t('settings.numbering.suffix')}
              className="font-mono"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="padding"
              label={t('settings.numbering.padding')}
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="nextNumber"
              label={t('settings.numbering.nextNumber')}
              inputMode="numeric"
            />
          </div>
          <NumberPreview form={form} />
          <SwitchField
            control={form.control}
            name="resetYearly"
            label={t('settings.numbering.resetYearly')}
            description={t('settings.numbering.resetYearlyHint')}
          />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
