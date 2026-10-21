import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { applyServerErrors, v } from '@/lib/form';
import { useAuthStore } from '@/stores/auth-store';
import type { SmtpSettings } from '@/types';
import { FormField } from '@/components/common/form-field';
import { SwitchField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { PasswordInput } from '@/components/common/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { usePreferences, useSavePreferences, useSmtpTest } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const schema = z
  .object({
    enabled: z.boolean(),
    host: z.string().trim().max(191, 'validation.tooLong'),
    port: z.string().regex(/^\d{1,5}$/, 'validation.port'),
    secure: z.boolean(),
    username: z.string().trim().max(191, 'validation.tooLong'),
    password: z.string().max(500, 'validation.tooLong'),
    fromName: z.string().trim().max(150, 'validation.tooLong'),
    fromEmail: v.optionalEmail(),
  })
  .refine((d) => !d.enabled || d.host, { path: ['host'], message: 'validation.required' })
  .refine((d) => !d.enabled || d.fromEmail, { path: ['fromEmail'], message: 'validation.required' });
type Values = z.infer<typeof schema>;

const toValues = (s: SmtpSettings): Values => ({
  enabled: s.enabled,
  host: s.host,
  port: String(s.port),
  secure: s.secure,
  username: s.username,
  password: '',
  fromName: s.fromName,
  fromEmail: s.fromEmail,
});

export default function EmailPage() {
  const { t } = useTranslation();
  const myEmail = useAuthStore((s) => s.user?.email ?? '');
  const smtp = usePreferences('smtp');
  const save = useSavePreferences('smtp');
  const test = useSmtpTest();
  const [testTo, setTestTo] = useState(myEmail);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (smtp.data) form.reset(toValues(smtp.data));
  }, [smtp.data, form]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { ...values, port: Number(values.port), password: values.password || undefined },
      {
        onSuccess: () => toast.success(t('settings.saved')),
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  const sendTest = () =>
    test.mutate(testTo, {
      onSuccess: () => toast.success(t('settings.email.testSent', { to: testTo })),
      onError: (err) => toast.error(err.message),
    });

  return (
    <>
      <PageHeader
        title={t('settings.email.title')}
        description={t('settings.email.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.email.title') }]}
      />
      {!smtp.data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-4">
          {!smtp.data.enabled && (
            <Alert>
              <AlertDescription>{t('settings.email.disabledInfo')}</AlertDescription>
            </Alert>
          )}
          <SettingsFormCard
            title={t('settings.email.cardTitle')}
            onSubmit={onSubmit}
            saving={save.isPending}
            dirty={form.formState.isDirty}
          >
            <SwitchField
              control={form.control}
              name="enabled"
              label={t('settings.email.enabled')}
              description={t('settings.email.enabledHint')}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <TextField
                control={form.control}
                name="host"
                label={t('settings.email.host')}
                placeholder="smtp.hostinger.com"
              />
              <TextField
                control={form.control}
                name="port"
                label={t('settings.email.port')}
                inputMode="numeric"
              />
            </div>
            <SwitchField
              control={form.control}
              name="secure"
              label={t('settings.email.secure')}
              description={t('settings.email.secureHint')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="username"
                label={t('settings.email.username')}
                autoComplete="off"
              />
              <FormField
                control={form.control}
                name="password"
                label={t('auth.password')}
                description={smtp.data.hasPassword ? t('settings.email.passwordSaved') : undefined}
                render={({ field, aria }) => (
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={smtp.data?.hasPassword ? '••••••••' : ''}
                    {...field}
                    {...aria}
                  />
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="fromName"
                label={t('settings.email.fromName')}
                placeholder="Holydeen ERP"
              />
              <TextField
                control={form.control}
                name="fromEmail"
                label={t('settings.email.fromEmail')}
                type="email"
                placeholder="erp@holydeen.com"
              />
            </div>
          </SettingsFormCard>

          <SettingsFormCard
            title={t('settings.email.testTitle')}
            description={t('settings.email.testHint')}
            onSubmit={(e) => {
              e.preventDefault();
              sendTest();
            }}
            hideSave
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={sendTest}
                disabled={test.isPending || !testTo || form.formState.isDirty}
              >
                {test.isPending ? <Spinner /> : <Send aria-hidden />}
                {t('settings.email.sendTest')}
              </Button>
            }
          >
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              aria-label={t('settings.email.testTo')}
            />
            {form.formState.isDirty && (
              <p className="text-xs text-muted-foreground">{t('settings.email.saveFirst')}</p>
            )}
          </SettingsFormCard>
        </div>
      )}
    </>
  );
}
