import { useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Star } from 'lucide-react';
import { v } from '@/lib/form';
import type { PaperSize, PrintTemplate, PrintTemplateOptions } from '@/types';
import { sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { DocumentPreview } from '@/components/common/document-preview';
import { FormField } from '@/components/common/form-field';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { Badge } from '@/components/ui/badge';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { printTemplatesResource, useCompany } from '../api/settings-api';

const DOC_TYPES = [
  'invoice',
  'pos_receipt',
  'quotation',
  'purchase_order',
  'delivery_note',
  'money_receipt',
] as const;
const PAPERS: PaperSize[] = ['a4', 'thermal_80'];
const TOGGLES = [
  'showLogo',
  'showCompanyAddress',
  'showBin',
  'showVatRegNo',
  'showMushakRef',
  'showCustomerDetails',
  'showTaxBreakdown',
  'showAmountInWords',
  'showSignature',
  'showBarcode',
] as const;

/** Same defaults as the server (print-templates.service.js). */
const DEFAULTS: Record<PaperSize, PrintTemplateOptions> = {
  a4: {
    title: 'Tax Invoice',
    showLogo: true,
    showCompanyAddress: true,
    showBin: true,
    showVatRegNo: false,
    showMushakRef: true,
    showCustomerDetails: true,
    showTaxBreakdown: true,
    showAmountInWords: true,
    showSignature: true,
    showBarcode: false,
    accentColor: '#0f172a',
    fontSize: 'md',
    headerText: '',
  },
  thermal_80: {
    title: 'Sales Receipt',
    showLogo: false,
    showCompanyAddress: true,
    showBin: true,
    showVatRegNo: false,
    showMushakRef: false,
    showCustomerDetails: false,
    showTaxBreakdown: true,
    showAmountInWords: false,
    showSignature: false,
    showBarcode: true,
    accentColor: '#000000',
    fontSize: 'sm',
    headerText: '',
  },
};

const schema = z.object({
  name: v.required().max(100, 'validation.tooLong'),
  docType: z.enum(DOC_TYPES),
  paper: z.enum(['a4', 'thermal_80']),
  isDefault: z.boolean(),
  terms: z.string().max(5000, 'validation.tooLong'),
  footerNote: z.string().max(500, 'validation.tooLong'),
  options: z.object({
    title: z.string().max(60, 'validation.tooLong'),
    showLogo: z.boolean(),
    showCompanyAddress: z.boolean(),
    showBin: z.boolean(),
    showVatRegNo: z.boolean(),
    showMushakRef: z.boolean(),
    showCustomerDetails: z.boolean(),
    showTaxBreakdown: z.boolean(),
    showAmountInWords: z.boolean(),
    showSignature: z.boolean(),
    showBarcode: z.boolean(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.color'),
    fontSize: z.enum(['sm', 'md', 'lg']),
    headerText: z.string().max(200, 'validation.tooLong'),
  }),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: '',
  docType: 'invoice',
  paper: 'a4',
  isDefault: false,
  terms: '',
  footerNote: '',
  options: DEFAULTS.a4,
};

function TemplateEditor({ form, isEdit }: { form: UseFormReturn<Values>; isEdit: boolean }) {
  const { t } = useTranslation();
  const company = useCompany();
  const values = useWatch({ control: form.control }) as Values;
  const paper = values.paper ?? 'a4';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-5">
        <TextField control={form.control} name="name" label={t('fields.name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="docType"
            label={t('settings.printTemplates.docType')}
            options={DOC_TYPES.map((d) => ({ value: d, label: t(`settings.printTemplates.docTypes.${d}`) }))}
          />
          <SelectField
            control={form.control}
            name="paper"
            label={t('settings.printTemplates.paper')}
            disabled={isEdit}
            options={PAPERS.map((p) => ({ value: p, label: t(`settings.printTemplates.papers.${p}`) }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <TextField
            control={form.control}
            name="options.title"
            label={t('settings.printTemplates.docTitle')}
          />
          <FormField
            control={form.control}
            name="options.accentColor"
            label={t('settings.printTemplates.color')}
            render={({ field, aria }) => <Input type="color" className="h-9 p-1" {...field} {...aria} />}
          />
        </div>
        <SelectField
          control={form.control}
          name="options.fontSize"
          label={t('settings.printTemplates.fontSize')}
          options={['sm', 'md', 'lg'].map((s) => ({
            value: s,
            label: t(`settings.printTemplates.sizes.${s}`),
          }))}
        />
        <TextField
          control={form.control}
          name="options.headerText"
          label={t('settings.printTemplates.headerText')}
        />
        <FieldSet>
          <FieldLegend>{t('settings.printTemplates.show')}</FieldLegend>
          <div className="grid gap-3">
            {TOGGLES.map((key) => (
              <SwitchField
                key={key}
                control={form.control}
                name={`options.${key}`}
                label={t(`settings.printTemplates.toggles.${key}`)}
              />
            ))}
          </div>
        </FieldSet>
        <TextareaField
          control={form.control}
          name="terms"
          label={t('settings.printTemplates.terms')}
          rows={4}
        />
        <TextField control={form.control} name="footerNote" label={t('settings.printTemplates.footerNote')} />
        <SwitchField
          control={form.control}
          name="isDefault"
          label={t('settings.printTemplates.isDefault')}
          description={t('settings.printTemplates.isDefaultHint')}
        />
      </div>

      <div className="rounded-xl bg-muted p-4" aria-label={t('settings.printTemplates.preview')}>
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {t('settings.printTemplates.preview')}
        </p>
        <div className="overflow-auto">
          <DocumentPreview
            paper={paper}
            options={{ ...DEFAULTS[paper], ...values.options }}
            company={company.data ?? { name: '…' }}
            terms={values.terms}
            footerNote={values.footerNote}
          />
        </div>
      </div>
    </div>
  );
}

export default function PrintTemplatesPage() {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<PrintTemplate, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: p } }) => (
          <div className="flex items-center gap-2 font-medium">
            {p.name}
            {p.isDefault && (
              <Badge variant="secondary" className="gap-1 font-normal">
                <Star className="size-3" aria-hidden /> {t('settings.printTemplates.default')}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'docType',
        meta: { label: t('settings.printTemplates.docType') },
        header: sortableHeader(t('settings.printTemplates.docType')),
        cell: ({ row }) =>
          t(`settings.printTemplates.docTypes.${row.original.docType}`, {
            defaultValue: row.original.docType,
          }),
      },
      {
        id: 'paper',
        meta: { label: t('settings.printTemplates.paper') },
        enableSorting: false,
        header: t('settings.printTemplates.paper'),
        cell: ({ row }) => (
          <Badge variant="outline">{t(`settings.printTemplates.papers.${row.original.paper}`)}</Badge>
        ),
      },
      {
        id: 'accent',
        meta: { label: t('settings.printTemplates.color') },
        enableSorting: false,
        header: t('settings.printTemplates.color'),
        cell: ({ row }) => (
          <span
            className="inline-block size-4 rounded-full border"
            style={{ backgroundColor: row.original.options.accentColor }}
            aria-label={row.original.options.accentColor}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <CrudPage
      resource={printTemplatesResource}
      i18nKey="settings.printTemplates"
      defaultSort="docType"
      columns={columns}
      schema={schema}
      drawerClassName="sm:max-w-6xl"
      emptyValues={EMPTY}
      toValues={(p) => ({
        name: p.name,
        docType: p.docType as Values['docType'],
        paper: p.paper,
        isDefault: p.isDefault,
        terms: p.terms ?? '',
        footerNote: p.footerNote ?? '',
        options: { ...DEFAULTS[p.paper], ...p.options },
      })}
      toPayload={(values, row) => ({
        ...values,
        ...(row && { paper: undefined }),
        terms: v.nullIfEmpty(values.terms),
        footerNote: v.nullIfEmpty(values.footerNote),
      })}
      filters={[
        {
          key: 'docType',
          label: t('settings.printTemplates.docType'),
          options: DOC_TYPES.map((d) => ({ value: d, label: t(`settings.printTemplates.docTypes.${d}`) })),
        },
        {
          key: 'paper',
          label: t('settings.printTemplates.paper'),
          options: PAPERS.map((p) => ({ value: p, label: t(`settings.printTemplates.papers.${p}`) })),
        },
      ]}
      renderFields={(form, { isEdit }) => <TemplateEditor form={form} isEdit={isEdit} />}
    />
  );
}
