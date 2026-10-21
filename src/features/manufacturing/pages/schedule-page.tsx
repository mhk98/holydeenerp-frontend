import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ListTree } from 'lucide-react';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { todayIn } from '@/features/inventory/schemas';
import { useSchedule, workCentersResource } from '../api/manufacturing-api';
import { MFG_ROUTES, productLabel } from '../lib';
import type { MoStatus } from '../types';

const DAY = 86_400_000;
const ALL = '__all__';
const SPANS = [14, 28, 56] as const;

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (s: string, days: number) => iso(new Date(toDate(s).getTime() + days * DAY));
const diff = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);

const BAR: Record<MoStatus, string> = {
  draft: 'bg-muted-foreground/30 text-foreground',
  confirmed: 'bg-sky-500/80 text-white',
  material_issued: 'bg-sky-600 text-white',
  in_progress: 'bg-amber-500 text-white',
  quality_check: 'bg-violet-500 text-white',
  completed: 'bg-emerald-600 text-white',
  closed: 'bg-emerald-800/70 text-white',
  cancelled: 'bg-destructive/40',
};

/** Gantt view of planned orders: one bar per order over its planned window, today marked. */
export default function SchedulePage() {
  const { t } = useTranslation();
  const timezone = useSettingsStore((s) => s.timezone);
  const today = todayIn(timezone);
  const [span, setSpan] = useState<(typeof SPANS)[number]>(28);
  const [from, setFrom] = useState(() => shift(today, -3));
  const [workCenterId, setWorkCenterId] = useState<string | null>(null);
  const to = shift(from, span - 1);
  const schedule = useSchedule({ from, to, workCenterId: workCenterId ?? undefined });
  const centers = workCentersResource.useOptions({ isActive: 'true' });

  const days = useMemo(() => Array.from({ length: span }, (_, i) => shift(from, i)), [from, span]);
  const todayIndex = diff(from, today);
  const cols = `repeat(${span}, minmax(${span > 28 ? 1.25 : 2}rem, 1fr))`;

  return (
    <>
      <PageHeader
        title={t('manufacturing.schedule.title')}
        description={t('manufacturing.schedule.description')}
        breadcrumbs={[{ label: t('nav.manufacturing') }, { label: t('manufacturing.schedule.title') }]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFrom(shift(from, -7))}
          aria-label={t('manufacturing.schedule.earlier')}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setFrom(shift(today, -3))}>
          {t('manufacturing.schedule.today')}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFrom(shift(from, 7))}
          aria-label={t('manufacturing.schedule.later')}
        >
          <ChevronRight aria-hidden />
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatDate(from)} – {formatDate(to)}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={String(span)} onValueChange={(v) => setSpan(Number(v) as (typeof SPANS)[number])}>
            <SelectTrigger className="w-32" aria-label={t('manufacturing.schedule.span')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPANS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {t('manufacturing.schedule.weeks', { count: s / 7 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={workCenterId ?? ALL} onValueChange={(v) => setWorkCenterId(v === ALL ? null : v)}>
            <SelectTrigger className="w-52" aria-label={t('manufacturing.workCenter')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('manufacturing.schedule.allCenters')}</SelectItem>
              {(centers.data ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {schedule.isPending ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : !schedule.data?.length ? (
            <EmptyState icon={ListTree} title={t('manufacturing.schedule.empty')} />
          ) : (
            <div className="min-w-[48rem]">
              <div
                className="grid border-b text-xs text-muted-foreground"
                style={{ gridTemplateColumns: `14rem ${cols}` }}
              >
                <div className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                  {t('manufacturing.orders.number')}
                </div>
                {days.map((d, i) => {
                  const date = toDate(d);
                  const weekend = [5, 6].includes(date.getUTCDay());
                  return (
                    <div
                      key={d}
                      className={cn(
                        'border-l py-1 text-center tabular-nums',
                        weekend && 'bg-muted/50',
                        i === todayIndex && 'bg-primary/10 font-semibold text-primary',
                      )}
                    >
                      <div>{date.getUTCDate()}</div>
                      {(i === 0 || date.getUTCDate() === 1) && (
                        <div className="text-[10px]">
                          {date.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {schedule.data.map((mo) => {
                const start = Math.max(0, diff(from, mo.plannedStart));
                const end = Math.min(span - 1, diff(from, mo.plannedEnd));
                const clippedLeft = diff(from, mo.plannedStart) < 0;
                const clippedRight = diff(from, mo.plannedEnd) > span - 1;
                return (
                  <div
                    key={mo.id}
                    className="grid items-center border-b last:border-b-0 hover:bg-muted/30"
                    style={{ gridTemplateColumns: `14rem ${cols}` }}
                  >
                    <div className="sticky left-0 z-10 min-w-0 bg-card px-3 py-2">
                      <Link
                        to={`${MFG_ROUTES.orders}/${mo.id}`}
                        className="font-mono text-xs font-medium hover:underline"
                      >
                        {mo.number}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {productLabel(mo.product, mo.variant)}
                      </div>
                    </div>
                    <div className="relative h-full min-h-12" style={{ gridColumn: `2 / span ${span}` }}>
                      {todayIndex >= 0 && todayIndex < span && (
                        <div
                          className="absolute inset-y-0 w-px bg-primary/50"
                          style={{ left: `${((todayIndex + 0.5) / span) * 100}%` }}
                          aria-hidden
                        />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            to={`${MFG_ROUTES.orders}/${mo.id}`}
                            className={cn(
                              'absolute top-1/2 flex h-6 -translate-y-1/2 items-center truncate rounded px-2 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                              BAR[mo.status],
                              clippedLeft && 'rounded-l-none',
                              clippedRight && 'rounded-r-none',
                            )}
                            style={{
                              left: `${(start / span) * 100}%`,
                              width: `${((end - start + 1) / span) * 100}%`,
                            }}
                          >
                            × {formatQuantity(mo.quantity)}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="font-medium">
                            {mo.number} · {t(`manufacturing.status.${mo.status}`)}
                          </div>
                          <div>
                            {formatDate(mo.plannedStart)} – {formatDate(mo.plannedEnd)}
                          </div>
                          {(mo.operations ?? []).map((op) => (
                            <div key={op.id} className="text-xs opacity-80">
                              {op.name} · {op.workCenter?.code} · {t(`manufacturing.opStatus.${op.status}`)}
                            </div>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
