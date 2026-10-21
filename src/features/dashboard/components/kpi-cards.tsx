import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Kpi, KpiKey } from '../api/dashboard-api';
import { KPI_CARDS } from '../lib';

/** Change against the previous period as a small pill; green / red by whether the rise is good news. */
function Delta({ kpi, upIsGood }: { kpi: Kpi; upIsGood: boolean }) {
  const { t } = useTranslation();
  if (kpi.changePercent == null) return null;
  const change = Number(kpi.changePercent);
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const good = change === 0 ? null : change > 0 === upIsGood;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
        good === true && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        good === false && 'bg-red-500/10 text-red-700 dark:text-red-400',
        good === null && 'bg-muted text-muted-foreground',
      )}
      title={t('dashboard.vsPrevious', { percent: formatNumber(Math.abs(change), { decimals: 1 }) })}
    >
      <Icon className="size-3" aria-hidden />
      {formatNumber(Math.abs(change), { decimals: 1 })}%
    </span>
  );
}

function Tile({ k, kpi, className }: { k: (typeof KPI_CARDS)[number]; kpi: Kpi; className?: string }) {
  const { t } = useTranslation();
  const { key, icon: Icon, to, money, upIsGood } = k;
  return (
    <Link
      to={to}
      className={cn(
        'group flex min-w-0 flex-col gap-3 p-5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{t(`dashboard.kpis.${key}`)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="truncate text-2xl font-semibold tracking-tight tabular-nums">
          {money ? formatCurrency(kpi.value) : formatNumber(kpi.value, { decimals: 0 })}
        </span>
        <Delta kpi={kpi} upIsGood={upIsGood} />
      </div>
      <div className="text-xs text-muted-foreground">
        {key === 'pendingProduction' ? (
          <span className={cn(kpi.late && 'font-medium text-red-600 dark:text-red-400')}>
            {t('dashboard.lateOrders', { count: kpi.late ?? 0 })}
          </span>
        ) : kpi.previous != null ? (
          t('dashboard.previousValue', {
            value: money ? formatCurrency(kpi.previous) : formatNumber(kpi.previous, { decimals: 0 }),
          })
        ) : (
          t('dashboard.noComparison')
        )}
      </div>
    </Link>
  );
}

// Hairline dividers: a 1px gap over the border colour; each tile paints the card surface.
const GRID =
  'grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-card';

/** The last tile stretches over an incomplete row so the divider colour never shows through. */
function lastSpan(n: number) {
  const sm = n % 2 ? 'sm:col-span-2' : '';
  const xl = { 0: 'xl:col-span-1', 1: 'xl:col-span-4', 2: 'xl:col-span-3', 3: 'xl:col-span-2' }[n % 4];
  return cn(sm, xl);
}

/** KPI strip (Stripe style): one panel, hairline dividers, only the KPIs the user may see. */
export function KpiCards({ kpis, loading }: { kpis?: Partial<Record<KpiKey, Kpi>>; loading: boolean }) {
  if (loading)
    return (
      <div className={GRID}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  const cards = KPI_CARDS.filter((c) => kpis?.[c.key]);
  if (!cards.length) return null;
  return (
    <div className={GRID}>
      {cards.map((c, i) => (
        <Tile
          key={c.key}
          k={c}
          kpi={kpis![c.key]!}
          className={i === cards.length - 1 ? lastSpan(cards.length) : undefined}
        />
      ))}
    </div>
  );
}
