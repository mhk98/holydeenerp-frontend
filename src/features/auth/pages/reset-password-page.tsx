import { Link, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CircleCheck, LinkIcon } from 'lucide-react';
import { applyServerErrors } from '@/lib/form';
import { FormField } from '@/components/common/form-field';
import { PasswordInput, PasswordRules } from '@/components/common/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useResetPassword, useResetTokenCheck } from '../api/auth-api';
import { AuthLayout } from '../components/auth-layout';
import { newPasswordSchema, type NewPasswordValues } from '../schemas';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const check = useResetTokenCheck(token);
  const reset = useResetPassword();

  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control: form.control, name: 'password' });

  const onSubmit = form.handleSubmit(({ password: newPassword }) =>
    reset.mutate(
      { token, password: newPassword },
      { onError: (err) => applyServerErrors(err, form.setError) },
    ),
  );

  if (check.isPending) {
    return (
      <AuthLayout title={t('auth.resetTitle')}>
        <div className="space-y-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </AuthLayout>
    );
  }

  if (check.isError) {
    return (
      <AuthLayout title={t('auth.linkInvalidTitle')} description={t('auth.linkInvalidText')}>
        <div className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LinkIcon className="size-6" aria-hidden />
          </div>
          <Button asChild className="w-full">
            <Link to="/forgot-password">{t('auth.requestNewLink')}</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">
              <ArrowLeft aria-hidden /> {t('auth.backToSignIn')}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthLayout title={t('auth.resetDoneTitle')} description={t('auth.resetDoneText')}>
        <div className="space-y-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CircleCheck className="size-6" aria-hidden />
          </div>
          <Button asChild className="w-full">
            <Link to="/login">{t('auth.signIn')}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.resetTitle')}
      description={t('auth.resetDescription', { email: check.data.email })}
    >
      {reset.isError && !Object.keys(form.formState.errors).length && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{reset.error.message}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormField
            control={form.control}
            name="password"
            label={t('auth.newPassword')}
            description={<PasswordRules value={password} />}
            render={({ field, aria }) => (
              <PasswordInput autoComplete="new-password" autoFocus {...field} {...aria} />
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            label={t('auth.confirmPassword')}
            render={({ field, aria }) => <PasswordInput autoComplete="new-password" {...field} {...aria} />}
          />
          <Button type="submit" className="w-full" disabled={reset.isPending}>
            {reset.isPending && <Spinner />}
            {t('auth.resetPassword')}
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
