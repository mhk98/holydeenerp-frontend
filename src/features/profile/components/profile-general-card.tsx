import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera, Trash2 } from 'lucide-react';
import { applyServerErrors } from '@/lib/form';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { FormField } from '@/components/common/form-field';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/features/auth/api/auth-api';
import { profileSchema, type ProfileValues } from '@/features/auth/schemas';

const MAX_MB = 2;

export function ProfileGeneralCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user)!;
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = useUpdateProfile();
  const upload = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone ?? '', language: user.language },
  });
  useEffect(() => {
    form.reset({ name: user.name, phone: user.phone ?? '', language: user.language });
  }, [user.name, user.phone, user.language, form]);

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: (u) => {
        setLanguage(u.language);
        toast.success(t('profile.saved'));
      },
      onError: (err) => {
        if (!applyServerErrors(err, form.setError)) toast.error(err.message);
      },
    }),
  );

  const onFile = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return toast.error(t('profile.avatarType'));
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(t('profile.avatarSize', { size: MAX_MB }));
    upload.mutate(file, { onSuccess: () => toast.success(t('profile.avatarUpdated')) });
  };

  return (
    <Card>
      {/* "contents" keeps the Card's header/content/footer spacing intact. */}
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>{t('profile.generalTitle')}</CardTitle>
          <CardDescription>{t('profile.generalDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="size-20 text-lg" />
              {upload.isPending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Spinner />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                >
                  <Camera aria-hidden />{' '}
                  {user.avatarUrl ? t('profile.changePhoto') : t('profile.uploadPhoto')}
                </Button>
                {user.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removeAvatar.isPending}
                    onClick={() =>
                      removeAvatar.mutate(undefined, {
                        onSuccess: () => toast.success(t('profile.avatarRemoved')),
                      })
                    }
                  >
                    <Trash2 aria-hidden /> {t('profile.removePhoto')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('profile.avatarHint', { size: MAX_MB })}</p>
            </div>
          </div>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                label={t('users.fields.name')}
                render={({ field, aria }) => <Input autoComplete="name" {...field} {...aria} />}
              />
              <FormField
                control={form.control}
                name="phone"
                label={t('users.fields.phone')}
                render={({ field, aria }) => <Input type="tel" autoComplete="tel" {...field} {...aria} />}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t('users.fields.email')}</span>
                <Input value={user.email} disabled aria-label={t('users.fields.email')} />
              </div>
              <FormField
                control={form.control}
                name="language"
                label={t('users.fields.language')}
                render={({ field, aria }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="bn">বাংলা</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">{t('users.fields.roles')}</span>
              <div className="flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <Badge key={r.id} variant="secondary">
                    {r.name}
                  </Badge>
                ))}
              </div>
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
            {update.isPending && <Spinner />}
            {t('common.saveChanges')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
