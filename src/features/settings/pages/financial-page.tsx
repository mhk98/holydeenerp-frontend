import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { applyServerErrors } from '@/lib/form';
import { formatCurrency, formatDate } from '@/lib/format';
import type { FinancialSettings } from '@/types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { SelectField, SwitchField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { currenciesResource, usePreferences, useSavePreferences } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const schema = z.object({
  baseCurrency: z.string().min(1, 'validation.required'),
  multiCurrency: z.boolean(),
  fiscalYearStartMonth: z.string(),
  fiscalYearStartDay: z.string(),
  amountDecimals: z.string(),
  quantityDecimals: z.string(),
  pricesIncludeTax: z.boolean(),
});
type Values = z.infer<typeof schema>;

const toValues = (f: FinancialSettings): Values => ({
  baseCurrency: f.baseCurrency,
  multiCurrency: f.multiCurrency,
  fiscalYearStartMonth: String(f.fiscalYearStartMonth),
  fiscalYearStartDay: String(f.fiscalYearStartDay),
  amountDecimals: String(f.amountDecimals),
  quantityDecimals: String(f.quantityDecimals),
  pricesIncludeTax: f.pricesIncludeTax,
});

export default function FinancialPage() {
  const { t } = useTranslation();
  const prefs = usePreferences('financial');
  const save = useSavePreferences('financial');
  const currencies = currenciesResource.useOptions({ isActive: 'true' });
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (prefs.data) form.reset(toValues(prefs.data));
  }, [prefs.data, form]);

  const watched = useWatch({ control: form.control });
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: formatDate(new Date(Date.UTC(2026, i, 1)), { month: 'long', timeZone: 'UTC' }),
  }));
  const digits = (n: number) =>
    Array.from({ length: n + 1 }, (_, i) => ({ value: String(i), label: String(i) }));

  const [pending, setPending] = useState<Values | null>(null);

  const persist = (values: Values) =>
    save.mutate(
      {
        ...values,
        fiscalYearStartMonth: Number(values.fiscalYearStartMonth),
        fiscalYearStartDay: Number(values.fiscalYearStartDay),
        amountDecimals: Number(values.amountDecimals),
        quantityDecimals: Number(values.quantityDecimals),
      },
      {
        onSuccess: () => {
          toast.success(t('settings.saved'));
          setPending(null);
        },
        onError: (err) => {
          setPending(null);
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    );

  // Changing the base currency clears that currency's exchange rates — confirm first.
  const onSubmit = form.handleSubmit((values) =>
    prefs.data && values.baseCurrency !== prefs.data.baseCurrency ? setPending(values) : persist(values),
  );

  return (
    <>
      <PageHeader
        title={t('settings.financial.title')}
        description={t('settings.financial.description')}
        breadcrumbs={[
          { label: t('nav.settings'), to: '/settings' },
          { label: t('settings.financial.title') },
        ]}
      />
      {!prefs.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <SettingsFormCard
          title={t('settings.financial.cardTitle')}
          onSubmit={onSubmit}
          saving={save.isPending}
          dirty={form.formState.isDirty}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="baseCurrency"
              label={t('settings.financial.baseCurrency')}
              description={t('settings.financial.baseCurrencyHint')}
              options={(currencies.data ?? []).map((c) => ({
                value: c.code,
                label: `${c.code} — ${c.name}`,
              }))}
            />
            <SwitchField
              control={form.control}
              name="multiCurrency"
              label={t('settings.financial.multiCurrency')}
              description={t('settings.financial.multiCurrencyHint')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="fiscalYearStartMonth"
              label={t('settings.financial.fyMonth')}
              options={months}
            />
            <SelectField
              control={form.control}
              name="fiscalYearStartDay"
              label={t('settings.financial.fyDay')}
              options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.financial.fyPreview', {
              start: formatDate(
                new Date(
                  Date.UTC(
                    2026,
                    Number(watched.fiscalYearStartMonth) - 1,
                    Number(watched.fiscalYearStartDay),
                  ),
                ),
                {
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'UTC',
                },
              ),
            })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="amountDecimals"
              label={t('settings.financial.amountDecimals')}
              description={formatCurrency('1234.5678', { decimals: Number(watched.amountDecimals) })}
              options={digits(4)}
            />
            <SelectField
              control={form.control}
              name="quantityDecimals"
              label={t('settings.financial.quantityDecimals')}
              options={digits(4)}
            />
          </div>
          <SwitchField
            control={form.control}
            name="pricesIncludeTax"
            label={t('settings.financial.pricesIncludeTax')}
            description={t('settings.financial.pricesIncludeTaxHint')}
          />
        </SettingsFormCard>
      )}
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title={t('settings.financial.baseChangeTitle')}
        description={t('settings.financial.baseChangeConfirm', { code: pending?.baseCurrency })}
        confirmLabel={t('settings.financial.baseChangeAction')}
        destructive
        loading={save.isPending}
        onConfirm={() => pending && persist(pending)}
      />
    </>
  );
}
