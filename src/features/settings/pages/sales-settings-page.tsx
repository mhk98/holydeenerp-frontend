import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { applyServerErrors } from '@/lib/form';
import type { SalesSettings } from '@/types';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreferences, useSavePreferences } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

/** "3, 7, 30" → [3, 7, 30] */
const dayList = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^(\d{1,3}(\s*,\s*\d{1,3})*)?$/, 'settings.sales.dayListFormat')
    .refine((s) => !s || s.split(',').every((d) => Number(d) >= 1 && Number(d) <= max), 'validation.tooLarge')
    .refine((s) => !s || s.split(',').length <= 5, 'settings.sales.dayListMax');
const toDays = (s: string) =>
  s ? [...new Set(s.split(',').map((d) => Number(d.trim())))].sort((a, b) => a - b) : [];

const schema = z.object({
  roundTo: z.enum(['none', '0.5', '1', '5', '10']),
  roundingMode: z.enum(['nearest', 'up', 'down']),
  creditCheck: z.boolean(),
  defaultPaymentTermsDays: z
    .string()
    .regex(/^\d{1,3}$/, 'validation.integer')
    .refine((s) => Number(s) <= 365, 'validation.tooLarge'),
  quotationValidityDays: z
    .string()
    .regex(/^\d{1,3}$/, 'validation.integer')
    .refine((s) => Number(s) >= 1 && Number(s) <= 365, 'validation.tooLarge'),
  defaultTerms: z.string().max(5000, 'validation.tooLong'),
  remindersEnabled: z.boolean(),
  reminderDaysBefore: dayList(60),
  reminderDaysAfter: dayList(365),
});
type Values = z.infer<typeof schema>;

/** Settings → Sales: rounding, credit-limit check, default terms and automatic payment reminders. */
export default function SalesSettingsPage() {
  const { t } = useTranslation();
  const prefs = usePreferences('sales');
  const save = useSavePreferences('sales');
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!prefs.data) return;
    const d = prefs.data satisfies SalesSettings;
    form.reset({
      roundTo: d.roundTo,
      roundingMode: d.roundingMode,
      creditCheck: d.creditCheck,
      defaultPaymentTermsDays: String(d.defaultPaymentTermsDays),
      quotationValidityDays: String(d.quotationValidityDays),
      defaultTerms: d.defaultTerms,
      remindersEnabled: d.remindersEnabled,
      reminderDaysBefore: d.reminderDaysBefore.join(', '),
      reminderDaysAfter: d.reminderDaysAfter.join(', '),
    });
  }, [prefs.data, form]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        roundTo: values.roundTo,
        roundingMode: values.roundingMode,
        creditCheck: values.creditCheck,
        defaultPaymentTermsDays: Number(values.defaultPaymentTermsDays),
        quotationValidityDays: Number(values.quotationValidityDays),
        defaultTerms: values.defaultTerms,
        remindersEnabled: values.remindersEnabled,
        reminderDaysBefore: toDays(values.reminderDaysBefore),
        reminderDaysAfter: toDays(values.reminderDaysAfter),
      },
      {
        onSuccess: () => toast.success(t('settings.saved')),
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  return (
    <>
      <PageHeader
        title={t('settings.sales.title')}
        description={t('settings.sales.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.sales.title') }]}
      />
      {!prefs.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <SettingsFormCard
          title={t('settings.sales.cardTitle')}
          description={t('settings.sales.cardHint')}
          onSubmit={onSubmit}
          saving={save.isPending}
          dirty={form.formState.isDirty}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="roundTo"
              label={t('settings.sales.roundTo')}
              description={t('settings.sales.roundToHint')}
              options={(['none', '0.5', '1', '5', '10'] as const).map((v) => ({
                value: v,
                label: t(`settings.sales.round.${v.replace('.', '_')}`),
              }))}
            />
            <SelectField
              control={form.control}
              name="roundingMode"
              label={t('settings.sales.roundingMode')}
              options={(['nearest', 'up', 'down'] as const).map((v) => ({
                value: v,
                label: t(`settings.sales.modes.${v}`),
              }))}
            />
          </div>
          <SwitchField
            control={form.control}
            name="creditCheck"
            label={t('settings.sales.creditCheck')}
            description={t('settings.sales.creditCheckHint')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="defaultPaymentTermsDays"
              inputMode="numeric"
              label={t('settings.sales.paymentTerms')}
              description={t('settings.sales.paymentTermsHint')}
            />
            <TextField
              control={form.control}
              name="quotationValidityDays"
              inputMode="numeric"
              label={t('settings.sales.quotationValidity')}
              description={t('settings.sales.quotationValidityHint')}
            />
          </div>
          <TextareaField
            control={form.control}
            name="defaultTerms"
            label={t('settings.sales.defaultTerms')}
            description={t('settings.sales.defaultTermsHint')}
            rows={3}
          />
          <SwitchField
            control={form.control}
            name="remindersEnabled"
            label={t('settings.sales.reminders')}
            description={t('settings.sales.remindersHint')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="reminderDaysBefore"
              label={t('settings.sales.daysBefore')}
              description={t('settings.sales.daysBeforeHint')}
              placeholder="3"
            />
            <TextField
              control={form.control}
              name="reminderDaysAfter"
              label={t('settings.sales.daysAfter')}
              description={t('settings.sales.daysAfterHint')}
              placeholder="1, 7, 30"
            />
          </div>
        </SettingsFormCard>
      )}
    </>
  );
}
