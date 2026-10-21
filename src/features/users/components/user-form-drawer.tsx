import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { applyServerErrors } from '@/lib/form';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { FormDrawer } from '@/components/common/form-drawer';
import { FormField } from '@/components/common/form-field';
import { PasswordInput, PasswordRules } from '@/components/common/password-input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useBranches } from '@/features/branches/api/branches-api';
import { useRoles } from '@/features/roles/api/roles-api';
import { useSaveUser, useUser } from '../api/users-api';
import { userFormSchema, type UserFormValues } from '../schemas';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create */
  userId: string | null;
}

const EMPTY: UserFormValues = {
  name: '',
  email: '',
  phone: '',
  password: '',
  language: 'en',
  active: true,
  roleIds: [],
  branchIds: [],
  defaultBranchId: null,
};

export function UserFormDrawer({ open, onOpenChange, userId }: Props) {
  const { t } = useTranslation();
  const isEdit = Boolean(userId);
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin);

  const user = useUser(open ? userId : null);
  const roles = useRoles();
  const branches = useBranches(open);
  const save = useSaveUser();

  const schema = useMemo(() => userFormSchema(isEdit), [isEdit]);
  const form = useForm<UserFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    if (!isEdit) form.reset(EMPTY);
    else if (user.data) {
      const u = user.data;
      form.reset({
        name: u.name,
        email: u.email,
        phone: u.phone ?? '',
        password: '',
        language: u.language,
        active: u.status === 'active',
        roleIds: u.roles.map((r) => r.id),
        branchIds: u.branches.map((b) => b.id),
        defaultBranchId: u.branches.find((b) => b.isDefault)?.id ?? null,
      });
    }
  }, [open, isEdit, user.data, form]);

  const defaultBranchId = useWatch({ control: form.control, name: 'defaultBranchId' });
  const password = useWatch({ control: form.control, name: 'password' });

  // Only Super Admins may hand out the Super Admin role.
  const roleOptions = (roles.data?.rows ?? []).filter((r) => isSuperAdmin || !r.isSuperAdmin);

  const onSubmit = form.handleSubmit(({ active, password: pw, ...values }) => {
    const data = {
      ...values,
      phone: values.phone || null,
      status: active ? ('active' as const) : ('inactive' as const),
      defaultBranchId: values.defaultBranchId ?? values.branchIds[0] ?? null,
      ...(pw && { password: pw }),
    };
    save.mutate(
      { id: userId ?? undefined, data },
      {
        onSuccess: () => {
          toast.success(isEdit ? t('users.updated') : t('users.created'));
          onOpenChange(false);
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    );
  });

  const loading = isEdit && user.isPending;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('users.editTitle') : t('users.createTitle')}
      description={isEdit ? t('users.editDescription') : t('users.createDescription')}
      onSubmit={onSubmit}
      submitting={save.isPending}
      disabled={loading}
      submitLabel={isEdit ? t('common.saveChanges') : t('users.create')}
    >
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : (
        <FieldGroup>
          <FormField
            control={form.control}
            name="name"
            label={t('users.fields.name')}
            render={({ field, aria }) => <Input autoComplete="off" {...field} {...aria} />}
          />
          <FormField
            control={form.control}
            name="email"
            label={t('users.fields.email')}
            render={({ field, aria }) => <Input type="email" autoComplete="off" {...field} {...aria} />}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              label={t('users.fields.phone')}
              render={({ field, aria }) => (
                <Input type="tel" placeholder="+8801XXXXXXXXX" {...field} {...aria} />
              )}
            />
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
          <FormField
            control={form.control}
            name="password"
            label={isEdit ? t('users.fields.newPassword') : t('users.fields.password')}
            description={
              isEdit && !password ? t('users.passwordUnchanged') : <PasswordRules value={password ?? ''} />
            }
            render={({ field, aria }) => <PasswordInput autoComplete="new-password" {...field} {...aria} />}
          />
          <FormField
            control={form.control}
            name="active"
            orientation="horizontal"
            label={
              <span className="flex flex-col gap-0.5">
                <span>{t('users.fields.active')}</span>
                <span className="text-xs font-normal text-muted-foreground">{t('users.activeHint')}</span>
              </span>
            }
            render={({ field, aria }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} {...aria} />
            )}
          />

          <FieldSeparator />

          <Controller
            control={form.control}
            name="roleIds"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={Boolean(fieldState.error)}>
                <FieldLegend>{t('users.fields.roles')}</FieldLegend>
                <FieldDescription>{t('users.rolesHint')}</FieldDescription>
                <div className="grid gap-2">
                  {roles.isPending &&
                    Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}
                  {roleOptions.map((role) => {
                    const checked = field.value.includes(role.id);
                    const id = `role-${role.id}`;
                    return (
                      <Field
                        key={role.id}
                        orientation="horizontal"
                        className={cn('rounded-lg border p-3', checked && 'border-primary/40 bg-primary/5')}
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(v) =>
                            field.onChange(
                              v ? [...field.value, role.id] : field.value.filter((x) => x !== role.id),
                            )
                          }
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={id} className="gap-2">
                            {role.name}
                            {role.isSystem && <Badge variant="secondary">{t('roles.system')}</Badge>}
                          </FieldLabel>
                          {role.description && <FieldDescription>{role.description}</FieldDescription>}
                        </FieldContent>
                      </Field>
                    );
                  })}
                </div>
                {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
              </FieldSet>
            )}
          />

          <FieldSeparator />

          <Controller
            control={form.control}
            name="branchIds"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={Boolean(fieldState.error)}>
                <FieldLegend>{t('users.fields.branches')}</FieldLegend>
                <FieldDescription>{t('users.branchesHint')}</FieldDescription>
                <div className="grid gap-2">
                  {(branches.data ?? []).map((branch) => {
                    const checked = field.value.includes(branch.id);
                    const isDefault = defaultBranchId === branch.id;
                    const id = `branch-${branch.id}`;
                    return (
                      <Field key={branch.id} orientation="horizontal" className="rounded-lg border p-3">
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...field.value, branch.id]
                              : field.value.filter((x) => x !== branch.id);
                            field.onChange(next);
                            const current = form.getValues('defaultBranchId');
                            if (!current || !next.includes(current))
                              form.setValue('defaultBranchId', next[0] ?? null);
                          }}
                        />
                        <FieldLabel htmlFor={id} className="flex-1">
                          {branch.name}
                          <span className="text-xs font-normal text-muted-foreground">{branch.code}</span>
                        </FieldLabel>
                        {checked && (
                          <button
                            type="button"
                            className={cn(
                              'rounded-md px-2 py-0.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                              isDefault
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                            aria-pressed={isDefault}
                            onClick={() => form.setValue('defaultBranchId', branch.id, { shouldDirty: true })}
                          >
                            {isDefault ? t('users.defaultBranch') : t('users.makeDefault')}
                          </button>
                        )}
                      </Field>
                    );
                  })}
                </div>
                {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
              </FieldSet>
            )}
          />
        </FieldGroup>
      )}
    </FormDrawer>
  );
}
