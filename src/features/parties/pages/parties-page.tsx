import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { BookOpenText } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { v } from '@/lib/form';
import type { Party, PartyGroup, PartyType } from '@/types';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { CrudPage } from '@/components/common/crud-page';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { ExcelMenu } from '@/components/common/import-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { partyResources } from '../api/parties-api';
import { AddressFields } from '../components/address-fields';
import { emptyParty, NONE, partySchema, toPartyPayload, toPartyValues, type PartyValues } from '../schemas';

const PERMISSION: Record<PartyType, string> = { customer: 'sales', supplier: 'purchase' };

const groupSchema = z.object({
  name: v.required().max(100, 'validation.tooLong'),
  code: v.code(),
  description: z.string().max(255, 'validation.tooLong'),
  isActive: z.boolean(),
});
type GroupValues = z.infer<typeof groupSchema>;

function PartyList({ type }: { type: PartyType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { parties, groups, url } = partyResources[type];
  const groupOptions = groups.useOptions();
  const k = `parties.${type}`;

  const columns = useMemo<ColumnDef<Party, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: p } }) => (
          <div className="min-w-48">
            <div className="flex items-center gap-1.5 font-medium">
              {p.name}
              {p.alsoOtherRole && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                  {t(`parties.${type === 'customer' ? 'supplier' : 'customer'}.also`)}
                </Badge>
              )}
            </div>
            {p.contactPerson && <div className="text-xs text-muted-foreground">{p.contactPerson}</div>}
          </div>
        ),
      },
      {
        id: 'code',
        meta: { label: t('fields.code') },
        header: sortableHeader(t('fields.code')),
        cell: codeCell((p) => p.code),
      },
      {
        id: 'phone',
        enableSorting: false,
        meta: { label: t('fields.phone') },
        header: t('fields.phone'),
        cell: ({ row }) => row.original.phone ?? '—',
      },
      {
        id: 'city',
        enableSorting: false,
        meta: { label: t('parties.addresses.city') },
        header: t('parties.addresses.city'),
        cell: ({ row }) => row.original.defaultAddress?.city ?? '—',
      },
      {
        id: 'group',
        enableSorting: false,
        meta: { label: t('parties.group') },
        header: t('parties.group'),
        cell: ({ row }) => row.original.group?.name ?? '—',
      },
      {
        id: 'creditLimit',
        meta: {
          label: t('parties.creditLimit'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('parties.creditLimit')),
        cell: ({ row }) =>
          Number(row.original.creditLimit) > 0
            ? formatCurrency(row.original.creditLimit)
            : t('parties.noLimit'),
      },
      {
        id: 'paymentTermsDays',
        enableSorting: false,
        meta: { label: t('parties.paymentTerms'), cellClassName: 'tabular-nums' },
        header: t('parties.paymentTerms'),
        cell: ({ row }) => t('parties.days', { count: row.original.paymentTermsDays }),
      },
      activeColumn(t),
    ],
    [t, type],
  );

  return (
    <CrudPage
      embedded
      resource={parties}
      i18nKey={k}
      permission={PERMISSION[type]}
      drawerClassName="sm:max-w-2xl"
      columns={columns}
      rowActions={(p: Party) =>
        type === 'supplier' ? (
          <DropdownMenuItem onSelect={() => navigate(`/purchases/suppliers/${p.id}/ledger`)}>
            <BookOpenText aria-hidden /> {t('purchase.ledger.title')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => navigate(`/sales/customers/${p.id}/ledger`)}>
            <BookOpenText aria-hidden /> {t('sales.ledger.title')}
          </DropdownMenuItem>
        )
      }
      schema={partySchema}
      emptyValues={emptyParty(type)}
      toValues={toPartyValues}
      toPayload={(values: PartyValues) => toPartyPayload(values)}
      headerActions={
        <ExcelMenu
          url={url}
          entities={t(`${k}.entities`)}
          permission={PERMISSION[type]}
          invalidate={[parties.key]}
        />
      }
      filters={[
        {
          key: 'groupId',
          label: t('parties.group'),
          options: (groupOptions.data ?? []).map((g) => ({ value: g.id, label: g.name })),
        },
        {
          key: 'isActive',
          label: t('common.status'),
          options: [
            { value: 'true', label: t('common.active') },
            { value: 'false', label: t('common.inactive') },
          ],
        },
      ]}
      exportColumns={[
        { header: t('fields.code'), value: (p) => p.code },
        { header: t('fields.name'), value: (p) => p.name },
        { header: t('parties.contactPerson'), value: (p) => p.contactPerson },
        { header: t('fields.phone'), value: (p) => p.phone },
        { header: t('fields.email'), value: (p) => p.email },
        { header: t('parties.group'), value: (p) => p.group?.name },
        { header: t('parties.addresses.city'), value: (p) => p.defaultAddress?.city },
        { header: t('parties.creditLimit'), value: (p) => p.creditLimit },
        { header: t('parties.paymentTerms'), value: (p) => p.paymentTermsDays },
      ]}
      renderFields={(form, { isEdit }) => (
        <Tabs defaultValue="general">
          <TabsList className="mb-2">
            <TabsTrigger value="general">{t('parties.tabs.general')}</TabsTrigger>
            <TabsTrigger value="financial">{t('parties.tabs.financial')}</TabsTrigger>
            <TabsTrigger value="addresses">
              {t('parties.tabs.addresses')}
              {form.formState.errors.addresses && (
                <span className="ml-1 size-1.5 rounded-full bg-destructive" aria-hidden />
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="general"
            forceMount
            className="flex flex-col gap-4 data-[state=inactive]:hidden"
          >
            <TextField control={form.control} name="name" label={t('fields.name')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="code"
                label={t('fields.code')}
                placeholder={isEdit ? '' : t('parties.codeAuto')}
                className="font-mono"
              />
              <SelectField
                control={form.control}
                name="groupId"
                label={t('parties.group')}
                options={[
                  { value: NONE, label: t('common.none') },
                  ...(groupOptions.data ?? []).map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
              <TextField control={form.control} name="contactPerson" label={t('parties.contactPerson')} />
              <TextField
                control={form.control}
                name="phone"
                label={t('fields.phone')}
                type="tel"
                placeholder="+8801…"
              />
              <TextField control={form.control} name="email" label={t('fields.email')} type="email" />
              <TextField control={form.control} name="binNo" label={t('parties.bin')} />
              <TextField control={form.control} name="tinNo" label={t('parties.tin')} />
            </div>
            <TextareaField control={form.control} name="notes" label={t('parties.notes')} />
            <SwitchField
              control={form.control}
              name="alsoOtherRole"
              label={t(`${k}.alsoOther`)}
              description={t(`${k}.alsoOtherHint`)}
            />
            <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          </TabsContent>
          <TabsContent
            value="financial"
            forceMount
            className="flex flex-col gap-4 data-[state=inactive]:hidden"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="creditLimit"
                label={t('parties.creditLimit')}
                description={t('parties.creditLimitHint')}
                inputMode="decimal"
              />
              <TextField
                control={form.control}
                name="paymentTermsDays"
                label={t('parties.paymentTermsDays')}
                type="number"
                min={0}
                max={365}
              />
              <TextField
                control={form.control}
                name="openingBalance"
                label={t('parties.openingBalance')}
                inputMode="decimal"
                description={t(`${k}.openingHint`)}
              />
              <SelectField
                control={form.control}
                name="openingBalanceType"
                label={t('parties.openingBalanceType')}
                options={[
                  { value: 'debit', label: t('parties.debit') },
                  { value: 'credit', label: t('parties.credit') },
                ]}
              />
            </div>
          </TabsContent>
          <TabsContent value="addresses" forceMount className="data-[state=inactive]:hidden">
            <AddressFields
              control={form.control}
              setValue={form.setValue}
              watchDefault={(i) => form.watch(`addresses.${i}.isDefault`)}
            />
          </TabsContent>
        </Tabs>
      )}
    />
  );
}

function GroupList({ type }: { type: PartyType }) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<PartyGroup, unknown>[]>(
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
        cell: codeCell((g) => g.code),
      },
      {
        id: 'description',
        enableSorting: false,
        meta: { label: t('fields.description') },
        header: t('fields.description'),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.description ?? '—'}</span>,
      },
      activeColumn(t),
    ],
    [t],
  );
  const empty: GroupValues = { name: '', code: '', description: '', isActive: true };

  return (
    <CrudPage
      embedded
      resource={partyResources[type].groups}
      i18nKey="parties.groups"
      permission={PERMISSION[type]}
      columns={columns}
      schema={groupSchema}
      emptyValues={empty}
      toValues={(g) => ({
        name: g.name,
        code: g.code,
        description: g.description ?? '',
        isActive: g.isActive,
      })}
      toPayload={(values) => ({ ...values, description: v.nullIfEmpty(values.description) })}
      renderFields={({ control }) => (
        <>
          <TextField
            control={control}
            name="name"
            label={t('fields.name')}
            placeholder={type === 'customer' ? 'Wholesale' : 'Local manufacturers'}
          />
          <TextField
            control={control}
            name="code"
            label={t('fields.code')}
            placeholder={type === 'customer' ? 'WHOLESALE' : 'LOCAL'}
          />
          <TextareaField control={control} name="description" label={t('fields.description')} />
          <SwitchField control={control} name="isActive" label={t('common.active')} />
        </>
      )}
    />
  );
}

/** Customers (sales.*) or suppliers (purchase.*) with their groups. */
export default function PartiesPage({ type }: { type: PartyType }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'groups' ? 'groups' : 'list';
  const k = `parties.${type}`;

  return (
    <>
      <PageHeader
        title={t(`${k}.title`)}
        description={t(`${k}.description`)}
        breadcrumbs={[
          { label: t(type === 'customer' ? 'nav.sales' : 'nav.purchases') },
          { label: t(`${k}.title`) },
        ]}
      />
      {/* Switching tabs clears the list's search/filter params. */}
      <Tabs
        value={tab}
        onValueChange={(v) => setParams(v === 'groups' ? { tab: 'groups' } : {}, { replace: true })}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="list">{t(`${k}.title`)}</TabsTrigger>
          <TabsTrigger value="groups">{t('parties.groups.title')}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <PartyList type={type} />
        </TabsContent>
        <TabsContent value="groups">
          <GroupList type={type} />
        </TabsContent>
      </Tabs>
    </>
  );
}
