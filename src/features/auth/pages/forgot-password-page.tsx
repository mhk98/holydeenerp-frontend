import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { applyServerErrors } from '@/lib/form';
import { FormField } from '@/components/common/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useForgotPassword } from '../api/auth-api';
import { AuthLayout } from '../components/auth-layout';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit((values) =>
    forgot.mutate(values, { onError: (err) => applyServerErrors(err, form.setError) }),
  );

  const backLink = (
    <Button asChild variant="ghost" className="w-full">
      <Link to="/login">
        <ArrowLeft aria-hidden /> {t('auth.backToSignIn')}
      </Link>
    </Button>
  );

  if (forgot.isSuccess) {
    return (
      <AuthLayout title={t('auth.checkEmailTitle')}>
        <div className="space-y-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <MailCheck className="size-6" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('auth.checkEmailText', { email: form.getValues('email') })}
          </p>
          {backLink}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} description={t('auth.forgotDescription')}>
      {forgot.isError && !form.formState.errors.email && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{forgot.error.message}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormField
            control={form.control}
            name="email"
            label={t('auth.email')}
            render={({ field, aria }) => (
              <Input
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="name@company.com"
                {...field}
                {...aria}
              />
            )}
          />
          <Button type="submit" className="w-full" disabled={forgot.isPending}>
            {forgot.isPending && <Spinner />}
            {t('auth.sendResetLink')}
          </Button>
          {backLink}
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
