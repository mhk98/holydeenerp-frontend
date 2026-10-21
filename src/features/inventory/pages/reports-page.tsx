import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlarmClock,
  CalendarX2,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Hourglass,
  Layers,
  PackageMinus,
  Skull,
} from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { exportRows, type ExportFormat } from '@/lib/export';
import { formatCurrency, formatDate, formatNumber, formatPercent, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StockRow, WarehouseStockSummary } from '@/types';
import { DataTablePagination } from '@/components/common/data-table/data-table-pagination';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fetchWholeReport, useReport, type ReportName } from '../api/inventory-api';
import { StatTile } from '../components/stat-tile';
import { WarehouseSelect } from '../components/warehouse-select';

interface Column<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
  /** Plain value for exports (defaults to nothing exported). */
  value?: (row: Row) => string | number | null | undefined;
  align?: 'right';
}

const itemCell = (r: {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
}) => (
  <div className="min-w-48">
    <Link
      to={`/inventory/stock/${r.productId}${r.variantId ? `?variantId=${r.variantId}` : ''}`}
      className="font-medium hover:underline"
    >
      {r.name}
      {r.variantName && ` — ${r.variantName}`}
    </Link>
    <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
  </div>
);
const itemText = (r: { name: string; variantName: string | null }) =>
  r.variantName ? `${r.name} — ${r.variantName}` : r.name;

interface ValuationSummary {
  totalValue: string;
  costingMethod: string;
}
interface CategoryRow {
  categoryId: string | null;
  category: string;
  itemsInStock: number;
  quantity: string;
  totalValue: string;
  share: string;
}
interface SlowSummary {
  slowDays: number;
  deadDays: number;
  count: number;
  totalValue: string;
  deadCount: number;
  deadValue: string;
}
interface AbcSummary {
  totalValue: string;
  from: string | null;
  to: string | null;
  classes: Record<'A' | 'B' | 'C', { count: number; value: string; share: string }>;
}
interface ExpirySummary {
  days: number;
  count: number;
  totalValue: string;
  expiredValue: string;
  nearValue: string;
}

/** Paged report table with export of every matching row. */
function ReportTable<Row, Summary>({
  name,
  params,
  columns,
  rowKey,
  title,
  summary,
}: {
  name: ReportName;
  params: Record<string, string | number | undefined>;
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  title: string;
  summary?: (summary: Summary) => ReactNode;
}) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const [paging, setPaging] = useState({ page: 1, limit: 50 });
  const query = useReport<Row, Summary>(name, { ...params, ...paging });
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const runExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const rows = await fetchWholeReport<Row>(name, params);
      const exportable = columns.filter((c) => c.value);
      await exportRows(
        format,
        rows,
        exportable.map((c) => ({ header: c.header, value: c.value! })),
        { filename: `inventory-${name}`, title },
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {query.data && summary?.(query.data.summary)}
      {!query.data && <Skeleton className="h-20 rounded-xl" />}
      <div className="flex justify-end">
        {can('inventory.export') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={Boolean(exporting) || !query.data?.rows.length}>
                {exporting ? <Spinner /> : <Download aria-hidden />} {t('table.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => runExport('xlsx')}>
                <FileSpreadsheet aria-hidden /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runExport('csv')}>
                <FileText aria-hidden /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runExport('pdf')}>
                <FileType aria-hidden /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className={cn('overflow-x-auto rounded-lg border', query.isFetching && 'opacity-70')}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.align === 'right' ? 'text-right' : undefined}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending &&
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-5" />
                  </TableCell>
                </TableRow>
              ))}
            {query.data?.rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((c) => (
                  <TableCell
                    key={c.header}
                    className={c.align === 'right' ? 'text-right tabular-nums' : undefined}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {query.data && !query.data.rows.length && (
          <EmptyState title={t('inventory.reports.empty')} className="m-4 border-0 py-10" />
        )}
      </div>
      {query.data && query.data.meta.total > paging.limit && (
        <DataTablePagination
          page={paging.page}
          limit={paging.limit}
          total={query.data.meta.total}
          onChange={(patch) =>
            setPaging((p) => ({
              page: patch.limit ? 1 : (patch.page ?? p.page),
              limit: patch.limit ?? p.limit,
            }))
          }
        />
      )}
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────

function ValuationReport({ warehouseId }: { warehouseId?: string }) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<'item' | 'category' | 'warehouse'>('item');
  const title = t('inventory.reports.valuation');
  const summary = (s: ValuationSummary) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <StatTile icon={Coins} label={t('inventory.stockValue')} value={formatCurrency(s.totalValue)} />
      <StatTile
        icon={Layers}
        label={t('inventory.reports.costingMethod')}
        value={t(`settings.inventory.methods.${s.costingMethod}`)}
      />
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={groupBy}
        onValueChange={(v) => v && setGroupBy(v as typeof groupBy)}
        className="justify-start"
      >
        {(['item', 'category', 'warehouse'] as const).map((g) => (
          <ToggleGroupItem key={g} value={g}>
            {t(`inventory.reports.by.${g}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {groupBy === 'item' && (
        <ReportTable<StockRow, ValuationSummary>
          key="item"
          name="valuation"
          title={title}
          params={{ warehouseId, groupBy }}
          rowKey={(r) => r.key}
          summary={summary}
          columns={[
            { header: t('inventory.item'), cell: itemCell, value: itemText },
            {
              header: t('products.sku'),
              cell: (r) => <code className="font-mono text-xs">{r.sku}</code>,
              value: (r) => r.sku,
            },
            { header: t('products.category'), cell: (r) => r.category ?? '—', value: (r) => r.category },
            {
              header: t('inventory.onHand'),
              align: 'right',
              cell: (r) => `${formatQuantity(r.quantity)} ${r.unitCode ?? ''}`,
              value: (r) => r.quantity,
            },
            {
              header: t('inventory.avgCost'),
              align: 'right',
              cell: (r) => formatCurrency(r.avgCost),
              value: (r) => r.avgCost,
            },
            {
              header: t('inventory.stockValue'),
              align: 'right',
              cell: (r) => <span className="font-medium">{formatCurrency(r.totalValue)}</span>,
              value: (r) => r.totalValue,
            },
          ]}
        />
      )}
      {groupBy === 'category' && (
        <ReportTable<CategoryRow, ValuationSummary>
          key="category"
          name="valuation"
          title={title}
          params={{ warehouseId, groupBy }}
          rowKey={(r) => r.categoryId ?? 'none'}
          summary={summary}
          columns={[
            { header: t('products.category'), cell: (r) => r.category, value: (r) => r.category },
            {
              header: t('inventory.reports.itemsInStock'),
              align: 'right',
              cell: (r) => formatNumber(r.itemsInStock),
              value: (r) => r.itemsInStock,
            },
            {
              header: t('inventory.stockValue'),
              align: 'right',
              cell: (r) => <span className="font-medium">{formatCurrency(r.totalValue)}</span>,
              value: (r) => r.totalValue,
            },
            {
              header: t('inventory.reports.share'),
              align: 'right',
              cell: (r) => formatPercent(r.share),
              value: (r) => r.share,
            },
          ]}
        />
      )}
      {groupBy === 'warehouse' && (
        <ReportTable<WarehouseStockSummary, ValuationSummary>
          key="warehouse"
          name="valuation"
          title={title}
          params={{ warehouseId, groupBy }}
          rowKey={(r) => r.id}
          summary={summary}
          columns={[
            { header: t('inventory.warehouse'), cell: (r) => r.name, value: (r) => r.name },
            { header: t('inventory.branch'), cell: (r) => r.branchName, value: (r) => r.branchName },
            {
              header: t('inventory.reports.itemsInStock'),
              align: 'right',
              cell: (r) => formatNumber(r.itemsInStock),
              value: (r) => r.itemsInStock,
            },
            {
              header: t('inventory.stockStatus.low'),
              align: 'right',
              cell: (r) => r.lowCount,
              value: (r) => r.lowCount,
            },
            {
              header: t('inventory.stockValue'),
              align: 'right',
              cell: (r) => <span className="font-medium">{formatCurrency(r.totalValue)}</span>,
              value: (r) => r.totalValue,
            },
          ]}
        />
      )}
    </div>
  );
}

interface SlowRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  unitCode: string | null;
  quantity: string;
  totalValue: string;
  lastIssueAt: string | null;
  idleDays: number;
  class: 'slow' | 'dead';
}

function SlowMovingReport({ warehouseId }: { warehouseId?: string }) {
  const { t } = useTranslation();
  const [cls, setCls] = useState<'slow' | 'dead'>('slow');
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={cls}
        onValueChange={(v) => v && setCls(v as typeof cls)}
        className="justify-start"
      >
        <ToggleGroupItem value="slow">{t('inventory.reports.slowAndDead')}</ToggleGroupItem>
        <ToggleGroupItem value="dead">{t('inventory.reports.deadOnly')}</ToggleGroupItem>
      </ToggleGroup>
      <ReportTable<SlowRow, SlowSummary>
        key={cls}
        name="slow-moving"
        title={t('inventory.reports.slowMoving')}
        params={{ warehouseId, class: cls }}
        rowKey={(r) => r.key}
        summary={(s: SlowSummary) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              icon={Hourglass}
              tone="warning"
              label={t('inventory.reports.idleItems', { days: s.slowDays })}
              value={formatNumber(s.count)}
              hint={formatCurrency(s.totalValue)}
            />
            <StatTile
              icon={Skull}
              tone="danger"
              label={t('inventory.reports.deadItems', { days: s.deadDays })}
              value={formatNumber(s.deadCount)}
              hint={formatCurrency(s.deadValue)}
            />
            <StatTile
              icon={PackageMinus}
              label={t('inventory.reports.tiedUp')}
              value={formatCurrency(s.totalValue)}
            />
          </div>
        )}
        columns={[
          { header: t('inventory.item'), cell: itemCell, value: itemText },
          {
            header: t('inventory.onHand'),
            align: 'right',
            cell: (r) => `${formatQuantity(r.quantity)} ${r.unitCode ?? ''}`,
            value: (r) => r.quantity,
          },
          {
            header: t('inventory.stockValue'),
            align: 'right',
            cell: (r) => formatCurrency(r.totalValue),
            value: (r) => r.totalValue,
          },
          {
            header: t('inventory.reports.lastIssue'),
            cell: (r) => (r.lastIssueAt ? formatDate(r.lastIssueAt) : t('inventory.reports.never')),
            value: (r) => r.lastIssueAt,
          },
          {
            header: t('inventory.reports.idleDays'),
            align: 'right',
            cell: (r) => formatNumber(r.idleDays),
            value: (r) => r.idleDays,
          },
          {
            header: t('inventory.reports.class'),
            cell: (r) => (
              <StatusBadge tone={r.class === 'dead' ? 'danger' : 'warning'}>
                {t(`inventory.reports.classes.${r.class}`)}
              </StatusBadge>
            ),
            value: (r) => t(`inventory.reports.classes.${r.class}`),
          },
        ]}
      />
    </div>
  );
}

interface AbcRow {
  rank: number;
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  unitCode: string | null;
  quantity: string;
  value: string;
  share: string;
  cumulativeShare: string;
  class: 'A' | 'B' | 'C';
}

function AbcReport({ warehouseId }: { warehouseId?: string }) {
  const { t } = useTranslation();
  const [basis, setBasis] = useState<'consumption' | 'stock_value'>('consumption');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const tone = { A: 'success', B: 'warning', C: 'neutral' } as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          variant="outline"
          value={basis}
          onValueChange={(v) => v && setBasis(v as typeof basis)}
          className="justify-start"
        >
          <ToggleGroupItem value="consumption">{t('inventory.reports.basis.consumption')}</ToggleGroupItem>
          <ToggleGroupItem value="stock_value">{t('inventory.reports.basis.stock_value')}</ToggleGroupItem>
        </ToggleGroup>
        {basis === 'consumption' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-40"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t('inventory.from')}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              className="w-40"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t('inventory.to')}
            />
          </div>
        )}
      </div>
      <ReportTable<AbcRow, AbcSummary>
        key={basis}
        name="abc"
        title={t('inventory.reports.abc')}
        params={{ warehouseId, basis, from: from || undefined, to: to || undefined }}
        rowKey={(r) => r.key}
        summary={(s: AbcSummary) => (
          <div className="flex flex-col gap-2">
            {s.from && (
              <p className="text-sm text-muted-foreground">
                {t('inventory.reports.period', { from: formatDate(s.from), to: formatDate(s.to) })}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {(['A', 'B', 'C'] as const).map((k) => (
                <StatTile
                  key={k}
                  icon={Layers}
                  tone={tone[k]}
                  label={t(`inventory.reports.abcClass.${k}`)}
                  value={t('inventory.reports.itemsCount', { count: s.classes[k].count })}
                  hint={`${formatCurrency(s.classes[k].value)} · ${formatPercent(s.classes[k].share)}`}
                />
              ))}
            </div>
          </div>
        )}
        columns={[
          { header: '#', cell: (r) => r.rank, value: (r) => r.rank },
          { header: t('inventory.item'), cell: itemCell, value: itemText },
          {
            header: t('inventory.quantity'),
            align: 'right',
            cell: (r) => `${formatQuantity(r.quantity)} ${r.unitCode ?? ''}`,
            value: (r) => r.quantity,
          },
          {
            header: t('inventory.value'),
            align: 'right',
            cell: (r) => formatCurrency(r.value),
            value: (r) => r.value,
          },
          {
            header: t('inventory.reports.share'),
            align: 'right',
            cell: (r) => formatPercent(r.share, { decimals: 2 }),
            value: (r) => r.share,
          },
          {
            header: t('inventory.reports.cumulative'),
            align: 'right',
            cell: (r) => formatPercent(r.cumulativeShare, { decimals: 2 }),
            value: (r) => r.cumulativeShare,
          },
          {
            header: t('inventory.reports.class'),
            cell: (r) => <StatusBadge tone={tone[r.class]}>{r.class}</StatusBadge>,
            value: (r) => r.class,
          },
        ]}
      />
    </div>
  );
}

interface ExpiryRow {
  key: string;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  unitCode: string | null;
  warehouseName: string;
  quantity: string;
  totalValue: string;
  daysLeft: number;
  status: 'expired' | 'near' | 'ok';
}

const EXPIRY_STATUSES = ['all', 'expired', 'near', 'ok'] as const;

function ExpiryReport({ warehouseId }: { warehouseId?: string }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  // Alerts link here with ?status=expired|near.
  const [status, setStatus] = useState<(typeof EXPIRY_STATUSES)[number]>(() => {
    const s = params.get('status');
    return (EXPIRY_STATUSES as readonly string[]).includes(s ?? '')
      ? (s as (typeof EXPIRY_STATUSES)[number])
      : 'all';
  });
  const tone = { expired: 'danger', near: 'warning', ok: 'success' } as const;
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={status}
        onValueChange={(v) => v && setStatus(v as typeof status)}
        className="flex-wrap justify-start"
      >
        {(['all', 'expired', 'near', 'ok'] as const).map((s) => (
          <ToggleGroupItem key={s} value={s}>
            {t(`inventory.reports.expiryStatus.${s}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ReportTable<ExpiryRow, ExpirySummary>
        key={status}
        name="expiry"
        title={t('inventory.reports.expiry')}
        params={{ warehouseId, status }}
        rowKey={(r) => r.key}
        summary={(s: ExpirySummary) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              icon={CalendarX2}
              tone="danger"
              label={t('inventory.reports.expiredValue')}
              value={formatCurrency(s.expiredValue)}
            />
            <StatTile
              icon={AlarmClock}
              tone="warning"
              label={t('inventory.reports.nearValue', { days: s.days })}
              value={formatCurrency(s.nearValue)}
            />
            <StatTile
              icon={Layers}
              label={t('inventory.reports.batchesListed')}
              value={formatNumber(s.count)}
              hint={formatCurrency(s.totalValue)}
            />
          </div>
        )}
        columns={[
          { header: t('inventory.item'), cell: itemCell, value: itemText },
          {
            header: t('inventory.batch'),
            cell: (r) => <span className="font-mono text-xs">{r.batchNo}</span>,
            value: (r) => r.batchNo,
          },
          { header: t('inventory.warehouse'), cell: (r) => r.warehouseName, value: (r) => r.warehouseName },
          {
            header: t('inventory.expiryDate'),
            cell: (r) => formatDate(r.expiryDate),
            value: (r) => r.expiryDate,
          },
          {
            header: t('inventory.reports.daysLeft'),
            align: 'right',
            cell: (r) => (
              <StatusBadge tone={tone[r.status]}>
                {r.daysLeft < 0
                  ? t('inventory.reports.expiredAgo', { days: -r.daysLeft })
                  : t('inventory.reports.inDays', { days: r.daysLeft })}
              </StatusBadge>
            ),
            value: (r) => r.daysLeft,
          },
          {
            header: t('inventory.onHand'),
            align: 'right',
            cell: (r) => `${formatQuantity(r.quantity)} ${r.unitCode ?? ''}`,
            value: (r) => r.quantity,
          },
          {
            header: t('inventory.stockValue'),
            align: 'right',
            cell: (r) => formatCurrency(r.totalValue),
            value: (r) => r.totalValue,
          },
        ]}
      />
    </div>
  );
}

const REPORTS = ['valuation', 'slow-moving', 'abc', 'expiry'] as const;
type Tab = (typeof REPORTS)[number];

/** Inventory reports. */
export default function InventoryReportsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (REPORTS as readonly string[]).includes(params.get('report') ?? '')
    ? (params.get('report') as Tab)
    : 'valuation';
  const warehouseId = params.get('warehouseId') ?? undefined;
  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        title={t('inventory.reports.title')}
        description={t('inventory.reports.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.reports.title') }]}
        actions={
          <WarehouseSelect
            allowAll
            value={warehouseId ?? null}
            onChange={(id) => set({ warehouseId: id })}
            className="sm:w-64"
            aria-label={t('inventory.warehouse')}
          />
        }
      />
      <Tabs value={tab} onValueChange={(v) => set({ report: v })} className="mb-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="valuation">{t('inventory.reports.valuation')}</TabsTrigger>
          <TabsTrigger value="slow-moving">{t('inventory.reports.slowMoving')}</TabsTrigger>
          <TabsTrigger value="abc">{t('inventory.reports.abc')}</TabsTrigger>
          <TabsTrigger value="expiry">{t('inventory.reports.expiry')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'valuation' && <ValuationReport key={warehouseId} warehouseId={warehouseId} />}
      {tab === 'slow-moving' && <SlowMovingReport key={warehouseId} warehouseId={warehouseId} />}
      {tab === 'abc' && <AbcReport key={warehouseId} warehouseId={warehouseId} />}
      {tab === 'expiry' && <ExpiryReport key={warehouseId} warehouseId={warehouseId} />}
    </>
  );
}
