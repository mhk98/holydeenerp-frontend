import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, RefreshCw, TriangleAlert } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  useDashboardCharts,
  useDashboardKpis,
  useDashboardWidgets,
  type DashboardParams,
  type DashboardRange,
} from '../api/dashboard-api';
import { DashboardCharts } from '../components/dashboard-charts';
import {
  ActivityCard,
  ApprovalsCard,
  AssetMaintenanceCard,
  MySalesCard,
  OverdueInvoicesCard,
  StockWatchCard,
} from '../components/dashboard-widgets';
import { KpiCards } from '../components/kpi-cards';
import { SystemStatusLine } from '../components/system-status-card';

const RANGES: DashboardRange[] = ['today', 'week', 'month', 'custom'];

/** Morning / afternoon / evening greeting key. */
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};

/** A section that failed to load says so and offers a retry instead of disappearing. */
function LoadError({ onRetry, children }: { onRetry: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
        {children ?? t('dashboard.loadError')}
      </span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden /> {t('common.retry')}
      </Button>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h2>;
}

/**
 * Main dashboard: KPIs, charts and widgets from every module for the topbar branch and a period.
 * The server only returns the parts the user may see, so each role gets its own dashboard.
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const name = useAuthStore((s) => s.user?.name ?? '');
  const { can } = usePermission();
  const [range, setRange] = useState<DashboardRange>('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  // A custom period applies once both dates are chosen.
  const params: DashboardParams =
    range === 'custom' && custom.from && custom.to && custom.from <= custom.to
      ? { range, ...custom }
      : { range: range === 'custom' ? 'month' : range };

  const kpis = useDashboardKpis(params);
  const charts = useDashboardCharts(params);
  const widgets = useDashboardWidgets();
  const w = widgets.data?.widgets;
  const period = kpis.data?.period ?? charts.data?.period;
  const fetching = kpis.isFetching || charts.isFetching || widgets.isFetching;
  const refresh = () => {
    void kpis.refetch();
    void charts.refetch();
    void widgets.refetch();
  };

  const hasSide =
    can('inventory.view') || Boolean(w?.pendingApprovals || w?.overdueInvoices || w?.recentActivity?.length);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      {/* Header: greeting and period on the left, the period switcher on the right. */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(`dashboard.greeting.${greeting()}`, { name: name.split(' ')[0] || name })}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden />
            {period
              ? t('dashboard.periodLabel', { from: formatDate(period.from), to: formatDate(period.to) })
              : t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={custom.from}
                max={custom.to || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                aria-label={t('dashboard.from')}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                className="h-8 w-36 text-xs"
                value={custom.to}
                min={custom.from || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                aria-label={t('dashboard.to')}
              />
            </div>
          )}
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v as DashboardRange)}
            aria-label={t('dashboard.period')}
            className="rounded-lg bg-muted p-0.5"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem
                key={r}
                value={r}
                className="h-7 rounded-md px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                {t(`dashboard.ranges.${r}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={refresh}
            disabled={fetching}
            aria-label={t('dashboard.refresh')}
          >
            <RefreshCw className={cn('size-3.5', fetching && 'animate-spin')} aria-hidden />
          </Button>
        </div>
      </header>

      {w?.mySales && <MySalesCard data={w.mySales} />}

      {kpis.isError ? (
        <LoadError onRetry={() => void kpis.refetch()} />
      ) : (
        <KpiCards kpis={kpis.data?.kpis} loading={kpis.isPending} />
      )}

      <div className={cn('grid items-start gap-6', hasSide && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
        <section className="flex min-w-0 flex-col gap-3" aria-label={t('dashboard.performance')}>
          {(charts.isPending || Object.keys(charts.data?.charts ?? {}).length > 0 || charts.isError) && (
            <SectionLabel>{t('dashboard.performance')}</SectionLabel>
          )}
          {charts.isError ? (
            <LoadError onRetry={() => void charts.refetch()} />
          ) : (
            <DashboardCharts
              charts={charts.data?.charts}
              period={charts.data?.period}
              loading={charts.isPending}
            />
          )}
        </section>

        {hasSide && (
          <aside className="flex min-w-0 flex-col gap-3" aria-label={t('dashboard.attention')}>
            <SectionLabel>{t('dashboard.attention')}</SectionLabel>
            {widgets.isError && <LoadError onRetry={() => void widgets.refetch()} />}
            {w?.pendingApprovals && <ApprovalsCard rows={w.pendingApprovals} />}
            {can('inventory.view') && <StockWatchCard />}
            {w?.overdueInvoices && <OverdueInvoicesCard data={w.overdueInvoices} />}
            {widgets.isPending && <Skeleton className="h-64 rounded-xl" />}
            {w?.recentActivity && <ActivityCard rows={w.recentActivity} />}
            {w && <AssetMaintenanceCard data={w.assetMaintenance} />}
          </aside>
        )}
      </div>

      <SystemStatusLine />
    </div>
  );
}
