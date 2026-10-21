import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ScrollText } from 'lucide-react';
import { v } from '@/lib/form';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { activeColumn, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { FormField } from '@/components/common/form-field';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { bankAccountsResource } from '../api/banking-api';
import { AccountSelect } from '../components/account-select';
import { ACCOUNTING_ROUTES, KIND_ICON } from '../lib';
import { MONEY_KINDS, type BankAccount, type MoneyKind } from '../types';

const schema = z.object({
  kind: z.enum(MONEY_KINDS as [MoneyKind, ...MoneyKind[]]),
  name: v.required().max(150, 'validation.tooLong'),
  accountId: z.string(),
  bankName: z.string().max(150, 'validation.tooLong'),
  branchName: z.string().max(150, 'validation.tooLong'),
  accountNumber: z.string().max(60, 'validation.tooLong'),
  routingNumber: z.string().max(30, 'validation.tooLong'),
  isActive: z.boolean(),
  notes: z.string().max(500, 'validation.tooLong'),
});
type Values = z.infer<typeof schema>;

const empty: Values = {
  kind: 'bank',
  name: '',
  accountId: '',
  bankName: '',
  branchName: '',
  accountNumber: '',
  routingNumber: '',
  isActive: true,
  notes: '',
};

/** Cash, bank and mobile-wallet accounts with their ledger balances. */
export default function BankAccountsPage() {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<BankAccount, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: b } }) => {
          const Icon = KIND_ICON[b.kind];
          return (
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{b.name}</p>
                {(b.bankName || b.accountNumber) && (
                  <p className="text-xs text-muted-foreground">
                    {[b.bankName, b.accountNumber].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'kind',
        meta: { label: t('accounting.bank.kind') },
        header: sortableHeader(t('accounting.bank.kind')),
        cell: ({ row }) => t(`accounting.bank.kinds.${row.original.kind}`),
      },
      {
        id: 'ledger',
        enableSorting: false,
        meta: { label: t('accounting.bank.ledger') },
        header: t('accounting.bank.ledger'),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.account?.code ?? '—'}</span>,
      },
      {
        id: 'balance',
        enableSorting: false,
        meta: {
          label: t('accounting.balance'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('accounting.balance'),
        cell: ({ row }) => (
          <span className={cn('font-medium', Number(row.original.balance) < 0 && 'text-destructive')}>
            {formatCurrency(row.original.balance)}
          </span>
        ),
      },
      activeColumn(t),
    ],
    [t],
  );

  return (
    <CrudPage
      resource={bankAccountsResource}
      i18nKey="accounting.bank"
      breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.bank.title') }]}
      permission="accounting"
      defaultSort="name"
      columns={columns}
      schema={schema}
      emptyValues={empty}
      filters={[
        {
          key: 'kind',
          label: t('accounting.bank.kind'),
          options: MONEY_KINDS.map((k) => ({ value: k, label: t(`accounting.bank.kinds.${k}`) })),
        },
      ]}
      toValues={(b) => ({
        kind: b.kind,
        name: b.name,
        accountId: b.accountId,
        bankName: b.bankName ?? '',
        branchName: b.branchName ?? '',
        accountNumber: b.accountNumber ?? '',
        routingNumber: b.routingNumber ?? '',
        isActive: b.isActive,
        notes: b.notes ?? '',
      })}
      toPayload={(values, row) => ({
        ...(!row && { kind: values.kind, accountId: values.accountId || null }),
        name: values.name,
        bankName: v.nullIfEmpty(values.bankName),
        branchName: v.nullIfEmpty(values.branchName),
        accountNumber: v.nullIfEmpty(values.accountNumber),
        routingNumber: v.nullIfEmpty(values.routingNumber),
        isActive: values.isActive,
        notes: v.nullIfEmpty(values.notes),
      })}
      rowActions={(b) => (
        <DropdownMenuItem asChild>
          <Link to={`${ACCOUNTING_ROUTES.journals}?accountId=${b.accountId}`}>
            <ScrollText aria-hidden /> {t('accounting.accounts.viewJournals')}
          </Link>
        </DropdownMenuItem>
      )}
      renderFields={(form, { isEdit }) => (
        <>
          <SelectField
            control={form.control}
            name="kind"
            label={t('accounting.bank.kind')}
            disabled={isEdit}
            options={MONEY_KINDS.map((k) => ({ value: k, label: t(`accounting.bank.kinds.${k}`) }))}
          />
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            placeholder="DBBL — Current A/C"
          />
          {form.watch('kind') !== 'cash' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={form.control} name="bankName" label={t('accounting.bank.bankName')} />
                <TextField control={form.control} name="branchName" label={t('accounting.bank.branchName')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  control={form.control}
                  name="accountNumber"
                  label={t('accounting.bank.accountNumber')}
                />
                <TextField
                  control={form.control}
                  name="routingNumber"
                  label={t('accounting.bank.routingNumber')}
                />
              </div>
            </>
          )}
          {!isEdit && (
            <FormField
              control={form.control}
              name="accountId"
              label={t('accounting.bank.linkLedger')}
              description={t('accounting.bank.linkLedgerHint')}
              render={({ field, aria }) => (
                <AccountSelect
                  value={field.value || null}
                  onChange={(id) => field.onChange(id ?? '')}
                  types={['asset']}
                  exclude={(a) => !['cash', 'bank'].includes(a.subtype)}
                  clearLabel={t('accounting.bank.newLedger')}
                  placeholder={t('accounting.bank.newLedger')}
                  {...aria}
                />
              )}
            />
          )}
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          <TextareaField control={form.control} name="notes" label={t('inventory.notes')} />
        </>
      )}
    />
  );
}
