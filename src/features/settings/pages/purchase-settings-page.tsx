import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { applyServerErrors, v } from '@/lib/form';
import type { PurchaseSettings } from '@/types';
import { FormField } from '@/components/common/form-field';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePurchaseLookups } from '@/features/purchase/api/purchase-api';
import { usePreferences, useSavePreferences } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const ANY = '__any__';

const schema = z
  .object({
    approvalLevels: z
      .array(
        z.object({
          name: v.required(),
          minAmount: v.decimal({ scale: 4, allowZero: true }),
          roleId: z.string(),
        }),
      )
      .max(5, 'settings.purchase.maxLevels'),
    requisitionApproval: z.boolean(),
    overReceiptPercent: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, 'validation.decimal')
      .refine((s) => Number(s) <= 100, 'validation.tooLarge'),
    defaultPaymentTermsDays: z
      .string()
      .regex(/^\d{1,3}$/, 'validation.integer')
      .refine((s) => Number(s) <= 365, 'validation.tooLarge'),
    defaultTerms: z.string().max(5000, 'validation.tooLong'),
  })
  .superRefine((vals, ctx) => {
    vals.approvalLevels.forEach((l, i) => {
      if (i > 0 && Number(l.minAmount) <= Number(vals.approvalLevels[i - 1].minAmount)) {
        ctx.addIssue({
          code: 'custom',
          path: ['approvalLevels', i, 'minAmount'],
          message: 'settings.purchase.increasing',
        });
      }
    });
  });
type Values = z.infer<typeof schema>;

/** Settings → Purchase: approval levels by amount, receiving tolerance, default terms. */
export default function PurchaseSettingsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const prefs = usePreferences('purchase');
  const save = useSavePreferences('purchase');
  const lookups = usePurchaseLookups();
  const roles = can('purchase.view') ? (lookups.data?.roles ?? []) : [];
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const levels = useFieldArray({ control: form.control, name: 'approvalLevels' });

  useEffect(() => {
    if (!prefs.data) return;
    const d = prefs.data satisfies PurchaseSettings;
    form.reset({
      approvalLevels: d.approvalLevels.map((l) => ({
        name: l.name,
        minAmount: String(Number(l.minAmount)),
        roleId: l.roleId ?? '',
      })),
      requisitionApproval: d.requisitionApproval,
      overReceiptPercent: String(d.overReceiptPercent),
      defaultPaymentTermsDays: String(d.defaultPaymentTermsDays),
      defaultTerms: d.defaultTerms,
    });
  }, [prefs.data, form]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        approvalLevels: values.approvalLevels.map((l) => ({
          name: l.name.trim(),
          minAmount: l.minAmount,
          roleId: l.roleId || null,
        })),
        requisitionApproval: values.requisitionApproval,
        overReceiptPercent: Number(values.overReceiptPercent),
        defaultPaymentTermsDays: Number(values.defaultPaymentTermsDays),
        defaultTerms: values.defaultTerms,
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
        title={t('settings.purchase.title')}
        description={t('settings.purchase.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.purchase.title') }]}
      />
      {!prefs.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <SettingsFormCard
          title={t('settings.purchase.cardTitle')}
          description={t('settings.purchase.cardHint')}
          onSubmit={onSubmit}
          saving={save.isPending}
          dirty={form.formState.isDirty}
        >
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-sm font-medium">{t('settings.purchase.approvalLevels')}</div>
              <p className="text-xs text-muted-foreground">{t('settings.purchase.approvalLevelsHint')}</p>
            </div>
            {levels.fields.map((f, i) => (
              <div
                key={f.id}
                className="grid items-start gap-2 rounded-lg border p-3 sm:grid-cols-[2rem_1fr_10rem_12rem_auto]"
              >
                <span className="pt-2 text-sm font-medium text-muted-foreground">{i + 1}.</span>
                <FormField
                  control={form.control}
                  name={`approvalLevels.${i}.name`}
                  render={({ field, aria }) => (
                    <Input
                      {...field}
                      {...aria}
                      placeholder={t('settings.purchase.levelName')}
                      aria-label={t('settings.purchase.levelName')}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name={`approvalLevels.${i}.minAmount`}
                  render={({ field, aria }) => (
                    <Input
                      {...field}
                      {...aria}
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      placeholder="0"
                      aria-label={t('settings.purchase.fromAmount')}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name={`approvalLevels.${i}.roleId`}
                  render={({ field, aria }) => (
                    <Select
                      value={field.value || ANY}
                      onValueChange={(val) => field.onChange(val === ANY ? '' : val)}
                    >
                      <SelectTrigger className="w-full" {...aria} aria-label={t('settings.purchase.role')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>{t('settings.purchase.anyApprover')}</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                        {field.value && !roles.some((r) => r.id === field.value) && (
                          <SelectItem value={field.value}>
                            {t('settings.purchase.roleId', { id: field.value })}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => levels.remove(i)}
                  aria-label={t('common.remove')}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {!levels.fields.length && (
              <p className="text-sm text-muted-foreground">{t('settings.purchase.noLevels')}</p>
            )}
            {levels.fields.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  const last = form.getValues('approvalLevels').at(-1);
                  levels.append({
                    name: '',
                    minAmount: last ? String(Number(last.minAmount) * 10 || 100000) : '0',
                    roleId: '',
                  });
                }}
              >
                <Plus aria-hidden /> {t('settings.purchase.addLevel')}
              </Button>
            )}
          </div>
          <SwitchField
            control={form.control}
            name="requisitionApproval"
            label={t('settings.purchase.requisitionApproval')}
            description={t('settings.purchase.requisitionApprovalHint')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="overReceiptPercent"
              inputMode="decimal"
              label={t('settings.purchase.overReceipt')}
              description={t('settings.purchase.overReceiptHint')}
            />
            <TextField
              control={form.control}
              name="defaultPaymentTermsDays"
              inputMode="numeric"
              label={t('settings.purchase.paymentTerms')}
              description={t('settings.purchase.paymentTermsHint')}
            />
          </div>
          <TextareaField
            control={form.control}
            name="defaultTerms"
            label={t('settings.purchase.defaultTerms')}
            description={t('settings.purchase.defaultTermsHint')}
            rows={3}
          />
        </SettingsFormCard>
      )}
    </>
  );
}
