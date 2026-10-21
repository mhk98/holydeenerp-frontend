import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { v } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { FormField } from '@/components/common/form-field';
import { expenseCategoriesResource } from '../api/banking-api';
import { AccountSelect } from '../components/account-select';
import { ACCOUNTING_ROUTES, accountLabel } from '../lib';
import type { ExpenseCategory } from '../types';

const schema = z.object({
  name: v.required().max(150, 'validation.tooLong'),
  code: v.code(),
  accountId: v.required(),
  description: z.string().max(500, 'validation.tooLong'),
  isActive: z.boolean(),
});

/** Expense categories, each posting to an expense ledger account. */
export default function ExpenseCategoriesPage() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const columns = useMemo<ColumnDef<ExpenseCategory, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((c) => c.code),
      },
      {
        id: 'account',
        enableSorting: false,
        meta: { label: t('accounting.account') },
        header: t('accounting.account'),
        cell: ({ row }) => (row.original.account ? accountLabel(row.original.account, language) : '—'),
      },
      activeColumn(t),
    ],
    [t, language],
  );

  return (
    <CrudPage
      resource={expenseCategoriesResource}
      i18nKey="accounting.expenseCategories"
      breadcrumbs={[
        { label: t('nav.accounting') },
        { label: t('accounting.expenses.title'), to: ACCOUNTING_ROUTES.expenses },
        { label: t('accounting.expenseCategories.title') },
      ]}
      permission="accounting"
      defaultSort="name"
      columns={columns}
      schema={schema}
      emptyValues={{ name: '', code: '', accountId: '', description: '', isActive: true }}
      toValues={(c) => ({
        name: c.name,
        code: c.code,
        accountId: c.accountId,
        description: c.description ?? '',
        isActive: c.isActive,
      })}
      toPayload={(values) => ({ ...values, description: v.nullIfEmpty(values.description) })}
      renderFields={(form) => (
        <>
          <TextField
            control={form.control}
            name="name"
            label={t('fields.name')}
            placeholder="Office supplies"
          />
          <TextField control={form.control} name="code" label={t('fields.code')} placeholder="OFFICE" />
          <FormField
            control={form.control}
            name="accountId"
            label={t('accounting.expenseCategories.account')}
            description={t('accounting.expenseCategories.accountHint')}
            render={({ field, aria }) => (
              <AccountSelect
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? '')}
                types={['expense']}
                {...aria}
              />
            )}
          />
          <TextareaField control={form.control} name="description" label={t('fields.description')} />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}
