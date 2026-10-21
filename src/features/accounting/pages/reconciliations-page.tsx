import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Scale } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import { Can } from '@/components/common/can';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { todayIn } from '@/features/purchase/lib';
import { useCreateReconciliation, useReconciliations } from '../api/banking-api';
import { BankAccountSelect } from '../components/bank-account-select';
import { ACCOUNTING_ROUTES, DOC_TONE } from '../lib';

/** Bank reconciliations, newest first; start one from a bank statement. */
export default function ReconciliationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useSettingsStore((s) => s.timezone);
  const recs = useReconciliations();
  const create = useCreateReconciliation();
  const [open, setOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const newButton = (
    <Can permission="accounting.create">
      <Button
        onClick={() => {
          setStatementDate(todayIn(timezone));
          setStatementBalance('');
          setError(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden /> {t('accounting.recon.new')}
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('accounting.recon.title')}
        description={t('accounting.recon.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.recon.title') }]}
        actions={newButton}
      />
      <Card>
        <CardContent>
          {recs.isPending ? (
            <Skeleton className="h-40" />
          ) : !recs.data?.length ? (
            <EmptyState
              icon={Scale}
              title={t('accounting.recon.empty')}
              description={t('accounting.recon.emptyHint')}
              action={newButton}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounting.bank.account')}</TableHead>
                    <TableHead>{t('accounting.recon.statementDate')}</TableHead>
                    <TableHead className="text-right">{t('accounting.recon.statementBalance')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recs.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          to={`${ACCOUNTING_ROUTES.reconciliations}/${r.id}`}
                          className="font-medium hover:underline"
                        >
                          {r.bankAccount.name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(r.statementDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(r.statementBalance)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={DOC_TONE[r.status]}>
                          {t(`accounting.recon.status.${r.status}`)}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounting.recon.new')}</DialogTitle>
            <DialogDescription>{t('accounting.recon.newHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t('accounting.bank.account')}</Label>
              <BankAccountSelect
                value={bankAccountId}
                onChange={setBankAccountId}
                kinds={['bank', 'mobile_wallet']}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-date">{t('accounting.recon.statementDate')}</Label>
                <Input
                  id="rec-date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-balance">{t('accounting.recon.statementBalance')}</Label>
                <Input
                  id="rec-balance"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  value={statementBalance}
                  onChange={(e) => setStatementBalance(e.target.value.trim())}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={
                create.isPending ||
                !bankAccountId ||
                !statementDate ||
                !/^-?\d+(\.\d{1,4})?$/.test(statementBalance)
              }
              onClick={() =>
                create.mutate(
                  { bankAccountId, statementDate, statementBalance },
                  {
                    onSuccess: (rec) => {
                      toast.success(t('accounting.recon.started'));
                      navigate(`${ACCOUNTING_ROUTES.reconciliations}/${rec.id}`);
                    },
                    onError: (err) => setError(err.message),
                  },
                )
              }
            >
              {create.isPending && <Spinner />} {t('accounting.recon.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
