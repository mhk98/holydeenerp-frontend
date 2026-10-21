import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Building2, ImageUp, Trash2 } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { applyServerErrors, v } from '@/lib/form';
import { usePermission } from '@/hooks/use-permission';
import type { CompanyProfile } from '@/types';
import { TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useCompany, useRemoveLogo, useUpdateCompany, useUploadLogo } from '../api/settings-api';

const taxId = z
  .string()
  .max(50, 'validation.tooLong')
  .regex(/^[0-9A-Za-z-]*$/, 'validation.taxId');

const schema = z.object({
  name: v.required().max(150, 'validation.tooLong'),
  legalName: z.string().max(200, 'validation.tooLong'),
  email: v.optionalEmail(),
  phone: v.phone(),
  website: z
    .string()
    .trim()
    .max(191, 'validation.tooLong')
    .refine((s) => !s || /^https?:\/\/\S+$/.test(s), 'validation.url'),
  address: z.string().max(1000, 'validation.tooLong'),
  binNo: taxId,
  tinNo: taxId,
  vatRegNo: taxId,
});
type Values = z.infer<typeof schema>;

const toValues = (c: CompanyProfile): Values => ({
  name: c.name,
  legalName: c.legalName ?? '',
  email: c.email ?? '',
  phone: c.phone ?? '',
  website: c.website ?? '',
  address: c.address ?? '',
  binNo: c.binNo ?? '',
  tinNo: c.tinNo ?? '',
  vatRegNo: c.vatRegNo ?? '',
});

function LogoCard({ company, canEdit }: { company: CompanyProfile; canEdit: boolean }) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadLogo();
  const remove = useRemoveLogo();

  const onFile = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return toast.error(t('profile.avatarType'));
    if (file.size > 2 * 1024 * 1024) return toast.error(t('profile.avatarSize', { size: 2 }));
    upload.mutate(file, { onSuccess: () => toast.success(t('settings.company.logoUpdated')) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.company.logo')}</CardTitle>
        <CardDescription>{t('settings.company.logoHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
          {company.logoUrl ? (
            <img
              src={assetUrl(company.logoUrl)}
              alt={t('settings.company.logo')}
              className="size-full object-contain p-2"
            />
          ) : (
            <Building2 className="size-8 text-muted-foreground" aria-hidden />
          )}
          {upload.isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Spinner />
            </div>
          )}
        </div>
        {canEdit && (
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
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              <ImageUp aria-hidden />{' '}
              {company.logoUrl ? t('settings.company.changeLogo') : t('settings.company.uploadLogo')}
            </Button>
            {company.logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => toast.success(t('settings.company.logoRemoved')),
                  })
                }
              >
                <Trash2 aria-hidden /> {t('common.remove')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompanyPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const canEdit = can('settings.update');
  const company = useCompany();
  const update = useUpdateCompany();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: company.data ? toValues(company.data) : undefined,
  });

  useEffect(() => {
    if (company.data) form.reset(toValues(company.data));
  }, [company.data, form]);

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(
      {
        ...values,
        legalName: v.nullIfEmpty(values.legalName),
        email: v.nullIfEmpty(values.email),
        phone: v.nullIfEmpty(values.phone),
        website: v.nullIfEmpty(values.website),
        address: v.nullIfEmpty(values.address),
        binNo: v.nullIfEmpty(values.binNo),
        tinNo: v.nullIfEmpty(values.tinNo),
        vatRegNo: v.nullIfEmpty(values.vatRegNo),
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
        title={t('settings.company.title')}
        description={t('settings.company.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.company.title') }]}
      />
      {!company.data ? (
        <Skeleton className="h-[520px] rounded-xl" />
      ) : (
        <div className="space-y-4">
          <LogoCard company={company.data} canEdit={canEdit} />
          <Card>
            <form onSubmit={onSubmit} noValidate className="contents">
              <CardHeader>
                <CardTitle>{t('settings.company.details')}</CardTitle>
                <CardDescription>{t('settings.company.detailsHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <fieldset disabled={!canEdit} className="contents">
                  <FieldGroup>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField control={form.control} name="name" label={t('settings.company.tradeName')} />
                      <TextField
                        control={form.control}
                        name="legalName"
                        label={t('settings.company.legalName')}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <TextField control={form.control} name="email" label={t('fields.email')} type="email" />
                      <TextField control={form.control} name="phone" label={t('fields.phone')} type="tel" />
                      <TextField
                        control={form.control}
                        name="website"
                        label={t('settings.company.website')}
                        placeholder="https://"
                      />
                    </div>
                    <TextareaField control={form.control} name="address" label={t('fields.address')} />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <TextField
                        control={form.control}
                        name="binNo"
                        label={t('settings.company.bin')}
                        description={t('settings.company.binHint')}
                      />
                      <TextField control={form.control} name="tinNo" label={t('settings.company.tin')} />
                      <TextField
                        control={form.control}
                        name="vatRegNo"
                        label={t('settings.company.vatReg')}
                      />
                    </div>
                  </FieldGroup>
                </fieldset>
              </CardContent>
              {canEdit && (
                <CardFooter className="justify-end border-t">
                  <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
                    {update.isPending && <Spinner />}
                    {t('common.saveChanges')}
                  </Button>
                </CardFooter>
              )}
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
