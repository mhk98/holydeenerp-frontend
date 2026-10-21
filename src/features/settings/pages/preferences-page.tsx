import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { applyServerErrors } from '@/lib/form';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DateFormat, SystemSettings, ThemeColor } from '@/types';
import { FormField } from '@/components/common/form-field';
import { SelectField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreferences, useSavePreferences } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const DATE_FORMATS: DateFormat[] = ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD MMM YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const COLORS: { value: ThemeColor; swatch: string }[] = [
  { value: 'neutral', swatch: 'bg-zinc-900 dark:bg-zinc-100' },
  { value: 'blue', swatch: 'bg-blue-600' },
  { value: 'emerald', swatch: 'bg-emerald-600' },
  { value: 'violet', swatch: 'bg-violet-600' },
  { value: 'orange', swatch: 'bg-orange-600' },
  { value: 'rose', swatch: 'bg-rose-600' },
];

const schema = z.object({
  dateFormat: z.enum(DATE_FORMATS),
  timeFormat: z.enum(['12h', '24h']),
  timezone: z.string().min(1, 'validation.required'),
  language: z.enum(['en', 'bn']),
  themeColor: z.enum(['neutral', 'blue', 'emerald', 'violet', 'orange', 'rose']),
});
type Values = z.infer<typeof schema>;

export default function PreferencesPage() {
  const { t } = useTranslation();
  const prefs = usePreferences('system');
  const save = useSavePreferences('system');
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const timezones = useMemo(
    () => Intl.supportedValuesOf('timeZone').map((tz) => ({ value: tz, label: tz.replaceAll('_', ' ') })),
    [],
  );
  const dateFormat = useWatch({ control: form.control, name: 'dateFormat' });

  useEffect(() => {
    if (prefs.data) form.reset(prefs.data satisfies SystemSettings);
  }, [prefs.data, form]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => toast.success(t('settings.saved')),
      onError: (err) => {
        if (!applyServerErrors(err, form.setError)) toast.error(err.message);
      },
    }),
  );

  const sample = new Date();

  return (
    <>
      <PageHeader
        title={t('settings.preferences.title')}
        description={t('settings.preferences.description')}
        breadcrumbs={[
          { label: t('nav.settings'), to: '/settings' },
          { label: t('settings.preferences.title') },
        ]}
      />
      {!prefs.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <SettingsFormCard
          title={t('settings.preferences.cardTitle')}
          description={t('settings.preferences.cardHint')}
          onSubmit={onSubmit}
          saving={save.isPending}
          dirty={form.formState.isDirty}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="dateFormat"
              label={t('settings.preferences.dateFormat')}
              description={
                dateFormat &&
                t('settings.preferences.example', { value: formatDate(sample, { pattern: dateFormat }) })
              }
              options={DATE_FORMATS.map((f) => ({ value: f, label: f }))}
            />
            <SelectField
              control={form.control}
              name="timeFormat"
              label={t('settings.preferences.timeFormat')}
              options={[
                { value: '12h', label: t('settings.preferences.time12', { example: formatTime(sample) }) },
                { value: '24h', label: t('settings.preferences.time24') },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="timezone"
              label={t('settings.preferences.timezone')}
              options={timezones}
            />
            <SelectField
              control={form.control}
              name="language"
              label={t('settings.preferences.language')}
              description={t('settings.preferences.languageHint')}
              options={[
                { value: 'en', label: 'English' },
                { value: 'bn', label: 'বাংলা' },
              ]}
            />
          </div>
          <FormField
            control={form.control}
            name="themeColor"
            label={t('settings.preferences.themeColor')}
            description={t('settings.preferences.themeColorHint')}
            render={({ field, id }) => (
              <div id={id} role="radiogroup" className="flex flex-wrap gap-2">
                {COLORS.map((c) => {
                  const selected = field.value === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(c.value)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? 'border-foreground' : 'hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full text-white',
                          c.swatch,
                        )}
                      >
                        {selected && <Check className="size-3 mix-blend-difference" aria-hidden />}
                      </span>
                      {t(`settings.preferences.colors.${c.value}`)}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </SettingsFormCard>
      )}
    </>
  );
}
