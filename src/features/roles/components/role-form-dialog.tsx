import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { applyServerErrors, v } from '@/lib/form';
import type { Role } from '@/types';
import { FormField } from '@/components/common/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useRoles, useSaveRole } from '../api/roles-api';

const schema = z.object({
  name: v.required().min(2, 'validation.required').max(100, 'validation.tooLong'),
  description: z.string().max(255, 'validation.tooLong'),
  copyFrom: z.string(),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit name/description of this role; omit to create. */
  role?: Role | null;
}

export function RoleFormDialog({ open, onOpenChange, role }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEdit = Boolean(role);
  const roles = useRoles();
  const save = useSaveRole();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', copyFrom: 'none' },
  });

  useEffect(() => {
    if (open) form.reset({ name: role?.name ?? '', description: role?.description ?? '', copyFrom: 'none' });
  }, [open, role, form]);

  const onSubmit = form.handleSubmit(async ({ name, description, copyFrom }) => {
    let permissionKeys: string[] | undefined;
    if (!isEdit && copyFrom !== 'none') {
      permissionKeys = (await apiGet<Role>(`/roles/${copyFrom}`)).data.permissionKeys;
    }
    save.mutate(
      {
        id: role?.id,
        data: { name, description: description || null, ...(permissionKeys && { permissionKeys }) },
      },
      {
        onSuccess: (saved) => {
          toast.success(isEdit ? t('roles.updated') : t('roles.created'));
          onOpenChange(false);
          if (!isEdit) navigate(`/settings/roles/${saved.id}`);
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{isEdit ? t('roles.editTitle') : t('roles.createTitle')}</DialogTitle>
            <DialogDescription>
              {isEdit ? t('roles.editDescription') : t('roles.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormField
              control={form.control}
              name="name"
              label={t('roles.fields.name')}
              render={({ field, aria }) => (
                <Input autoFocus placeholder={t('roles.namePlaceholder')} {...field} {...aria} />
              )}
            />
            <FormField
              control={form.control}
              name="description"
              label={t('roles.fields.description')}
              render={({ field, aria }) => <Textarea rows={3} {...field} {...aria} />}
            />
            {!isEdit && (
              <FormField
                control={form.control}
                name="copyFrom"
                label={t('roles.fields.copyFrom')}
                description={t('roles.copyFromHint')}
                render={({ field, aria }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('roles.startEmpty')}</SelectItem>
                      {(roles.data?.rows ?? []).map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending || form.formState.isSubmitting}>
              {(save.isPending || form.formState.isSubmitting) && <Spinner />}
              {isEdit ? t('common.saveChanges') : t('roles.createAndEdit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
