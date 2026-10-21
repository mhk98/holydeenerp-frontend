import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { exportRows, type ExportFormat } from '@/lib/export';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useManufacturingReport } from '../api/manufacturing-api';
import { MFG_ROUTES } from '../lib';
import type { ReportName, ReportRow } from '../types';

const REPORTS: ReportName[] = ['production', 'consumption', 'wastage', 'cost-variance', 'work-centers'];
type Kind = 'text' | 'qty' | 'money' | 'pct' | 'minutes' | 'date' | 'order';
interface Column {
  key: string;
  label: string;
  kind: Kind;
}

const productOf = (r: ReportRow) => (r.variant ? `${r.product} — ${r.variant}` : String(r.product ?? ''));

function columnsFor(name: ReportName, t: TFunction): Column[] {
  const c = (key: string, label: string, kind: Kind = 'text'): Column => ({ key, label: t(label), kind });
  switch (name) {
    case 'production':
      return [
        c('number', 'manufacturing.orders.number', 'order'),
        c('product', 'manufacturing.product'),
        c('completedOn', 'manufacturing.reports.completedOn', 'date'),
        c('quantity', 'manufacturing.reports.planned', 'qty'),
        c('good', 'manufacturing.orders.goodQuantity', 'qty'),
        c('scrapped', 'manufacturing.orders.scrapped', 'qty'),
        c('yieldPercent', 'manufacturing.reports.yield', 'pct'),
        c('standardCost', 'manufacturing.cost.standard', 'money'),
        c('actualCost', 'manufacturing.cost.actual', 'money'),
        c('unitCost', 'manufacturing.cost.unit', 'money'),
      ];
    case 'consumption':
      return [
        c('product', 'manufacturing.product'),
        c('sku', 'manufacturing.reports.sku'),
        c('planned', 'manufacturing.reports.planned', 'qty'),
        c('used', 'manufacturing.reports.used', 'qty'),
        c('difference', 'manufacturing.reports.difference', 'qty'),
        c('differencePercent', 'manufacturing.reports.differencePercent', 'pct'),
        c('unitCost', 'manufacturing.cost.unit', 'money'),
        c('cost', 'manufacturing.cost.cost', 'money'),
      ];
    case 'wastage':
      return [
        c('product', 'manufacturing.product'),
        c('produced', 'manufacturing.orders.produced', 'qty'),
        c('scrapped', 'manufacturing.orders.scrapped', 'qty'),
        c('scrapPercent', 'manufacturing.reports.scrapPercent', 'pct'),
        c('scrapCost', 'manufacturing.reports.scrapCost', 'money'),
        c('orders', 'manufacturing.reports.orders', 'qty'),
      ];
    case 'cost-variance':
      return [
        c('number', 'manufacturing.orders.number', 'order'),
        c('product', 'manufacturing.product'),
        c('good', 'manufacturing.orders.goodQuantity', 'qty'),
        c('materialVariance', 'manufacturing.reports.materialVariance', 'money'),
        c('labourVariance', 'manufacturing.reports.labourVariance', 'money'),
        c('overheadVariance', 'manufacturing.reports.overheadVariance', 'money'),
        c('totalVariance', 'manufacturing.reports.totalVariance', 'money'),
      ];
    case 'work-centers':
      return [
        c('code', 'fields.code'),
        c('name', 'fields.name'),
        c('operations', 'manufacturing.reports.operations', 'qty'),
        c('plannedMinutes', 'manufacturing.reports.plannedMinutes', 'minutes'),
        c('actualMinutes', 'manufacturing.reports.actualMinutes', 'minutes'),
        c('capacityMinutes', 'manufacturing.reports.capacityMinutes', 'minutes'),
        c('utilisationPercent', 'manufacturing.reports.utilisation', 'pct'),
        c('efficiencyPercent', 'manufacturing.reports.efficiency', 'pct'),
        c('cost', 'manufacturing.cost.cost', 'money'),
      ];
  }
}

const valueOf = (row: ReportRow, col: Column) => (col.key === 'product' ? productOf(row) : row[col.key]);

function display(row: ReportRow, col: Column) {
  const v = valueOf(row, col);
  if (v == null || v === '') return '—';
  switch (col.kind) {
    case 'qty':
      return formatQuantity(String(v));
    case 'money':
      return formatCurrency(String(v));
    case 'pct':
      return `${Number(v).toFixed(1)}%`;
    case 'minutes':
      return formatQuantity(String(Math.round(Number(v))));
    case 'date':
      return formatDate(String(v));
    case 'order':
      return (
        <Link to={`${MFG_ROUTES.orders}/${row.id}`} className="font-mono text-sm hover:underline">
          {String(v)}
        </Link>
      );
    default:
      return String(v);
  }
}

const numeric = (k: Kind) => ['qty', 'money', 'pct', 'minutes'].includes(k);

/** Production, consumption, wastage, cost variance and work-center utilisation over a period. */
export default function ManufacturingReportsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const name = (REPORTS as string[]).includes(params.get('report') ?? '')
    ? (params.get('report') as ReportName)
    : 'production';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const report = useManufacturingReport(name, { from: from || undefined, to: to || undefined });
  const columns = useMemo(() => columnsFor(name, t), [name, t]);
  const set = (patch: Record<string, string>) =>
    setParams((p) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      return p;
    });

  const data = report.data;
  const onExport = async (format: ExportFormat) => {
    if (!data) return;
    try {
      await exportRows(
        format,
        data.rows,
        columns.map((col) => ({ header: col.label, value: (r: ReportRow) => valueOf(r, col) })),
        {
          filename: `manufacturing-${name}`,
          title: `${t(`manufacturing.reports.names.${name}`)} · ${formatDate(data.from)} – ${formatDate(data.to)}`,
        },
      );
    } catch {
      toast.error(t('table.exportFailed'));
    }
  };

  return (
    <>
      <PageHeader
        title={t('manufacturing.reports.title')}
        description={t('manufacturing.reports.description')}
        breadcrumbs={[{ label: t('nav.manufacturing') }, { label: t('manufacturing.reports.title') }]}
        actions={
          can('manufacturing.export') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!data?.rows.length}>
                  <Download aria-hidden /> {t('table.export')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['xlsx', 'csv', 'pdf'] as const).map((f) => (
                  <DropdownMenuItem key={f} onSelect={() => void onExport(f)}>
                    {f.toUpperCase()}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      <Tabs value={name} onValueChange={(v) => set({ report: v })} className="mb-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {REPORTS.map((r) => (
            <TabsTrigger key={r} value={r}>
              {t(`manufacturing.reports.names.${r}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          className="w-40"
          value={from || data?.from || ''}
          onChange={(e) => set({ from: e.target.value })}
          aria-label={t('manufacturing.from')}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          className="w-40"
          value={to || data?.to || ''}
          onChange={(e) => set({ to: e.target.value })}
          aria-label={t('manufacturing.to')}
        />
      </div>

      {data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.summary).map(([k, v]) => (
            <Card key={k} className="py-4">
              <CardContent className="px-4">
                <div className="text-xs text-muted-foreground">{t(`manufacturing.reports.summary.${k}`)}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {v == null
                    ? '—'
                    : /Cost|Variance|cost/.test(k)
                      ? formatCurrency(String(v))
                      : /Percent/.test(k)
                        ? `${Number(v).toFixed(1)}%`
                        : formatQuantity(String(v))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {report.isPending ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : report.isError ? (
            <p className="p-4 text-sm text-destructive">{report.error.message}</p>
          ) : !data?.rows.length ? (
            <EmptyState title={t('manufacturing.reports.empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key} className={cn(numeric(col.kind) && 'text-right')}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, i) => (
                  <TableRow key={String(row.id ?? i)}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          numeric(col.kind) && 'text-right tabular-nums',
                          col.key.endsWith('Variance') && Number(row[col.key]) > 0 && 'text-amber-600',
                        )}
                      >
                        {display(row, col)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {name === 'wastage' && (data?.log?.length ?? 0) > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{t('manufacturing.reports.wastageLog')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('manufacturing.dialogs.reason')}</TableHead>
                  <TableHead>{t('manufacturing.product')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.quantity')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.cost.cost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.log!.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{String(r.reason)}</TableCell>
                    <TableCell>{productOf(r)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(String(r.quantity))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(String(r.cost))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
