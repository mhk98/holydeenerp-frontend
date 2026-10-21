import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlarmClock, Coins, Download, HandCoins, Hourglass } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { exportRows } from '@/lib/export';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReceivablesAgingRow as AgingRow } from '@/types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { StatTile } from '@/features/inventory/components/stat-tile';
import { useReceivablesAging } from '../api/sales-api';
import { SALES_ROUTES } from '../lib';

const BUCKETS = ['current', 'd0_30', 'd31_60', 'd61_90', 'd90_plus'] as const;

/** What customers owe, with aging buckets (by due date or invoice date). */
export default function ReceivablesPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const [asOf, setAsOf] = useState('');
  const [basis, setBasis] = useState<'due_date' | 'invoice_date'>('due_date');
  const aging = useReceivablesAging({ ...(asOf && { asOf }), basis });
  const data = aging.data;
  const buckets = basis === 'due_date' ? BUCKETS : BUCKETS.filter((b) => b !== 'current');
  const overdue = data
    ? ['d0_30', 'd31_60', 'd61_90', 'd90_plus'].reduce(
        (s, k) => s + Number(data.totals[k as keyof typeof data.totals]),
        0,
      )
    : 0;

  const exportAging = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (!data) return;
    try {
      await exportRows<AgingRow>(
        format,
        data.rows,
        [
          { header: t('sales.customer'), value: (r) => r.name },
          { header: t('purchase.payables.opening'), value: (r) => r.opening },
          ...buckets.map((b) => ({
            header: t(
              `purchase.payables.buckets.${basis === 'invoice_date' && b === 'd0_30' ? 'age0_30' : b}`,
            ),
            value: (r: AgingRow) => r[b],
          })),
          { header: t('sales.receivables.credits'), value: (r) => r.credits },
          { header: t('purchase.payables.total'), value: (r) => r.total },
        ],
        {
          filename: 'receivables-aging',
          title: `${t('sales.receivables.title')} — ${formatDate(data.asOf)}`,
        },
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title={t('sales.receivables.title')}
        description={t('sales.receivables.description')}
        breadcrumbs={[{ label: t('nav.sales') }, { label: t('sales.receivables.title') }]}
        actions={
          can('sales.export') && (
            <>
              <Button variant="outline" onClick={() => exportAging('xlsx')} disabled={!data?.rows.length}>
                <Download aria-hidden /> Excel
              </Button>
              <Button variant="outline" onClick={() => exportAging('pdf')} disabled={!data?.rows.length}>
                <Download aria-hidden /> PDF
              </Button>
            </>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Coins}
          label={t('sales.receivables.outstanding')}
          value={formatCurrency(data?.totals.total)}
          loading={aging.isPending}
        />
        <StatTile
          icon={AlarmClock}
          tone="danger"
          label={t('purchase.payables.overdue')}
          value={formatCurrency(basis === 'due_date' ? overdue : undefined)}
          loading={aging.isPending}
          to={`${SALES_ROUTES.invoice}?status=unpaid`}
        />
        <StatTile
          icon={Hourglass}
          tone="warning"
          label={t('purchase.payables.buckets.d90_plus')}
          value={formatCurrency(data?.totals.d90_plus)}
          loading={aging.isPending}
        />
        <StatTile
          icon={HandCoins}
          tone="info"
          label={t('sales.receivables.credits')}
          value={formatCurrency(data?.totals.credits)}
          loading={aging.isPending}
        />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle className="text-base">{t('purchase.payables.aging')}</CardTitle>
            <CardDescription>
              {t(basis === 'due_date' ? 'purchase.payables.byDueHint' : 'sales.receivables.byInvoiceHint')}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aging-asof">{t('purchase.payables.asOf')}</Label>
              <Input
                id="aging-asof"
                type="date"
                className="w-44"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={basis}
              onValueChange={(v) => v && setBasis(v as typeof basis)}
            >
              <ToggleGroupItem value="due_date">{t('purchase.payables.byDue')}</ToggleGroupItem>
              <ToggleGroupItem value="invoice_date">{t('sales.receivables.byInvoice')}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {aging.isPending ? (
            <Skeleton className="h-48" />
          ) : !data?.rows.length ? (
            <EmptyState title={t('sales.receivables.empty')} className="py-10" />
          ) : (
            <div className={cn('overflow-x-auto rounded-lg border', aging.isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">{t('sales.customer')}</TableHead>
                    <TableHead className="text-right">{t('purchase.payables.opening')}</TableHead>
                    {buckets.map((b) => (
                      <TableHead key={b} className="text-right">
                        {t(
                          `purchase.payables.buckets.${basis === 'invoice_date' && b === 'd0_30' ? 'age0_30' : b}`,
                        )}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t('sales.receivables.credits')}</TableHead>
                    <TableHead className="text-right">{t('purchase.payables.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.customerId}>
                      <TableCell>
                        <Link
                          to={`${SALES_ROUTES.ledger}/${r.customerId}/ledger`}
                          className="font-medium hover:underline"
                        >
                          {r.name}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          {r.code}
                          {Number(r.creditLimit) > 0 && (
                            <span
                              className={cn(
                                Number(r.total) > Number(r.creditLimit) && 'font-medium text-destructive',
                              )}
                            >
                              {' '}
                              · {t('sales.receivables.limit', { amount: formatCurrency(r.creditLimit) })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(r.opening) ? formatCurrency(r.opening) : '—'}
                      </TableCell>
                      {buckets.map((b) => (
                        <TableCell
                          key={b}
                          className={cn(
                            'text-right tabular-nums',
                            Number(r[b]) > 0 && (b === 'd61_90' || b === 'd90_plus') && 'text-destructive',
                          )}
                        >
                          {Number(r[b]) ? formatCurrency(r[b]) : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {Number(r.credits) ? `−${formatCurrency(r.credits)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>{t('purchase.total')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(data.totals.opening)}
                    </TableCell>
                    {buckets.map((b) => (
                      <TableCell key={b} className="text-right tabular-nums">
                        {formatCurrency(data.totals[b])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums">
                      −{formatCurrency(data.totals.credits)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(data.totals.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
