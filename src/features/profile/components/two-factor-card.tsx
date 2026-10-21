import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { PasswordInput } from '@/components/common/password-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useDisableTwoFactor, useEnableTwoFactor, useTwoFactorSetup } from '@/features/auth/api/auth-api';
import { OtpInput } from '@/features/auth/components/otp-input';

const fieldError = (err: unknown, field: string) =>
  err instanceof ApiError
    ? (err.errors?.find((e) => e.field === field)?.message ?? (err.errors ? undefined : err.message))
    : undefined;

/** `setup` is started by the button that opens the dialog (not on render). */
function EnableDialog({
  open,
  onOpenChange,
  setup,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  setup: ReturnType<typeof useTwoFactorSetup>;
}) {
  const { t } = useTranslation();
  const enable = useEnableTwoFactor();
  const [code, setCode] = useState('');

  const close = (o: boolean) => {
    if (enable.isPending) return;
    onOpenChange(o);
    if (!o) {
      setCode('');
      setup.reset();
      enable.reset();
    }
  };

  const submit = (value = code) => {
    if (value.length !== 6) return;
    enable.mutate(
      { code: value },
      {
        onSuccess: () => {
          toast.success(t('profile.twoFactorEnabled'));
          close(false);
        },
        onError: () => setCode(''),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile.enableTwoFactorTitle')}</DialogTitle>
          <DialogDescription>{t('profile.enableTwoFactorText')}</DialogDescription>
        </DialogHeader>
        {setup.isPending || !setup.data ? (
          <div className="flex h-64 items-center justify-center">
            {setup.isError ? <p className="text-sm text-destructive">{setup.error.message}</p> : <Spinner />}
          </div>
        ) : (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('profile.twoFactorStep1')}</li>
              <li>{t('profile.twoFactorStep2')}</li>
            </ol>
            <img
              src={setup.data.qrCode}
              alt={t('profile.qrAlt')}
              className="mx-auto size-48 rounded-lg border bg-white p-2"
            />
            <div className="flex items-center justify-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs tracking-wider break-all">
                {setup.data.secret}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('profile.copySecret')}
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(setup.data!.secret)
                    .then(() => toast.success(t('profile.copied')))
                }
              >
                <Copy aria-hidden />
              </Button>
            </div>
            <Field data-invalid={enable.isError}>
              <FieldLabel htmlFor="enable-2fa-code" className="justify-center">
                {t('profile.twoFactorStep3')}
              </FieldLabel>
              <OtpInput
                id="enable-2fa-code"
                value={code}
                onChange={setCode}
                onComplete={submit}
                invalid={enable.isError}
              />
              {enable.isError && (
                <FieldError className="text-center">{fieldError(enable.error, 'code')}</FieldError>
              )}
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
                disabled={enable.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={code.length !== 6 || enable.isPending}>
                {enable.isPending && <Spinner />}
                {t('profile.verifyAndEnable')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const disable = useDisableTwoFactor();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const close = (o: boolean) => {
    if (disable.isPending) return;
    onOpenChange(o);
    if (!o) {
      setPassword('');
      setCode('');
      disable.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            disable.mutate(
              { password, code },
              {
                onSuccess: () => {
                  toast.success(t('profile.twoFactorDisabled'));
                  close(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('profile.disableTwoFactorTitle')}</DialogTitle>
            <DialogDescription>{t('profile.disableTwoFactorText')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(fieldError(disable.error, 'password'))}>
              <FieldLabel htmlFor="disable-2fa-password">{t('auth.password')}</FieldLabel>
              <PasswordInput
                id="disable-2fa-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FieldError>{fieldError(disable.error, 'password')}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldError(disable.error, 'code'))}>
              <FieldLabel htmlFor="disable-2fa-code">{t('auth.otpLabel')}</FieldLabel>
              <OtpInput id="disable-2fa-code" value={code} onChange={setCode} />
              <FieldError>{fieldError(disable.error, 'code')}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={disable.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!password || code.length !== 6 || disable.isPending}
            >
              {disable.isPending && <Spinner />}
              {t('profile.disableTwoFactor')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TwoFactorCard() {
  const { t } = useTranslation();
  const enabled = useAuthStore((s) => s.user?.twoFactorEnabled);
  const [dialog, setDialog] = useState<'enable' | 'disable' | null>(null);
  const setup = useTwoFactorSetup();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('profile.twoFactorTitle')}
          <StatusBadge tone={enabled ? 'success' : 'neutral'}>
            {enabled ? t('profile.enabled') : t('profile.disabled')}
          </StatusBadge>
        </CardTitle>
        <CardDescription>{t('profile.twoFactorDescription')}</CardDescription>
        <CardAction>
          {enabled ? (
            <Button variant="outline" onClick={() => setDialog('disable')}>
              <ShieldOff aria-hidden /> {t('profile.disableTwoFactor')}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setup.mutate();
                setDialog('enable');
              }}
            >
              <ShieldCheck aria-hidden /> {t('profile.enableTwoFactor')}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t('profile.twoFactorApps')}</p>
      </CardContent>
      <EnableDialog
        open={dialog === 'enable'}
        onOpenChange={(o) => setDialog(o ? 'enable' : null)}
        setup={setup}
      />
      <DisableDialog open={dialog === 'disable'} onOpenChange={(o) => setDialog(o ? 'disable' : null)} />
    </Card>
  );
}
