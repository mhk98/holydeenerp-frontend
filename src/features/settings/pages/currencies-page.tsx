import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { LineChart, Trash2 } from 'lucide-react';
import { applyServerErrors, v } from '@/lib/form';
import { formatDate, formatNumber } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import type { Currency } from '@/types';
import { Can } from '@/components/common/can';
import { activeColumn, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SwitchField, TextField } from '@/components/common/fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { currenciesResource, useDeleteRate, useExchangeRates, useSaveRate } from '../api/settings-api';

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'validation.currencyCode'),
  name: v.required().max(100, 'validation.tooLong'),
  symbol: v.required().max(10, 'validation.tooLong'),
  decimalPlaces: z.string().regex(/^[0-6]$/, 'validation.decimalPlaces'),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const rateSchema = z.object({
  rate: v.decimal({ scale: 6 }),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
});
type RateValues = z.infer<typeof rateSchema>;

const today = () => new Date().toISOString().slice(0, 10);

/** Rate history for one currency, with an add form. */
function RatesSheet({ currency, onClose }: { currency: Currency | null; onClose: () => void }) {
  const { t } = useTranslation();
  const base = useSettingsStore((s) => s.currency);
  const rates = useExchangeRates(currency?.id ?? null);
  const save = useSaveRate(currency?.id ?? '');
  const remove = useDeleteRate(currency?.id ?? '');
  const form = useForm<RateValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: { rate: '', effectiveDate: today() },
  });

  const onSubmit = form.handleSubmit((data) =>
    save.mutate(data, {
      onSuccess: () => {
        toast.success(t('settings.currencies.rateSaved'));
        form.reset({ rate: '', effectiveDate: today() });
      },
      onError: (err) => {
        if (!applyServerErrors(err, form.setError)) toast.error(err.message);
      },
    }),
  );

  return (
    <Sheet open={Boolean(currency)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{t('settings.currencies.ratesTitle', { code: currency?.code })}</SheetTitle>
          <SheetDescription>
            {t('settings.currencies.ratesDescription', { code: currency?.code, base })}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto p-4">
          <Can permission="settings.update">
            <form
              onSubmit={onSubmit}
              noValidate
              className="grid items-start gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <TextField
                control={form.control}
                name="rate"
                label={`1 ${currency?.code ?? ''} = ${base}`}
                inputMode="decimal"
                placeholder="122.50"
              />
              <TextField
                control={form.control}
                name="effectiveDate"
                label={t('settings.currencies.effectiveDate')}
                type="date"
              />
              <Button type="submit" className="sm:mt-6" disabled={save.isPending}>
                {save.isPending && <Spinner />}
                {t('common.save')}
              </Button>
            </form>
          </Can>
          <ul className="divide-y rounded-lg border text-sm">
            {rates.isPending && (
              <li className="p-3">
                <Skeleton className="h-16" />
              </li>
            )}
            {rates.data?.rows.length === 0 && (
              <li className="p-4 text-muted-foreground">{t('settings.currencies.noRates')}</li>
            )}
            {rates.data?.rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1">
                  <p className="font-medium tabular-nums">
                    {formatNumber(r.rate, { decimals: 4 })} {base}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.effectiveDate)}</p>
                </div>
                {i === 0 && <Badge variant="secondary">{t('settings.currencies.latest')}</Badge>}
                <Can permission="settings.update">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.delete')}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(r.id, {
                        onSuccess: () => toast.success(t('settings.currencies.rateDeleted')),
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </Can>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CurrenciesPage() {
  const { t } = useTranslation();
  const base = useSettingsStore((s) => s.currency);
  const [ratesFor, setRatesFor] = useState<Currency | null>(null);

  const columns = useMemo<ColumnDef<Currency, unknown>[]>(
    () => [
      {
        id: 'code',
        enableHiding: false,
        meta: { label: t('settings.currencies.currency') },
        header: sortableHeader(t('settings.currencies.currency')),
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-muted text-sm font-semibold">
              {c.symbol}
            </span>
            <div>
              <p className="flex items-center gap-2 font-medium">
                {c.code}
                {c.isBase && <Badge variant="secondary">{t('settings.currencies.base')}</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{c.name}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'rate',
        meta: { label: t('settings.currencies.rate') },
        enableSorting: false,
        header: t('settings.currencies.rate'),
        cell: ({ row: { original: c } }) =>
          c.isBase ? (
            <span className="text-muted-foreground">—</span>
          ) : c.latestRate ? (
            <div>
              <p className="tabular-nums">
                1 {c.code} = {formatNumber(c.latestRate.rate, { decimals: 4 })} {base}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(c.latestRate.effectiveDate)}</p>
            </div>
          ) : (
            <Badge variant="outline" className="text-amber-600">
              {t('settings.currencies.noRate')}
            </Badge>
          ),
      },
      {
        id: 'decimalPlaces',
        meta: { label: t('settings.currencies.decimals') },
        enableSorting: false,
        header: t('settings.currencies.decimals'),
        cell: ({ row }) => row.original.decimalPlaces,
      },
      activeColumn(t),
    ],
    [t, base],
  );

  return (
    <>
      <CrudPage
        resource={currenciesResource}
        i18nKey="settings.currencies"
        defaultSort="code"
        columns={columns}
        schema={schema}
        emptyValues={{ code: '', name: '', symbol: '', decimalPlaces: '2', isActive: true } satisfies Values}
        toValues={(c) => ({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          decimalPlaces: String(c.decimalPlaces),
          isActive: c.isActive,
        })}
        toPayload={(values) => ({
          ...values,
          code: values.code.toUpperCase(),
          decimalPlaces: Number(values.decimalPlaces),
        })}
        canDelete={(c) => !c.isBase}
        rowLabel={(c) => c.code}
        rowActions={(c) =>
          c.isBase ? null : (
            <DropdownMenuItem onSelect={() => setRatesFor(c)}>
              <LineChart aria-hidden /> {t('settings.currencies.manageRates')}
            </DropdownMenuItem>
          )
        }
        intro={
          <p className="mb-4 text-sm text-muted-foreground">{t('settings.currencies.baseHint', { base })}</p>
        }
        renderFields={({ control }, { row }) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={control}
                name="code"
                label={t('settings.currencies.isoCode')}
                placeholder="USD"
                maxLength={3}
                disabled={row?.isBase}
              />
              <TextField
                control={control}
                name="symbol"
                label={t('settings.currencies.symbol')}
                placeholder="$"
              />
            </div>
            <TextField control={control} name="name" label={t('fields.name')} placeholder="US Dollar" />
            <TextField
              control={control}
              name="decimalPlaces"
              label={t('settings.currencies.decimals')}
              inputMode="numeric"
            />
            {!row?.isBase && <SwitchField control={control} name="isActive" label={t('common.active')} />}
          </>
        )}
      />
      <RatesSheet currency={ratesFor} onClose={() => setRatesFor(null)} />
    </>
  );
}
