import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatCompact, formatCurrency, formatDate, formatNumber, formatQuantity } from '@/lib/format';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Charts, Period } from '../api/dashboard-api';
import { CHART_COLORS } from '../lib';

/*
 * Chart styling follows one spec: 2px lines with a ~10% wash, bars at most 24px with a 4px rounded
 * data end, hairline horizontal grid only, muted axis text, a legend for two or more series and a
 * tooltip on every mark. Series colours come from the validated --chart-* tokens; text never wears them.
 */

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' };
const GRID = { stroke: 'var(--border)', vertical: false } as const;
const compact = (v: number) => formatCompact(v);

/** "2026-10-03" → "3 Oct"; "2026-10" → "Oct 26". */
function bucketLabel(bucket: string) {
  if (bucket.length === 7) return formatDate(`${bucket}-01`, { month: 'short', year: '2-digit' });
  return formatDate(bucket, { day: 'numeric', month: 'short' });
}

/** Tooltip card in the app's popover style: label on top, one row per series with its swatch. */
function ChartTooltip({
  active,
  payload,
  label,
  format = (v: number) => formatCurrency(v),
  title = (l: string) => bucketLabel(l),
}: {
  active?: boolean;
  payload?: readonly {
    dataKey?: unknown;
    name?: unknown;
    value?: unknown;
    color?: string;
    payload?: unknown;
  }[];
  label?: unknown;
  format?: (v: number, row: Record<string, unknown>) => string;
  title?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label != null && <div className="mb-1.5 font-medium">{title(String(label))}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-[2px]" style={{ background: p.color }} aria-hidden />
              {String(p.name ?? '')}
            </span>
            <span className="font-medium tabular-nums">
              {format(Number(p.value), (p.payload ?? {}) as Record<string, unknown>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  description,
  action,
  children,
  className,
  height = 'h-64',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={height}>{children}</CardContent>
    </Card>
  );
}

function Empty() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <BarChart3 className="size-5 opacity-50" aria-hidden />
      {t('dashboard.noData')}
    </div>
  );
}

const numeric = (rows: Record<string, string | number | null | undefined>[] | undefined, keys: string[]) =>
  (rows ?? []).map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k] ?? 0)])) }));

/** Sales vs purchases: two lines with a light wash, one axis. */
function FlowChart({ charts, range }: { charts: Charts; range?: string }) {
  const { t } = useTranslation();
  const rows = numeric(charts.salesVsPurchases, ['sales', 'purchases']);
  const hasSales = rows.length > 0 && 'sales' in (charts.salesVsPurchases?.[0] ?? {});
  const hasPurchases = rows.length > 0 && 'purchases' in (charts.salesVsPurchases?.[0] ?? {});
  const series = [
    hasSales && { key: 'sales', label: t('dashboard.kpis.sales'), color: CHART_COLORS[0] },
    hasPurchases && { key: 'purchases', label: t('dashboard.kpis.purchases'), color: CHART_COLORS[1] },
  ].filter(Boolean) as { key: string; label: string; color: string }[];
  const total = (k: string) => rows.reduce((s, r) => s + Number((r as Record<string, unknown>)[k] ?? 0), 0);

  return (
    <ChartCard
      title={t('dashboard.charts.salesVsPurchases')}
      description={range}
      action={series.length > 1 && <Legend items={series} />}
      height="h-72"
      className="lg:col-span-2"
    >
      {rows.some((r) => series.some((s) => (r as Record<string, unknown>)[s.key])) ? (
        <div className="flex h-full flex-col gap-3">
          <div className="flex gap-6">
            {series.map((s) => (
              <div key={s.key}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </div>
                <div className="text-lg font-semibold tabular-nums">{formatCurrency(total(s.key))}</div>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer>
              <AreaChart data={rows} margin={{ top: 4, left: 0, right: 4, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={bucketLabel}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis tickFormatter={compact} tick={AXIS} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  content={(p) => <ChartTooltip {...p} />}
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                />
                {series.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    fill={s.color}
                    fillOpacity={0.08}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

/** Monthly gross and net profit: grouped columns, 4px rounded tops, capped width. */
function ProfitChart({ charts }: { charts: Charts }) {
  const { t } = useTranslation();
  const rows = numeric(charts.monthlyProfit, ['sales', 'grossProfit', 'netProfit']);
  const series = [
    { key: 'grossProfit', label: t('dashboard.kpis.grossProfit'), color: CHART_COLORS[0] },
    { key: 'netProfit', label: t('dashboard.charts.netProfit'), color: CHART_COLORS[2] },
  ];
  return (
    <ChartCard
      title={t('dashboard.charts.monthlyProfit')}
      description={t('dashboard.charts.last12Months')}
      action={<Legend items={series} />}
    >
      {rows.some((r) => r.grossProfit || r.netProfit) ? (
        <ResponsiveContainer>
          <BarChart
            data={rows}
            margin={{ top: 4, left: 0, right: 4, bottom: 0 }}
            barGap={2}
            barCategoryGap="28%"
          >
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="bucket"
              tickFormatter={bucketLabel}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tickFormatter={compact} tick={AXIS} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              content={(p) => <ChartTooltip {...p} />}
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

/** Production output: single series, so no legend box — the title names it. */
function OutputChart({ charts, range }: { charts: Charts; range?: string }) {
  const { t } = useTranslation();
  const rows = numeric(charts.productionOutput, ['quantity', 'cost']);
  return (
    <ChartCard title={t('dashboard.charts.productionOutput')} description={range}>
      {rows.some((r) => r.quantity) ? (
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 4, left: 0, right: 4, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="bucket"
              tickFormatter={bucketLabel}
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis tickFormatter={compact} tick={AXIS} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              content={(p) => (
                <ChartTooltip
                  {...p}
                  format={(v, row) =>
                    `${formatQuantity(String(v))} · ${formatCurrency(Number(row.cost ?? 0))}`
                  }
                />
              )}
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            />
            <Bar
              dataKey="quantity"
              name={t('dashboard.charts.unitsMade')}
              fill={CHART_COLORS[2]}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

/** Sales by category: donut plus a value list (identity never by colour alone). */
function CategoryChart({ charts, range }: { charts: Charts; range?: string }) {
  const { t } = useTranslation();
  const raw = (charts.salesByCategory ?? []).map((c) => ({
    name: c.name ?? t('dashboard.uncategorised'),
    value: Number(c.amount),
  }));
  // Five colours at most: the rest folds into "Other".
  const top = raw.slice(0, 4);
  const rest = raw.slice(4).reduce((s, c) => s + c.value, 0);
  const rows = rest > 0 ? [...top, { name: t('dashboard.other'), value: rest }] : top;
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ChartCard title={t('dashboard.charts.salesByCategory')} description={range} height="h-auto min-h-64">
      {rows.length ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative size-40 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={1.5}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {rows.map((r, i) => (
                    <Cell key={r.name} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={(p) => <ChartTooltip {...p} title={() => ''} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground">{t('dashboard.total')}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCompact(total)}</span>
            </div>
          </div>
          <ul className="flex w-full min-w-0 flex-col gap-2 text-sm">
            {rows.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: CHART_COLORS[i] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumber((r.value / total) * 100, { decimals: 0 })}%
                </span>
                <span className="w-24 text-right font-medium tabular-nums">{formatCurrency(r.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

/** Top products as a ranked list with inline bars — easier to read than a chart with long labels. */
function TopProducts({ charts, range }: { charts: Charts; range?: string }) {
  const { t } = useTranslation();
  const rows = (charts.topProducts ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <ChartCard title={t('dashboard.charts.topProducts')} description={range} height="h-auto min-h-64">
      {rows.length ? (
        <ol className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <li
              key={r.productId}
              className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-3 gap-y-1 text-sm"
            >
              <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="min-w-0 truncate" title={r.name}>
                {r.name}
              </span>
              <span className="text-right font-medium tabular-nums">{formatCurrency(r.amount)}</span>
              <span />
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.amount / max) * 100}%`, background: CHART_COLORS[0] }}
                />
              </div>
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {formatQuantity(r.quantity)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty />
      )}
    </ChartCard>
  );
}

export function DashboardCharts({
  charts,
  period,
  loading,
}: {
  charts?: Charts;
  period?: Period;
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  if (!charts) return null;
  const range = period ? `${formatDate(period.from)} – ${formatDate(period.to)}` : undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.salesVsPurchases && <FlowChart charts={charts} range={range} />}
      {charts.topProducts && <TopProducts charts={charts} range={range} />}
      {charts.salesByCategory && <CategoryChart charts={charts} range={range} />}
      {charts.monthlyProfit && <ProfitChart charts={charts} />}
      {charts.productionOutput && <OutputChart charts={charts} range={range} />}
    </div>
  );
}
