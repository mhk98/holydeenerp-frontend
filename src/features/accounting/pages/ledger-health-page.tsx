import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CircleAlert, CircleCheck, RefreshCw, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Can } from '@/components/common/can';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBackfill, useReconciliation } from '../api/accounting-api';
import type { Comparison, PartyMismatch } from '../types';

function Check({
  title,
  hint,
  ok,
  rows,
  children,
}: {
  title: string;
  hint: string;
  ok: boolean;
  rows: { label: string; value: ReactNode; strong?: boolean }[];
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-sm font-medium',
            ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
          )}
        >
          {ok ? (
            <CircleCheck className="size-4" aria-hidden />
          ) : (
            <CircleAlert className="size-4" aria-hidden />
          )}
          {t(ok ? 'accounting.health.ok' : 'accounting.health.mismatch')}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-1.5 text-sm">
          {rows.map((r) => (
            <div
              key={r.label}
              className={cn('flex justify-between gap-2', r.strong && 'border-t pt-1.5 font-medium')}
            >
              <dt className={cn(!r.strong && 'text-muted-foreground')}>{r.label}</dt>
              <dd className="tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </CardContent>
    </Card>
  );
}

function compareRows(t: (k: string) => string, c: Comparison, documentsLabel: string) {
  return [
    { label: t('accounting.health.ledger'), value: formatCurrency(c.ledger) },
    { label: documentsLabel, value: formatCurrency(c.documents) },
    { label: t('accounting.health.difference'), value: formatCurrency(c.difference), strong: true },
  ];
}

function Mismatches({ rows, ledgerRoute }: { rows: PartyMismatch[]; ledgerRoute: string }) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('accounting.health.party')}</TableHead>
            <TableHead className="text-right">{t('accounting.health.ledger')}</TableHead>
            <TableHead className="text-right">{t('accounting.health.documentsShort')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.partyId ?? 'none'}>
              <TableCell>
                {m.partyId ? (
                  <Link to={`${ledgerRoute}/${m.partyId}/ledger`} className="hover:underline">
                    {m.name ?? m.partyId}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{t('accounting.health.noParty')}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(m.ledger)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(m.documents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Ledger health: trial balance and the control accounts against receivables, payables and stock. */
export default function LedgerHealthPage() {
  const { t } = useTranslation();
  const report = useReconciliation();
  const backfill = useBackfill();
  const r = report.data;

  return (
    <>
      <PageHeader
        title={t('accounting.health.title')}
        description={t('accounting.health.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.health.title') }]}
        actions={
          <>
            <Button variant="outline" onClick={() => report.refetch()} disabled={report.isFetching}>
              {report.isFetching ? <Spinner /> : <RefreshCw aria-hidden />} {t('accounting.health.recheck')}
            </Button>
            <Can permission="accounting.approve">
              <Button
                onClick={() =>
                  backfill.mutate(undefined, {
                    onSuccess: ({ posted }) => {
                      const count = Object.values(posted).reduce((s, n) => s + n, 0);
                      toast.success(t('accounting.health.backfilled', { count }));
                    },
                    onError: (err) => toast.error(err.message),
                  })
                }
                disabled={backfill.isPending}
              >
                {backfill.isPending ? <Spinner /> : <Wrench aria-hidden />} {t('accounting.health.backfill')}
              </Button>
            </Can>
          </>
        }
      />
      {report.isPending || !r ? (
        <PageSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert variant={r.ok ? 'default' : 'destructive'}>
            {r.ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
            <AlertTitle>{t(r.ok ? 'accounting.health.allGood' : 'accounting.health.issues')}</AlertTitle>
            <AlertDescription>
              {t(r.ok ? 'accounting.health.allGoodHint' : 'accounting.health.issuesHint')}
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 lg:grid-cols-2">
            <Check
              title={t('accounting.health.trialBalance')}
              hint={t('accounting.health.trialBalanceHint')}
              ok={r.trialBalance.balanced && !r.unbalancedJournals}
              rows={[
                { label: t('accounting.health.totalDebits'), value: formatCurrency(r.trialBalance.debit) },
                { label: t('accounting.health.totalCredits'), value: formatCurrency(r.trialBalance.credit) },
                { label: t('accounting.health.unbalanced'), value: r.unbalancedJournals, strong: true },
              ]}
            />
            <Check
              title={t('accounting.health.inventory')}
              hint={t('accounting.health.inventoryHint')}
              ok={r.inventory.balanced && r.inTransit.balanced}
              rows={[
                ...compareRows(t, r.inventory, t('accounting.health.stockValue')),
                { label: t('accounting.health.inTransit'), value: formatCurrency(r.inTransit.ledger) },
                {
                  label: t('accounting.health.transfersOnRoad'),
                  value: formatCurrency(r.inTransit.documents),
                },
              ]}
            />
            <Check
              title={t('accounting.health.receivables')}
              hint={t('accounting.health.receivablesHint')}
              ok={r.receivables.balanced && !r.receivables.mismatches.length}
              rows={compareRows(t, r.receivables, t('accounting.health.salesDocuments'))}
            >
              <Mismatches rows={r.receivables.mismatches} ledgerRoute="/sales/customers" />
            </Check>
            <Check
              title={t('accounting.health.payables')}
              hint={t('accounting.health.payablesHint')}
              ok={r.payables.balanced && !r.payables.mismatches.length}
              rows={compareRows(t, r.payables, t('accounting.health.purchaseDocuments'))}
            >
              <Mismatches rows={r.payables.mismatches} ledgerRoute="/purchases/suppliers" />
            </Check>
          </div>
        </div>
      )}
    </>
  );
}
