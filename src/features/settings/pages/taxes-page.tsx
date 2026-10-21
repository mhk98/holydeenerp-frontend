import { useMemo, useState } from 'react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ArrowDown, ArrowUp, Calculator, Plus, X } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { v } from '@/lib/form';
import { formatCurrency, formatPercent } from '@/lib/format';
import type { TaxGroup, TaxRate, TaxType } from '@/types';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { taxGroupsResource, taxRatesResource, useTaxCalculation } from '../api/settings-api';

const TYPES: TaxType[] = ['vat', 'sd', 'ait', 'other'];

// ── Tax rates ──────────────────────────────────────────────────────────────
const rateSchema = z.object({
  name: v.required().max(100, 'validation.tooLong'),
  code: v.code(),
  type: z.enum(TYPES),
  rate: v.decimal({ scale: 4, allowZero: true, max: 100 }),
  description: z.string().max(255, 'validation.tooLong'),
  isActive: z.boolean(),
});

function TaxRatesTab() {
  const { t } = useTranslation();
  const typeOptions = TYPES.map((type) => ({ value: type, label: t(`settings.taxes.types.${type}`) }));
  const columns = useMemo<ColumnDef<TaxRate, unknown>[]>(
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
        cell: codeCell((r) => r.code),
      },
      {
        id: 'type',
        meta: { label: t('fields.type') },
        enableSorting: false,
        header: t('fields.type'),
        cell: ({ row }) => <Badge variant="outline">{t(`settings.taxes.types.${row.original.type}`)}</Badge>,
      },
      {
        id: 'rate',
        meta: { label: t('settings.taxes.rate') },
        header: sortableHeader(t('settings.taxes.rate')),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatPercent(row.original.rate, { decimals: 2 })}</span>
        ),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      embedded
      resource={taxRatesResource}
      i18nKey="settings.taxRates"
      columns={columns}
      schema={rateSchema}
      emptyValues={{ name: '', code: '', type: 'vat', rate: '', description: '', isActive: true }}
      toValues={(r) => ({
        name: r.name,
        code: r.code,
        type: r.type,
        rate: Number(r.rate).toString(),
        description: r.description ?? '',
        isActive: r.isActive,
      })}
      toPayload={(values) => ({ ...values, description: v.nullIfEmpty(values.description) })}
      filters={[{ key: 'type', label: t('fields.type'), options: typeOptions }]}
      renderFields={({ control }) => (
        <>
          <TextField control={control} name="name" label={t('fields.name')} placeholder="VAT 15%" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={control} name="code" label={t('fields.code')} placeholder="VAT15" />
            <SelectField control={control} name="type" label={t('fields.type')} options={typeOptions} />
          </div>
          <TextField
            control={control}
            name="rate"
            label={t('settings.taxes.ratePercent')}
            inputMode="decimal"
            placeholder="15"
          />
          <TextareaField control={control} name="description" label={t('fields.description')} rows={2} />
          <SwitchField control={control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}

// ── Tax groups ─────────────────────────────────────────────────────────────
const groupSchema = z.object({
  name: v.required().max(100, 'validation.tooLong'),
  code: v.code(),
  description: z.string().max(255, 'validation.tooLong'),
  isActive: z.boolean(),
  rates: z
    .array(z.object({ taxRateId: z.string(), isCompound: z.boolean() }))
    .refine((r) => new Set(r.map((x) => x.taxRateId)).size === r.length, 'validation.duplicateRate'),
});
type GroupValues = z.infer<typeof groupSchema>;

/** Ordered list of rates in a group with compound toggles. */
function GroupRatesEditor({ form }: { form: UseFormReturn<GroupValues> }) {
  const { t } = useTranslation();
  const rates = taxRatesResource.useOptions({ isActive: 'true' });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'rates' });
  const selected = useWatch({ control: form.control, name: 'rates' });
  const [adding, setAdding] = useState('');
  const byId = new Map((rates.data ?? []).map((r) => [r.id, r]));
  const available = (rates.data ?? []).filter((r) => !selected.some((s) => s.taxRateId === r.id));
  const error = form.formState.errors.rates;

  return (
    <FieldSet data-invalid={Boolean(error)}>
      <FieldLegend>{t('settings.taxes.groupRates')}</FieldLegend>
      <p className="text-sm text-muted-foreground">{t('settings.taxes.groupRatesHint')}</p>
      <ol className="space-y-2">
        {fields.map((f, i) => {
          const rate = byId.get(selected[i]?.taxRateId);
          return (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border p-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rate?.name ?? '…'}</p>
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={selected[i]?.isCompound ?? false}
                    onCheckedChange={(c) => form.setValue(`rates.${i}.isCompound`, c, { shouldDirty: true })}
                    disabled={i === 0}
                    aria-label={t('settings.taxes.compound')}
                  />
                  {t('settings.taxes.compoundHint')}
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                aria-label={t('common.moveUp')}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={i === fields.length - 1}
                onClick={() => move(i, i + 1)}
                aria-label={t('common.moveDown')}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
                aria-label={t('common.remove')}
              >
                <X aria-hidden />
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <Select value={adding} onValueChange={setAdding}>
          <SelectTrigger className="flex-1" aria-label={t('settings.taxes.addRate')}>
            <SelectValue placeholder={t('settings.taxes.chooseRate')} />
          </SelectTrigger>
          <SelectContent>
            {available.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={!adding}
          onClick={() => {
            append({ taxRateId: adding, isCompound: selected.length > 0 });
            setAdding('');
          }}
        >
          <Plus aria-hidden /> {t('settings.taxes.addRate')}
        </Button>
      </div>
      {error?.message && <FieldError>{t(error.message)}</FieldError>}
    </FieldSet>
  );
}

/** Try a group on an amount — breakdown computed by the server (same code as invoices). */
function TaxCalculatorCard() {
  const { t } = useTranslation();
  const groups = taxGroupsResource.useOptions({ isActive: 'true' });
  const [groupId, setGroupId] = useState<string | null>(null);
  const [amount, setAmount] = useState('1000');
  const [inclusive, setInclusive] = useState(false);
  const debounced = useDebouncedValue(amount, 300);
  const effectiveGroup = groupId ?? groups.data?.[0]?.id ?? null;
  const calc = useTaxCalculation(effectiveGroup, debounced, inclusive);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4" aria-hidden /> {t('settings.taxes.calculator')}
        </CardTitle>
        <CardDescription>{t('settings.taxes.calculatorHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="calc-group">{t('settings.taxes.group')}</Label>
            <Select value={effectiveGroup ?? ''} onValueChange={setGroupId}>
              <SelectTrigger id="calc-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(groups.data ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calc-amount">{t('settings.taxes.amount')}</Label>
            <Input
              id="calc-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={inclusive} onCheckedChange={setInclusive} />
            {t('settings.taxes.inclusive')}
          </label>
        </div>
        {calc.data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.taxes.tax')}</TableHead>
                <TableHead className="text-right">{t('settings.taxes.taxable')}</TableHead>
                <TableHead className="text-right">{t('settings.taxes.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              <TableRow>
                <TableCell className="text-muted-foreground">{t('settings.taxes.net')}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatCurrency(calc.data.netAmount)}</TableCell>
              </TableRow>
              {calc.data.taxes.map((tax, i) => (
                <TableRow key={`${tax.id}-${i}`}>
                  <TableCell>
                    {tax.name}{' '}
                    {tax.isCompound && (
                      <Badge variant="outline" className="ml-1">
                        {t('settings.taxes.compound')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(tax.taxableAmount)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(tax.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>
                  {t('settings.taxes.total')}{' '}
                  <span className="font-normal text-muted-foreground">
                    (
                    {t('settings.taxes.effective', {
                      rate: formatPercent(calc.data.effectiveRate, { decimals: 2 }),
                    })}
                    )
                  </span>
                </TableCell>
                <TableCell />
                <TableCell className="text-right">{formatCurrency(calc.data.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TaxGroupsTab() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<TaxGroup, unknown>[]>(
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
        cell: codeCell((g) => g.code),
      },
      {
        id: 'rates',
        meta: { label: t('settings.taxes.groupRates') },
        enableSorting: false,
        header: t('settings.taxes.groupRates'),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {row.original.rates.map((r, i) => (
              <span key={r.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">{r.isCompound ? '→' : '+'}</span>}
                <Badge variant="secondary" className="font-normal">
                  {r.name}
                </Badge>
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'effectiveRate',
        meta: { label: t('settings.taxes.effectiveRate') },
        enableSorting: false,
        header: t('settings.taxes.effectiveRate'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatPercent(row.original.effectiveRate, { decimals: 2 })}</span>
        ),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <>
      <CrudPage
        embedded
        resource={taxGroupsResource}
        i18nKey="settings.taxGroups"
        columns={columns}
        schema={groupSchema}
        emptyValues={{ name: '', code: '', description: '', isActive: true, rates: [] }}
        toValues={(g) => ({
          name: g.name,
          code: g.code,
          description: g.description ?? '',
          isActive: g.isActive,
          rates: g.rates.map((r) => ({ taxRateId: r.id, isCompound: r.isCompound })),
        })}
        toPayload={(values) => ({ ...values, description: v.nullIfEmpty(values.description) })}
        renderFields={(form) => (
          <>
            <TextField
              control={form.control}
              name="name"
              label={t('fields.name')}
              placeholder="SD 20% + VAT 15%"
            />
            <TextField control={form.control} name="code" label={t('fields.code')} placeholder="SD20VAT15" />
            <TextareaField
              control={form.control}
              name="description"
              label={t('fields.description')}
              rows={2}
            />
            <GroupRatesEditor form={form} />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </>
        )}
      />
      <TaxCalculatorCard />
    </>
  );
}

export default function TaxesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'groups' ? 'groups' : 'rates';

  return (
    <>
      <PageHeader
        title={t('settings.taxes.title')}
        description={t('settings.taxes.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.taxes.title') }]}
      />
      {/* Switching tabs resets list params (page/search) by replacing the query string. */}
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="rates">{t('settings.taxRates.title')}</TabsTrigger>
          <TabsTrigger value="groups">{t('settings.taxGroups.title')}</TabsTrigger>
        </TabsList>
        <TabsContent value="rates">
          <TaxRatesTab />
        </TabsContent>
        <TabsContent value="groups">
          <TaxGroupsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
