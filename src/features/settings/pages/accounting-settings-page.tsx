import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Badge } from '@/components/ui/badge';
import { useAccountMapping, useSaveAccountMapping } from '@/features/accounting/api/accounting-api';
import { AccountSelect } from '@/features/accounting/components/account-select';
import { accountLabel } from '@/features/accounting/lib';
import type { AccountMapping } from '@/features/accounting/types';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsFormCard } from '../components/settings-form-card';

type Choice = Record<string, string | null>;

function MappingForm({ mapping }: { mapping: AccountMapping }) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const save = useSaveAccountMapping();
  const initialKeys = (): Choice =>
    Object.fromEntries(
      Object.values(mapping.groups)
        .flat()
        .map((m) => [m.key, m.isDefault ? null : (m.account?.id ?? null)]),
    );
  const initialMethods = (): Choice =>
    Object.fromEntries(mapping.paymentMethods.map((m) => [m.id, m.account?.id ?? null]));
  const [keys, setKeys] = useState<Choice>(initialKeys);
  const [methods, setMethods] = useState<Choice>(initialMethods);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const keysDirty = JSON.stringify(keys) !== JSON.stringify(initialKeys());
  const methodsDirty = JSON.stringify(methods) !== JSON.stringify(initialMethods());

  const submit = (data: { accounts?: Choice; paymentMethods?: Choice }) =>
    save.mutate(data, {
      onSuccess: () => {
        setErrors({});
        toast.success(t('settings.saved'));
      },
      onError: (err) => {
        const map: Record<string, string> = {};
        for (const e of (err as { errors?: { field: string; message: string }[] }).errors ?? [])
          map[e.field] = e.message;
        setErrors(map);
        toast.error(err.message);
      },
    });

  return (
    <div className="flex flex-col gap-4">
      <SettingsFormCard
        title={t('settings.accounting.postingTitle')}
        description={t('settings.accounting.postingHint')}
        editPermission="accounting.update"
        saving={save.isPending}
        dirty={keysDirty}
        onSubmit={(e) => {
          e.preventDefault();
          submit({ accounts: keys });
        }}
      >
        {Object.entries(mapping.groups).map(([group, rows]) => (
          <section key={group} className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t(`settings.accounting.groups.${group}`)}
            </h3>
            {rows.map((m) => {
              const field = `accounts.${m.key}`;
              const fallback = m.isDefault ? m.account : null;
              return (
                <div
                  key={m.key}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-start"
                >
                  <div>
                    <div className="text-sm font-medium">{t(`settings.accounting.keys.${m.key}`)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`settings.accounting.hints.${m.key}`)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <AccountSelect
                      value={keys[m.key] ?? null}
                      types={m.types}
                      onChange={(id) => setKeys((k) => ({ ...k, [m.key]: id }))}
                      clearLabel={t('settings.accounting.useDefault')}
                      placeholder={
                        fallback
                          ? t('settings.accounting.defaultIs', { account: accountLabel(fallback, language) })
                          : undefined
                      }
                      aria-label={t(`settings.accounting.keys.${m.key}`)}
                      aria-invalid={Boolean(errors[field])}
                    />
                    {errors[field] && <p className="text-xs text-destructive">{errors[field]}</p>}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </SettingsFormCard>

      <SettingsFormCard
        title={t('settings.accounting.methodsTitle')}
        description={t('settings.accounting.methodsHint')}
        editPermission="accounting.update"
        saving={save.isPending}
        dirty={methodsDirty}
        onSubmit={(e) => {
          e.preventDefault();
          submit({ paymentMethods: methods });
        }}
      >
        {mapping.paymentMethods.map((m) => {
          const field = `paymentMethods.${m.id}`;
          return (
            <div
              key={m.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-start"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {m.name}
                {!m.isActive && (
                  <Badge variant="outline" className="font-normal">
                    {t('common.inactive')}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <AccountSelect
                  value={methods[m.id] ?? null}
                  types={['asset']}
                  onChange={(id) => setMethods((x) => ({ ...x, [m.id]: id }))}
                  clearLabel={t('settings.accounting.useDefault')}
                  placeholder={
                    m.defaultAccount
                      ? t('settings.accounting.defaultIs', {
                          account: accountLabel(m.defaultAccount, language),
                        })
                      : undefined
                  }
                  aria-label={m.name}
                  aria-invalid={Boolean(errors[field])}
                />
                {errors[field] && <p className="text-xs text-destructive">{errors[field]}</p>}
              </div>
            </div>
          );
        })}
      </SettingsFormCard>
    </div>
  );
}

/** Settings → Accounting: the ledger accounts automatic postings and payment methods use. */
export default function AccountingSettingsPage() {
  const { t } = useTranslation();
  const mapping = useAccountMapping();
  return (
    <>
      <PageHeader title={t('settings.accounting.title')} description={t('settings.accounting.description')} />
      {mapping.isPending || !mapping.data ? <PageSkeleton /> : <MappingForm mapping={mapping.data} />}
    </>
  );
}
