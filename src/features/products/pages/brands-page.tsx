import { useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ImageUp } from 'lucide-react';
import { z } from 'zod';
import { v } from '@/lib/form';
import type { Brand } from '@/types';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { ExcelMenu } from '@/components/common/import-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { brandsResource, useUploadBrandLogo } from '../api/products-api';
import { BrandLogo } from '../components/brand-logo';

const schema = z.object({
  name: v.required().max(150, 'validation.tooLong'),
  code: v.code(),
  description: z.string().max(500, 'validation.tooLong'),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;
const EMPTY: Values = { name: '', code: '', description: '', isActive: true };

function LogoUploader({ brand }: { brand: Brand }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadBrandLogo();
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl);
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <BrandLogo logoUrl={logoUrl} size="size-14" />
      <div className="flex flex-col items-start gap-1">
        <span className="text-sm font-medium">{t('products.brands.logo')}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? <Spinner /> : <ImageUp aria-hidden />} {t('products.brands.uploadLogo')}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={t('products.brands.uploadLogo')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            upload.mutate(
              { id: brand.id, file },
              {
                onSuccess: (b) => {
                  setLogoUrl(b.logoUrl);
                  toast.success(t('products.brands.logoUpdated'));
                },
              },
            );
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function BrandsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<Brand, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: b } }) => (
          <div className="flex items-center gap-2.5 font-medium">
            <BrandLogo logoUrl={b.logoUrl} />
            {b.name}
          </div>
        ),
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((b) => b.code),
      },
      {
        id: 'description',
        enableSorting: false,
        meta: { label: t('fields.description') },
        header: t('fields.description'),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-80 text-muted-foreground">
            {row.original.description ?? '—'}
          </span>
        ),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      resource={brandsResource}
      i18nKey="products.brands"
      permission="products"
      breadcrumbs={[{ label: t('nav.inventory') }, { label: t('products.brands.title') }]}
      columns={columns}
      schema={schema}
      emptyValues={EMPTY}
      toValues={(b) => ({
        name: b.name,
        code: b.code,
        description: b.description ?? '',
        isActive: b.isActive,
      })}
      toPayload={(values) => ({ ...values, description: v.nullIfEmpty(values.description) })}
      headerActions={
        <ExcelMenu
          url="/brands"
          entities={t('products.brands.entities')}
          permission="products"
          invalidate={['brands']}
        />
      }
      exportColumns={[
        { header: t('fields.name'), value: (b) => b.name },
        { header: t('fields.code'), value: (b) => b.code },
        { header: t('fields.description'), value: (b) => b.description },
      ]}
      filters={[
        {
          key: 'isActive',
          label: t('common.status'),
          options: [
            { value: 'true', label: t('common.active') },
            { value: 'false', label: t('common.inactive') },
          ],
        },
      ]}
      drawerExtra={(row) => (row ? <LogoUploader key={row.id} brand={row} /> : null)}
      renderFields={({ control }) => (
        <>
          <TextField control={control} name="name" label={t('fields.name')} placeholder="PRAN" />
          <TextField control={control} name="code" label={t('fields.code')} placeholder="PRAN" />
          <TextareaField control={control} name="description" label={t('fields.description')} />
          <SwitchField control={control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
