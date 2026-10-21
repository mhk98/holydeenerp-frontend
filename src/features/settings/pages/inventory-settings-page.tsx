import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { applyServerErrors } from '@/lib/form';
import { cn } from '@/lib/utils';
import type { InventorySettings } from '@/types';
import { FormField } from '@/components/common/form-field';
import { SwitchField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreferences, useSavePreferences } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const days = (max: number) =>
  z
    .string()
    .regex(/^\d+$/, 'validation.integer')
    .refine((s) => Number(s) >= 1 && Number(s) <= max, 'validation.tooLarge');

const schema = z
  .object({
    costingMethod: z.enum(['fifo', 'weighted_average']),
    allowNegativeStock: z.boolean(),
    requireApproval: z.boolean(),
    nearExpiryDays: days(365),
    slowMovingDays: days(730),
    deadStockDays: days(1825),
  })
  .refine((v) => Number(v.deadStockDays) > Number(v.slowMovingDays), {
    path: ['deadStockDays'],
    message: 'settings.inventory.deadAfterSlow',
  });
type Values = z.infer<typeof schema>;

const METHODS = ['weighted_average', 'fifo'] as const;

/** Settings → Inventory: costing, negative stock, approvals and alert thresholds. */
export default function InventorySettingsPage() {
  const { t } = useTranslation();
  const prefs = usePreferences('inventory');
  const save = useSavePreferences('inventory');
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!prefs.data) return;
    const d = prefs.data satisfies InventorySettings;
    form.reset({
      ...d,
      nearExpiryDays: String(d.nearExpiryDays),
      slowMovingDays: String(d.slowMovingDays),
      deadStockDays: String(d.deadStockDays),
    });
  }, [prefs.data, form]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        ...values,
        nearExpiryDays: Number(values.nearExpiryDays),
        slowMovingDays: Number(values.slowMovingDays),
        deadStockDays: Number(values.deadStockDays),
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
        title={t('settings.inventory.title')}
        description={t('settings.inventory.description')}
        breadcrumbs={[
          { label: t('nav.settings'), to: '/settings' },
          { label: t('settings.inventory.title') },
        ]}
      />
      {!prefs.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <SettingsFormCard
          title={t('settings.inventory.cardTitle')}
          description={t('settings.inventory.cardHint')}
          onSubmit={onSubmit}
          saving={save.isPending}
          dirty={form.formState.isDirty}
        >
          <FormField
            control={form.control}
            name="costingMethod"
            label={t('settings.inventory.costingMethod')}
            description={t('settings.inventory.costingHint')}
            render={({ field, id }) => (
              <div id={id} role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {METHODS.map((m) => {
                  const selected = field.value === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(m)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? 'border-foreground' : 'hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                          selected && 'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        {selected && <Check className="size-3" aria-hidden />}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{t(`settings.inventory.methods.${m}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`settings.inventory.methodHints.${m}`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
          <SwitchField
            control={form.control}
            name="requireApproval"
            label={t('settings.inventory.requireApproval')}
            description={t('settings.inventory.requireApprovalHint')}
          />
          <SwitchField
            control={form.control}
            name="allowNegativeStock"
            label={t('settings.inventory.allowNegative')}
            description={t('settings.inventory.allowNegativeHint')}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              control={form.control}
              name="nearExpiryDays"
              inputMode="numeric"
              label={t('settings.inventory.nearExpiryDays')}
              description={t('settings.inventory.daysHint')}
            />
            <TextField
              control={form.control}
              name="slowMovingDays"
              inputMode="numeric"
              label={t('settings.inventory.slowMovingDays')}
              description={t('settings.inventory.daysHint')}
            />
            <TextField
              control={form.control}
              name="deadStockDays"
              inputMode="numeric"
              label={t('settings.inventory.deadStockDays')}
              description={t('settings.inventory.daysHint')}
            />
          </div>
        </SettingsFormCard>
      )}
    </>
  );
}
