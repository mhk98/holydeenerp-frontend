import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  Banknote,
  CreditCard,
  FileCheck2,
  Landmark,
  type LucideIcon,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { v } from '@/lib/form';
import type { PaymentMethod, PaymentType } from '@/types';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextField } from '@/components/common/fields';
import { paymentMethodsResource } from '../api/settings-api';

const TYPES: PaymentType[] = ['cash', 'card', 'mobile_wallet', 'bank_transfer', 'cheque', 'other'];
const ICONS: Record<PaymentType, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  mobile_wallet: Smartphone,
  bank_transfer: Landmark,
  cheque: FileCheck2,
  other: Wallet,
};

const schema = z.object({
  name: v.required().max(100, 'validation.tooLong'),
  code: v.code(),
  type: z.enum(TYPES),
  provider: z.string().max(60, 'validation.tooLong'),
  accountNumber: z.string().max(60, 'validation.tooLong'),
  requiresReference: z.boolean(),
  sortOrder: z.string().regex(/^\d{1,4}$/, 'validation.integer'),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const empty: Values = {
  name: '',
  code: '',
  type: 'mobile_wallet',
  provider: '',
  accountNumber: '',
  requiresReference: true,
  sortOrder: '100',
  isActive: true,
};

export default function PaymentMethodsPage() {
  const { t } = useTranslation();
  const typeOptions = TYPES.map((type) => ({
    value: type,
    label: t(`settings.paymentMethods.types.${type}`),
  }));

  const columns = useMemo<ColumnDef<PaymentMethod, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: m } }) => {
          const Icon = ICONS[m.type];
          return (
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{m.name}</p>
                {m.provider && <p className="text-xs text-muted-foreground">{m.provider}</p>}
              </div>
            </div>
          );
        },
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        enableSorting: false,
        header: t('fields.code'),
        cell: codeCell((m) => m.code),
      },
      {
        id: 'type',
        meta: { label: t('fields.type') },
        header: sortableHeader(t('fields.type')),
        cell: ({ row }) => t(`settings.paymentMethods.types.${row.original.type}`),
      },
      {
        id: 'accountNumber',
        meta: { label: t('settings.paymentMethods.account') },
        enableSorting: false,
        header: t('settings.paymentMethods.account'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.accountNumber ?? '—'}</span>,
      },
      {
        id: 'sortOrder',
        meta: { label: t('settings.paymentMethods.sortOrder') },
        header: sortableHeader(t('settings.paymentMethods.sortOrder')),
        cell: ({ row }) => <span className="tabular-nums">{row.original.sortOrder}</span>,
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      resource={paymentMethodsResource}
      i18nKey="settings.paymentMethods"
      defaultSort="sortOrder"
      columns={columns}
      schema={schema}
      emptyValues={empty}
      toValues={(m) => ({
        name: m.name,
        code: m.code,
        type: m.type,
        provider: m.provider ?? '',
        accountNumber: m.accountNumber ?? '',
        requiresReference: m.requiresReference,
        sortOrder: String(m.sortOrder),
        isActive: m.isActive,
      })}
      toPayload={(values) => ({
        ...values,
        sortOrder: Number(values.sortOrder),
        provider: v.nullIfEmpty(values.provider),
        accountNumber: v.nullIfEmpty(values.accountNumber),
      })}
      filters={[{ key: 'type', label: t('fields.type'), options: typeOptions }]}
      renderFields={({ control }) => (
        <>
          <TextField control={control} name="name" label={t('fields.name')} placeholder="bKash" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={control} name="code" label={t('fields.code')} placeholder="BKASH" />
            <SelectField control={control} name="type" label={t('fields.type')} options={typeOptions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={control}
              name="provider"
              label={t('settings.paymentMethods.provider')}
              placeholder="bKash Ltd."
            />
            <TextField
              control={control}
              name="accountNumber"
              label={t('settings.paymentMethods.account')}
              placeholder="01711-000111"
            />
          </div>
          <TextField
            control={control}
            name="sortOrder"
            label={t('settings.paymentMethods.sortOrder')}
            inputMode="numeric"
            description={t('settings.paymentMethods.sortOrderHint')}
          />
          <SwitchField
            control={control}
            name="requiresReference"
            label={t('settings.paymentMethods.requiresReference')}
            description={t('settings.paymentMethods.requiresReferenceHint')}
          />
          <SwitchField control={control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
