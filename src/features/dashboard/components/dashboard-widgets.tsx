import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlarmClock,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  FileClock,
  type LucideIcon,
  MonitorSmartphone,
  PackageX,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { formatCurrency, formatDate, formatQuantity, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useStockAlerts } from '@/features/inventory/api/inventory-api';
import { useApprove, type Approval, type Widgets } from '../api/dashboard-api';
import { DOC_ROUTES } from '../lib';

const docLink = (type: string, id: string) => (DOC_ROUTES[type] ? `${DOC_ROUTES[type]}/${id}` : null);

/** Card frame shared by the widgets: compact title, an optional count, a "view all" link. */
function WidgetCard({
  title,
  description,
  count,
  to,
  children,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  to?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {title}
          {count != null && count > 0 && (
            <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[11px] tabular-nums">
              {count}
            </Badge>
          )}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
        {to && (
          <CardAction>
            <Link
              to={to}
              className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t('dashboard.viewAll')} <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-2">{children}</CardContent>
    </Card>
  );
}

function Quiet({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
      <span className="flex size-8 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      {children}
    </div>
  );
}

/** A list row: hover surface, keyboard focus ring. */
const ROW =
  'flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

export function OverdueInvoicesCard({ data }: { data: NonNullable<Widgets['overdueInvoices']> }) {
  const { t } = useTranslation();
  return (
    <WidgetCard
      title={t('dashboard.widgets.overdue')}
      count={data.count}
      description={
        data.count
          ? t('dashboard.widgets.overdueSummary', { count: data.count, amount: formatCurrency(data.total) })
          : undefined
      }
      to="/sales/receivables"
    >
      {data.rows.length ? (
        <div className="flex flex-col">
          {data.rows.map((r) => (
            <Link key={r.id} to={`/sales/invoices/${r.id}`} className={ROW}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.customer}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono">{r.number}</span> · {formatDate(r.dueDate)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-medium tabular-nums">{formatCurrency(r.balance)}</span>
                <span className="text-xs text-red-600 dark:text-red-400">
                  {t('dashboard.widgets.daysOverdue', { count: r.daysOverdue })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Quiet icon={Check}>{t('dashboard.widgets.noOverdue')}</Quiet>
      )}
    </WidgetCard>
  );
}

export function ApprovalsCard({ rows }: { rows: Approval[] }) {
  const { t } = useTranslation();
  const approve = useApprove();
  return (
    <WidgetCard
      title={t('dashboard.widgets.approvals')}
      count={rows.length}
      description={t('dashboard.widgets.approvalsHint')}
    >
      {rows.length ? (
        <div className="flex flex-col">
          {rows.map((a) => {
            const link = docLink(a.type, a.id);
            const busy =
              approve.isPending && approve.variables?.id === a.id && approve.variables.type === a.type;
            return (
              <div
                key={`${a.type}-${a.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
              >
                <span className="flex min-w-0 items-start gap-2.5">
                  <FileClock
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate">
                      {t(`dashboard.docTypes.${a.type}`)}{' '}
                      {link ? (
                        <Link to={link} className="font-mono font-medium hover:underline">
                          {a.number}
                        </Link>
                      ) : (
                        <span className="font-mono">{a.number}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.requestedBy ?? '—'} · {formatRelativeTime(a.at)}
                      {a.amount != null && ` · ${formatCurrency(a.amount)}`}
                    </span>
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0"
                  disabled={approve.isPending}
                  onClick={() =>
                    approve.mutate(a, {
                      onSuccess: () => toast.success(t('dashboard.widgets.approved', { number: a.number })),
                      onError: (err) => toast.error(err.message),
                    })
                  }
                >
                  {busy ? <Spinner /> : <CheckCircle2 aria-hidden />} {t('dashboard.widgets.approve')}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <Quiet icon={Check}>{t('dashboard.widgets.noApprovals')}</Quiet>
      )}
    </WidgetCard>
  );
}

/** Recent activity as a timeline: a dot per entry joined by a hairline. */
export function ActivityCard({ rows }: { rows: NonNullable<Widgets['recentActivity']> }) {
  const { t } = useTranslation();
  return (
    <WidgetCard title={t('dashboard.widgets.activity')}>
      {rows.length ? (
        <ol className="relative flex flex-col px-2">
          <span className="absolute top-3 bottom-3 left-[11px] w-px bg-border" aria-hidden />
          {rows.map((r) => {
            const link = docLink(r.type, r.id);
            return (
              <li key={`${r.type}-${r.id}`} className="relative flex gap-3 py-2 text-sm">
                <span className="relative z-10 mt-1.5 flex size-2 shrink-0 rounded-full bg-muted-foreground/60 ring-4 ring-card" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="text-muted-foreground">{t(`dashboard.docTypes.${r.type}`)}</span>{' '}
                    {link ? (
                      <Link to={link} className="font-mono font-medium hover:underline">
                        {r.number}
                      </Link>
                    ) : (
                      <span className="font-mono">{r.number}</span>
                    )}
                    {r.amount != null && <span className="tabular-nums"> · {formatCurrency(r.amount)}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.user ?? '—'} · {formatRelativeTime(r.at)} · {r.status.replaceAll('_', ' ')}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <Quiet icon={CircleDot}>{t('dashboard.widgets.noActivity')}</Quiet>
      )}
    </WidgetCard>
  );
}

/** Compact stock watch for the dashboard (the full alerts card lives on the inventory pages). */
export function StockWatchCard() {
  const { t } = useTranslation();
  const alerts = useStockAlerts({ limit: 5 });
  const c = alerts.data?.counts;
  const tiles: { label: string; value: number; icon: LucideIcon; tone: string; to: string }[] = [
    {
      label: t('inventory.alerts.lowStock'),
      value: c?.lowStock ?? 0,
      icon: TriangleAlert,
      tone: 'text-amber-600 dark:text-amber-400',
      to: '/inventory/stock?status=low',
    },
    {
      label: t('inventory.alerts.outOfStock'),
      value: c?.outOfStock ?? 0,
      icon: PackageX,
      tone: 'text-red-600 dark:text-red-400',
      to: '/inventory/stock?status=out',
    },
    {
      label: t('inventory.alerts.nearExpiry'),
      value: (c?.nearExpiry ?? 0) + (c?.expired ?? 0),
      icon: AlarmClock,
      tone: 'text-amber-600 dark:text-amber-400',
      to: '/inventory/reports?report=expiry',
    },
  ];
  const low = alerts.data?.lowStock ?? [];
  return (
    <WidgetCard title={t('inventory.alerts.title')} to="/inventory/stock">
      {alerts.isPending ? (
        <div className="flex flex-col gap-2 px-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 px-2">
            {tiles.map((tile) => (
              <Link
                key={tile.label}
                to={tile.to}
                className="rounded-lg border p-2.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <tile.icon
                  className={cn('size-3.5', tile.value ? tile.tone : 'text-muted-foreground')}
                  aria-hidden
                />
                <div className="mt-1.5 text-lg leading-none font-semibold tabular-nums">{tile.value}</div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{tile.label}</div>
              </Link>
            ))}
          </div>
          {low.length > 0 && (
            <div className="flex flex-col">
              {low.map((r) => (
                <Link key={r.key} to={`/inventory/stock/${r.productId}`} className={ROW}>
                  <span className="min-w-0 truncate">
                    {r.variantName ? `${r.name} — ${r.variantName}` : r.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {formatQuantity(r.quantity)}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      / {formatQuantity(r.reorderLevel)} {r.unitCode}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

/** The cashier's day: a hero figure and the way into the POS. */
export function MySalesCard({ data }: { data: NonNullable<Widgets['mySales']> }) {
  const { t } = useTranslation();
  return (
    <Card className="flex-row flex-wrap items-center justify-between gap-4 px-5">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">{t('dashboard.widgets.myDay')}</span>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatCurrency(data.total)}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t('dashboard.widgets.mySalesCount', { count: data.count })}
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-1.5 rounded-full',
                data.session ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
            />
            {data.session
              ? t('dashboard.widgets.shiftOpen', {
                  register: data.session.register,
                  since: formatRelativeTime(data.session.openedAt),
                })
              : t('dashboard.widgets.noShift')}
          </span>
        </span>
      </div>
      <Button asChild>
        <Link to="/pos">
          <MonitorSmartphone aria-hidden /> {t('dashboard.widgets.openPos')}
        </Link>
      </Button>
    </Card>
  );
}

/** Placeholder until the Fixed Assets module exists (hidden while `available` is false). */
export function AssetMaintenanceCard({ data }: { data: Widgets['assetMaintenance'] }) {
  const { t } = useTranslation();
  if (!data.available) return null;
  return (
    <WidgetCard title={t('dashboard.widgets.maintenance')}>
      <Quiet icon={Wrench}>{t('dashboard.widgets.noMaintenance')}</Quiet>
    </WidgetCard>
  );
}
