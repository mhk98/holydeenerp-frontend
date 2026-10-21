import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BookPlus, CheckCheck, FileUp, Link2, Link2Off, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReconAction, useReconciliation } from '../api/banking-api';
import { AccountSelect } from '../components/account-select';
import { StatementImportDialog } from '../components/statement-import-dialog';
import { ACCOUNTING_ROUTES, DOC_TONE } from '../lib';
import type { Reconciliation, StatementLine } from '../types';

function Figure({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn('mt-1 tabular-nums', strong && 'text-lg font-semibold', danger && 'text-destructive')}
      >
        {formatCurrency(value)}
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const query = useReconciliation(id);
  const act = useReconAction(id);
  const [importing, setImporting] = useState(false);
  const [booking, setBooking] = useState<StatementLine | null>(null);
  const [bookAccount, setBookAccount] = useState<string | null>(null);
  const [matching, setMatching] = useState<StatementLine | null>(null);
  const [matchLine, setMatchLine] = useState('');
  const [confirm, setConfirm] = useState<'delete' | 'complete' | null>(null);

  if (query.isPending) return <PageSkeleton />;
  const rec = query.data as Reconciliation | undefined;
  if (!rec?.summary) return null;
  const s = rec.summary;
  const open = rec.status === 'in_progress';
  const editable = open && can('accounting.update');
  const ledger = rec.ledgerLines ?? [];
  const statement = rec.statementLines ?? [];
  const balanced = Number(s.difference) === 0;
  const run = (path: string, body?: unknown, message?: string, method?: 'post' | 'delete') =>
    act.mutate(
      { path, body, method },
      {
        onSuccess: (data) => {
          if (data && 'matched' in data)
            toast.success(t('accounting.recon.autoMatched', { count: data.matched }));
          else if (message) toast.success(message);
        },
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <>
      <PageHeader
        title={`${rec.bankAccount.name} · ${formatDate(rec.statementDate)}`}
        description={
          <span className="flex items-center gap-2">
            <StatusBadge tone={DOC_TONE[rec.status]}>
              {t(`accounting.recon.status.${rec.status}`)}
            </StatusBadge>
            {t('accounting.recon.workspaceHint')}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.recon.title'), to: ACCOUNTING_ROUTES.reconciliations },
          { label: rec.bankAccount.name },
        ]}
        actions={
          <>
            {open && can('accounting.delete') && (
              <Button variant="outline" onClick={() => setConfirm('delete')}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            {editable && (
              <>
                <Button variant="outline" onClick={() => setImporting(true)}>
                  <FileUp aria-hidden /> {t('accounting.recon.import')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => run('/auto-match')}
                  disabled={act.isPending || !statement.length}
                >
                  <Sparkles aria-hidden /> {t('accounting.recon.autoMatch')}
                </Button>
              </>
            )}
            {open && can('accounting.approve') && (
              <Button onClick={() => setConfirm('complete')} disabled={!balanced || act.isPending}>
                <CheckCheck aria-hidden /> {t('accounting.recon.complete')}
              </Button>
            )}
            {!open && can('accounting.approve') && (
              <Button
                variant="outline"
                onClick={() => run('/reopen', undefined, t('accounting.recon.reopened'))}
              >
                <RotateCcw aria-hidden /> {t('accounting.recon.reopen')}
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Figure label={t('accounting.recon.opening')} value={s.openingBalance} />
        <Figure label={t('accounting.recon.clearedDeposits')} value={s.clearedDeposits} />
        <Figure label={t('accounting.recon.clearedPayments')} value={s.clearedPayments} />
        <Figure label={t('accounting.recon.clearedBalance')} value={s.clearedBalance} strong />
        <Figure label={t('accounting.recon.statementBalance')} value={s.statementBalance} strong />
        <Figure label={t('accounting.recon.difference')} value={s.difference} strong danger={!balanced} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('accounting.recon.ledger')}</CardTitle>
            <CardDescription>
              {t('accounting.recon.ledgerHint', {
                balance: formatCurrency(s.ledgerBalance),
                deposits: formatCurrency(s.outstandingDeposits),
                payments: formatCurrency(s.outstandingPayments),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[32rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">{t('accounting.recon.cleared')}</span>
                    </TableHead>
                    <TableHead>{t('accounting.date')}</TableHead>
                    <TableHead>{t('accounting.journals.narration')}</TableHead>
                    <TableHead className="text-right">{t('accounting.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((l) => (
                    <TableRow
                      key={l.id}
                      className={cn(l.cleared && 'bg-emerald-50/60 dark:bg-emerald-950/20')}
                    >
                      <TableCell>
                        <Checkbox
                          checked={l.cleared}
                          disabled={!editable || act.isPending}
                          onCheckedChange={(checked) =>
                            run('/clear', { journalLineId: l.id, cleared: checked === true })
                          }
                          aria-label={t('accounting.recon.tick', { number: l.number })}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(l.date)}</TableCell>
                      <TableCell className="max-w-xs">
                        <Link
                          to={`${ACCOUNTING_ROUTES.journals}/${l.journalId}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {l.number}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">
                          {[l.sourceNo, l.reference, l.narration].filter(Boolean).join(' · ')}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn('text-right tabular-nums', Number(l.amount) < 0 && 'text-destructive')}
                      >
                        {formatCurrency(l.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!ledger.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        {t('accounting.recon.noLedger')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('accounting.recon.statement')}</CardTitle>
            <CardDescription>{t('accounting.recon.statementHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!statement.length ? (
              <p className="text-sm text-muted-foreground">{t('accounting.recon.noStatement')}</p>
            ) : (
              <div className="max-h-[32rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('accounting.date')}</TableHead>
                      <TableHead>{t('fields.description')}</TableHead>
                      <TableHead className="text-right">{t('accounting.amount')}</TableHead>
                      <TableHead className="w-28">
                        <span className="sr-only">{t('common.actions')}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.map((line) => (
                      <TableRow
                        key={line.id}
                        className={cn(line.journalLineId && 'bg-emerald-50/60 dark:bg-emerald-950/20')}
                      >
                        <TableCell className="whitespace-nowrap">{formatDate(line.lineDate)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{line.description ?? '—'}</div>
                          {line.reference && (
                            <div className="text-xs text-muted-foreground">{line.reference}</div>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            Number(line.amount) < 0 && 'text-destructive',
                          )}
                        >
                          {formatCurrency(line.amount)}
                        </TableCell>
                        <TableCell>
                          {editable && (
                            <div className="flex justify-end gap-1">
                              {line.journalLineId ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => run(`/statement/${line.id}/unmatch`)}
                                  aria-label={t('accounting.recon.unmatch')}
                                >
                                  <Link2Off aria-hidden />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      setMatching(line);
                                      setMatchLine('');
                                    }}
                                    aria-label={t('accounting.recon.match')}
                                  >
                                    <Link2 aria-hidden />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      setBooking(line);
                                      setBookAccount(null);
                                    }}
                                    aria-label={t('accounting.recon.book')}
                                  >
                                    <BookPlus aria-hidden />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      run(`/statement/${line.id}`, undefined, undefined, 'delete')
                                    }
                                    aria-label={t('accounting.recon.deleteLine')}
                                  >
                                    <Trash2 aria-hidden />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {importing && (
        <StatementImportDialog
          reconciliationId={rec.id}
          saved={rec.bankAccount.statementMapping}
          open={importing}
          onOpenChange={setImporting}
        />
      )}

      <Dialog open={Boolean(matching)} onOpenChange={(o) => !o && setMatching(null)}>
        <DialogContent>
          {matching && (
            <>
              <DialogHeader>
                <DialogTitle>{t('accounting.recon.match')}</DialogTitle>
                <DialogDescription>
                  {formatDate(matching.lineDate)} · {matching.description} · {formatCurrency(matching.amount)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label>{t('accounting.recon.ledgerLine')}</Label>
                <Select value={matchLine} onValueChange={setMatchLine}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('accounting.recon.pickLedgerLine')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ledger
                      .filter((l) => !l.cleared && Number(l.amount) === Number(matching.amount))
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {formatDate(l.date)} · {l.number} · {formatCurrency(l.amount)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('accounting.recon.sameAmount')}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMatching(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  disabled={!matchLine || act.isPending}
                  onClick={() => {
                    run('/match', { statementLineId: matching.id, journalLineId: matchLine });
                    setMatching(null);
                  }}
                >
                  {act.isPending && <Spinner />} {t('accounting.recon.match')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(booking)} onOpenChange={(o) => !o && setBooking(null)}>
        <DialogContent>
          {booking && (
            <>
              <DialogHeader>
                <DialogTitle>{t('accounting.recon.book')}</DialogTitle>
                <DialogDescription>
                  {t('accounting.recon.bookHint', {
                    kind: t(
                      Number(booking.amount) > 0
                        ? 'accounting.vouchers.types.receipt'
                        : 'accounting.vouchers.types.payment',
                    ),
                    amount: formatCurrency(Math.abs(Number(booking.amount))),
                  })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label>{t('accounting.account')}</Label>
                <AccountSelect
                  value={bookAccount}
                  onChange={setBookAccount}
                  exclude={(a) => ['receivable', 'payable'].includes(a.subtype)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBooking(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  disabled={!bookAccount || act.isPending}
                  onClick={() => {
                    run(
                      `/statement/${booking.id}/book`,
                      { accountId: bookAccount },
                      t('accounting.recon.booked'),
                    );
                    setBooking(null);
                  }}
                >
                  {act.isPending && <Spinner />} {t('accounting.recon.book')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm === 'delete'}
        title={t(confirm === 'delete' ? 'accounting.recon.deleteTitle' : 'accounting.recon.completeTitle')}
        description={t(
          confirm === 'delete' ? 'accounting.recon.deleteText' : 'accounting.recon.completeText',
        )}
        confirmLabel={t(confirm === 'delete' ? 'common.delete' : 'accounting.recon.complete')}
        loading={act.isPending}
        onConfirm={() => {
          if (confirm === 'delete') {
            act.mutate(
              { path: '', method: 'delete' },
              {
                onSuccess: () => navigate(ACCOUNTING_ROUTES.reconciliations, { replace: true }),
                onError: (err) => toast.error(err.message),
              },
            );
          } else {
            run('/complete', undefined, t('accounting.recon.completed'));
          }
          setConfirm(null);
        }}
      />
    </>
  );
}
