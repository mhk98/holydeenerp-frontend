import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { exportRows } from '@/lib/export';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SupplierLedgerEntry } from '@/types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTile } from '@/features/inventory/components/stat-tile';
import { useSupplierLedger } from '../api/purchase-api';
import { DOC_ROUTES } from '../lib';

const ROUTE: Record<SupplierLedgerEntry['type'], string> = {
  bill: DOC_ROUTES.bill,
  payment: DOC_ROUTES.payment,
  return: DOC_ROUTES.return,
  debit_note: DOC_ROUTES.return,
};

/** Supplier statement: opening balance, bills (credit), payments and returns (debit), running balance. */
export default function SupplierLedgerPage() {
  const { supplierId } = useParams();
  const { t } = useTranslation();
  const { can } = usePermission();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const ledger = useSupplierLedger(supplierId, { ...(from && { from }), ...(to && { to }) });
  if (ledger.isPending) return <PageSkeleton />;
  const d = ledger.data;
  if (!d) return null;

  const exportLedger = async (format: 'xlsx' | 'pdf') => {
    try {
      await exportRows<SupplierLedgerEntry>(
        format,
        [
          {
            type: 'bill',
            id: 'opening',
            number: t('purchase.ledger.opening'),
            date: from || '',
            reference: null,
            credit: '',
            debit: '',
            balance: d.opening,
          } as SupplierLedgerEntry,
          ...d.entries,
        ],
        [
          { header: t('purchase.date'), value: (e) => e.date },
          {
            header: t('purchase.ledger.document'),
            value: (e) =>
              e.id === 'opening' ? e.number : `${t(`purchase.ledger.types.${e.type}`)} ${e.number}`,
          },
          { header: t('purchase.reference'), value: (e) => e.reference },
          { header: t('purchase.ledger.debit'), value: (e) => (Number(e.debit) ? e.debit : '') },
          { header: t('purchase.ledger.credit'), value: (e) => (Number(e.credit) ? e.credit : '') },
          { header: t('purchase.balance'), value: (e) => e.balance },
        ],
        {
          filename: `ledger-${d.supplier.code}`,
          title: `${t('purchase.ledger.title')} — ${d.supplier.name}`,
        },
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title={d.supplier.name}
        description={
          <span>
            <span className="font-mono">{d.supplier.code}</span>
            {d.supplier.phone && ` · ${d.supplier.phone}`}
            {d.supplier.paymentTermsDays
              ? ` · ${t('purchase.pdf.termsDays', { days: d.supplier.paymentTermsDays })}`
              : ''}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('nav.suppliers'), to: '/purchases/suppliers' },
          { label: t('purchase.ledger.title') },
        ]}
        actions={
          <>
            {can('purchase.export') && (
              <>
                <Button variant="outline" onClick={() => exportLedger('xlsx')}>
                  <Download aria-hidden /> Excel
                </Button>
                <Button variant="outline" onClick={() => exportLedger('pdf')}>
                  <Download aria-hidden /> PDF
                </Button>
              </>
            )}
            {can(['purchase.create', 'accounting.create']) && (
              <Button asChild>
                <Link to={`${DOC_ROUTES.payment}/new?supplierId=${d.supplier.id}`}>
                  <Wallet aria-hidden /> {t('purchase.payments.new')}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Scale} label={t('purchase.ledger.opening')} value={formatCurrency(d.opening)} />
        <StatTile
          icon={TrendingUp}
          tone="warning"
          label={t('purchase.ledger.billed')}
          value={formatCurrency(d.totalCredit)}
        />
        <StatTile
          icon={TrendingDown}
          tone="success"
          label={t('purchase.ledger.paidAndReturned')}
          value={formatCurrency(d.totalDebit)}
        />
        <StatTile
          icon={Wallet}
          tone={Number(d.closing) > 0 ? 'danger' : 'neutral'}
          label={t('purchase.ledger.closing')}
          value={formatCurrency(d.closing)}
          hint={Number(d.closing) < 0 ? t('purchase.ledger.advanceHint') : undefined}
        />
      </div>
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">{t('purchase.ledger.title')}</CardTitle>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-from">{t('inventory.from')}</Label>
              <Input
                id="ledger-from"
                type="date"
                className="w-44"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-to">{t('inventory.to')}</Label>
              <Input
                id="ledger-to"
                type="date"
                className="w-44"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn('overflow-x-auto rounded-lg border', ledger.isFetching && 'opacity-70')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('purchase.date')}</TableHead>
                  <TableHead>{t('purchase.ledger.document')}</TableHead>
                  <TableHead>{t('purchase.reference')}</TableHead>
                  <TableHead className="text-right">{t('purchase.ledger.debit')}</TableHead>
                  <TableHead className="text-right">{t('purchase.ledger.credit')}</TableHead>
                  <TableHead className="text-right">{t('purchase.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/40">
                  <TableCell>{from ? formatDate(from) : '—'}</TableCell>
                  <TableCell colSpan={4} className="font-medium">
                    {t('purchase.ledger.opening')}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(d.opening)}
                  </TableCell>
                </TableRow>
                {d.entries.map((e) => (
                  <TableRow key={`${e.type}:${e.id}`}>
                    <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{t(`purchase.ledger.types.${e.type}`)}</span>{' '}
                      <Link
                        to={`${ROUTE[e.type]}/${e.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {e.number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.reference ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(e.debit) ? formatCurrency(e.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(e.credit) ? formatCurrency(e.credit) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t('purchase.ledger.closing')}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(d.totalDebit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(d.totalCredit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(d.closing)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {!d.entries.length && <EmptyState title={t('purchase.ledger.empty')} className="mt-4 py-8" />}
        </CardContent>
      </Card>
    </>
  );
}
