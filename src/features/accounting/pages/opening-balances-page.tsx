import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccountOptions, useOpeningBalances, useSaveOpeningBalances } from '../api/accounting-api';
import { ACCOUNTING_ROUTES, accountName, cents } from '../lib';
import { ACCOUNT_TYPES, type AccountOption, type JournalEntry } from '../types';

/** Customers, suppliers and stock have their own opening balances; the difference is equity's. */
const excluded = (a: AccountOption) =>
  ['receivable', 'payable', 'inventory'].includes(a.subtype) || a.systemKey === 'openingBalanceEquity';

type Amounts = Record<string, { debit: string; credit: string }>;

function OpeningForm({
  accounts,
  initial,
  entry,
}: {
  accounts: AccountOption[];
  initial: { date: string; amounts: Amounts };
  entry: JournalEntry | null;
}) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const language = useSettingsStore((s) => s.language);
  const save = useSaveOpeningBalances();
  const [date, setDate] = useState(initial.date);
  const [amounts, setAmounts] = useState<Amounts>(initial.amounts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editable = can('accounting.update');
  const rows = accounts.filter((a) => !excluded(a));

  const debit = rows.reduce((s, a) => s + cents(amounts[a.id]?.debit), 0);
  const credit = rows.reduce((s, a) => s + cents(amounts[a.id]?.credit), 0);
  const equity = credit - debit;

  // Typing one side clears the other.
  const set = (id: string, side: 'debit' | 'credit', value: string) =>
    setAmounts((prev) => {
      const row = { debit: prev[id]?.debit ?? '', credit: prev[id]?.credit ?? '', [side]: value };
      if (value) row[side === 'debit' ? 'credit' : 'debit'] = '';
      return { ...prev, [id]: row };
    });

  const submit = () => {
    const lines = rows
      .map((a) => ({
        accountId: a.id,
        debit: amounts[a.id]?.debit || '0',
        credit: amounts[a.id]?.credit || '0',
      }))
      .filter((l) => Number(l.debit) > 0 || Number(l.credit) > 0);
    save.mutate(
      { date, lines },
      {
        onSuccess: () => {
          setErrors({});
          toast.success(t('accounting.opening.saved'));
        },
        onError: (err) => {
          const map: Record<string, string> = {};
          for (const e of (err as { errors?: { field: string; message: string }[] }).errors ?? []) {
            const index = Number(e.field.split('.')[1]);
            if (lines[index]) map[lines[index].accountId] = e.message;
          }
          setErrors(map);
          toast.error(err.message);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title={t('accounting.opening.title')}
        description={t('accounting.opening.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.opening.title') }]}
        actions={
          editable && (
            <Button onClick={submit} disabled={save.isPending || !date}>
              {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('common.saveChanges')}
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('accounting.opening.accounts')}</CardTitle>
            <CardDescription>{t('accounting.opening.accountsHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">{t('accounting.account')}</TableHead>
                    <TableHead className="min-w-32 text-right">{t('accounting.debit')}</TableHead>
                    <TableHead className="min-w-32 text-right">{t('accounting.credit')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ACCOUNT_TYPES.flatMap((type) => {
                    const group = rows.filter((a) => a.type === type);
                    if (!group.length) return [];
                    return [
                      <TableRow key={type} className="bg-muted/40 hover:bg-muted/40">
                        <TableCell
                          colSpan={3}
                          className="text-xs font-medium text-muted-foreground uppercase"
                        >
                          {t(`accounting.types.${type}`)}
                        </TableCell>
                      </TableRow>,
                      ...group.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <span className="mr-2 font-mono text-xs text-muted-foreground">{a.code}</span>
                            {accountName(a, language)}
                            {errors[a.id] && <p className="text-xs text-destructive">{errors[a.id]}</p>}
                          </TableCell>
                          {(['debit', 'credit'] as const).map((side) => (
                            <TableCell key={side}>
                              <Input
                                value={amounts[a.id]?.[side] ?? ''}
                                onChange={(e) => set(a.id, side, e.target.value.trim())}
                                inputMode="decimal"
                                readOnly={!editable}
                                className="text-right tabular-nums"
                                aria-label={`${a.code} ${t(`accounting.${side}`)}`}
                                aria-invalid={Boolean(errors[a.id])}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      )),
                    ];
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="text-right font-medium">{t('accounting.total')}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(debit / 100)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(credit / 100)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('accounting.opening.asOf')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-2">
                <Label htmlFor="opening-date">{t('accounting.date')}</Label>
                <Input
                  id="opening-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  readOnly={!editable}
                />
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">{t('accounting.opening.equity')}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(equity / 100)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('accounting.opening.equityHint')}</p>
              {entry && (
                <p className="text-xs text-muted-foreground">
                  {t('accounting.opening.current', { date: formatDate(entry.entryDate) })}{' '}
                  <Link
                    to={`${ACCOUNTING_ROUTES.journals}/${entry.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {entry.number}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
          <Alert>
            <AlertDescription>
              {t('accounting.opening.elsewhere')}{' '}
              <Link to="/sales/customers" className="text-primary hover:underline">
                {t('nav.customers')}
              </Link>{' '}
              ·{' '}
              <Link to="/purchases/suppliers" className="text-primary hover:underline">
                {t('nav.suppliers')}
              </Link>{' '}
              ·{' '}
              <Link to="/inventory/adjustments" className="text-primary hover:underline">
                {t('nav.stockAdjustments')}
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </>
  );
}

export default function OpeningBalancesPage() {
  const accounts = useAccountOptions();
  const opening = useOpeningBalances();
  const initial = useMemo(() => {
    const amounts: Amounts = {};
    for (const l of opening.data?.lines ?? []) {
      amounts[l.accountId] = {
        debit: Number(l.debit) ? String(Number(l.debit)) : '',
        credit: Number(l.credit) ? String(Number(l.credit)) : '',
      };
    }
    return { date: opening.data?.entryDate ?? '', amounts };
  }, [opening.data]);
  if (accounts.isPending || opening.isPending) return <PageSkeleton />;
  return (
    <OpeningForm
      key={opening.data?.id ?? 'new'}
      accounts={accounts.data ?? []}
      initial={initial}
      entry={opening.data ?? null}
    />
  );
}
