import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { applyServerErrors } from '@/lib/form';
import { FormField } from '@/components/common/form-field';
import { PasswordInput, PasswordRules } from '@/components/common/password-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useChangePassword } from '@/features/auth/api/auth-api';
import { changePasswordSchema, type ChangePasswordValues } from '@/features/auth/schemas';

export function ChangePasswordCard() {
  const { t } = useTranslation();
  const change = useChangePassword();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword: next }) =>
    change.mutate(
      { currentPassword, newPassword: next },
      {
        onSuccess: () => {
          toast.success(t('profile.passwordChanged'));
          form.reset();
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  return (
    <Card>
      {/* "contents" keeps the Card's header/content/footer spacing intact. */}
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>{t('profile.passwordTitle')}</CardTitle>
          <CardDescription>{t('profile.passwordDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="max-w-md">
            <FormField
              control={form.control}
              name="currentPassword"
              label={t('profile.currentPassword')}
              render={({ field, aria }) => (
                <PasswordInput autoComplete="current-password" {...field} {...aria} />
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              label={t('auth.newPassword')}
              description={<PasswordRules value={newPassword} />}
              render={({ field, aria }) => <PasswordInput autoComplete="new-password" {...field} {...aria} />}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              label={t('auth.confirmPassword')}
              render={({ field, aria }) => <PasswordInput autoComplete="new-password" {...field} {...aria} />}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between gap-4 border-t">
          <p className="text-xs text-muted-foreground">{t('profile.passwordSignOutNote')}</p>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending && <Spinner />}
            {t('profile.updatePassword')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
