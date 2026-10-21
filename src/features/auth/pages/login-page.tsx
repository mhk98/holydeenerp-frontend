import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { applyServerErrors } from '@/lib/form';
import { FormField } from '@/components/common/form-field';
import { PasswordInput } from '@/components/common/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useLogin, useVerifyTwoFactorLogin } from '../api/auth-api';
import { AuthLayout } from '../components/auth-layout';
import { OtpInput } from '../components/otp-input';
import { loginSchema, type LoginValues } from '../schemas';

const DEMO_ACCOUNTS = [
  'superadmin@holydeen.com',
  'admin@holydeen.com',
  'manager@holydeen.com',
  'accountant@holydeen.com',
  'storekeeper@holydeen.com',
  'cashier@holydeen.com',
  'production@holydeen.com',
];

function ErrorAlert({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!(error instanceof ApiError) || error.errors?.length) return null;
  const locked = error.status === 423;
  return (
    <Alert variant="destructive" className="mb-6">
      {locked ? <LockKeyhole aria-hidden /> : <AlertCircle aria-hidden />}
      <AlertTitle>{locked ? t('auth.lockedTitle') : t('auth.signInFailed')}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const login = useLogin();
  const verify = useVerifyTwoFactorLogin();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (data) => {
        if (data.requiresTwoFactor) setChallenge(data.challengeToken);
        else navigate(from, { replace: true });
      },
      onError: (err) => applyServerErrors(err, form.setError),
    }),
  );

  const submitCode = (value = code) => {
    if (!challenge || value.length !== 6) return;
    verify.mutate(
      { challengeToken: challenge, code: value },
      {
        onSuccess: () => navigate(from, { replace: true }),
        onError: (err) => {
          setCode('');
          // An expired challenge or a lockout sends the user back to step one.
          if (err instanceof ApiError && (err.status === 423 || /expired/i.test(err.message))) {
            setChallenge(null);
            login.reset();
          }
        },
      },
    );
  };

  if (challenge) {
    return (
      <AuthLayout title={t('auth.twoFactorTitle')} description={t('auth.twoFactorDescription')}>
        <ErrorAlert error={verify.error} />
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
        >
          <div className="flex justify-center">
            <ShieldCheck className="size-10 text-muted-foreground" aria-hidden />
          </div>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            disabled={verify.isPending}
            autoFocus
            invalid={verify.isError}
          />
          <Button type="submit" className="w-full" disabled={code.length !== 6 || verify.isPending}>
            {verify.isPending && <Spinner />}
            {t('auth.verify')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setChallenge(null);
              setCode('');
              verify.reset();
            }}
          >
            <ArrowLeft aria-hidden /> {t('auth.backToSignIn')}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.signInTitle')} description={t('auth.signInDescription')}>
      <ErrorAlert error={login.error} />
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormField
            control={form.control}
            name="email"
            label={t('auth.email')}
            render={({ field, aria }) => (
              <Input
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="name@company.com"
                {...field}
                {...aria}
              />
            )}
          />
          <FormField
            control={form.control}
            name="password"
            label={t('auth.password')}
            labelAction={
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            }
            render={({ field, aria }) => (
              <PasswordInput autoComplete="current-password" {...field} {...aria} />
            )}
          />
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending && <Spinner />}
            {t('auth.signIn')}
          </Button>
        </FieldGroup>
      </form>

      {import.meta.env.DEV && (
        <details className="mt-8 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            {t('auth.demoAccounts')}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('auth.demoPassword', { password: 'Password@123' })}
          </p>
          <ul className="mt-2 grid gap-1">
            {DEMO_ACCOUNTS.map((email) => (
              <li key={email}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => {
                    form.setValue('email', email, { shouldValidate: true });
                    form.setValue('password', 'Password@123', { shouldValidate: true });
                  }}
                >
                  {email}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </AuthLayout>
  );
}
