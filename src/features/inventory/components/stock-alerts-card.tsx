import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlarmClock, AlertTriangle, CalendarX2, ClipboardCheck, PackageX, Truck } from 'lucide-react';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExpiringBatch, StockRow } from '@/types';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStockAlerts } from '../api/inventory-api';
import { itemLabel } from '../lib';
import { StatTile } from './stat-tile';

function StockList({ rows, empty }: { rows: StockRow[]; empty: string }) {
  const { t } = useTranslation();
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-3 py-2 text-sm">
          <Link
            to={`/inventory/stock/${r.productId}${r.variantId ? `?variantId=${r.variantId}` : ''}`}
            className="min-w-0 truncate hover:underline"
          >
            {itemLabel(r)}
          </Link>
          <span className="shrink-0 tabular-nums">
            <span className={cn('font-medium', Number(r.quantity) <= 0 && 'text-destructive')}>
              {formatQuantity(r.quantity)}
            </span>
            {Number(r.reorderLevel) > 0 && (
              <span className="text-muted-foreground">
                {' '}
                / {t('inventory.alerts.min', { qty: formatQuantity(r.reorderLevel) })}
              </span>
            )}{' '}
            <span className="text-xs text-muted-foreground">{r.unitCode}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function BatchList({ rows, empty }: { rows: ExpiringBatch[]; empty: string }) {
  const { t } = useTranslation();
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((b) => (
        <li
          key={`${b.batchId}:${b.warehouseId}`}
          className="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <Link to={`/inventory/stock/${b.productId}`} className="block truncate hover:underline">
              {itemLabel(b)}
            </Link>
            <span className="text-xs text-muted-foreground">
              <span className="font-mono">{b.batchNo}</span> · {b.warehouseName} ·{' '}
              {formatQuantity(b.quantity)} {b.unitCode}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 text-right text-xs',
              b.daysLeft < 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400',
            )}
          >
            {formatDate(b.expiryDate)}
            <br />
            {b.daysLeft < 0
              ? t('inventory.reports.expiredAgo', { days: -b.daysLeft })
              : t('inventory.reports.inDays', { days: b.daysLeft })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Dashboard widget: stock alerts and work waiting for the user. */
export function StockAlertsCard() {
  const { t } = useTranslation();
  const alerts = useStockAlerts({ limit: 8 });
  const c = alerts.data?.counts;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={AlertTriangle}
          tone="warning"
          label={t('inventory.alerts.lowStock')}
          value={c?.lowStock ?? 0}
          loading={alerts.isPending}
          to="/inventory/stock?status=low"
        />
        <StatTile
          icon={PackageX}
          tone="danger"
          label={t('inventory.alerts.outOfStock')}
          value={c?.outOfStock ?? 0}
          loading={alerts.isPending}
          to="/inventory/stock?status=out"
        />
        <StatTile
          icon={AlarmClock}
          tone="warning"
          label={t('inventory.alerts.nearExpiry')}
          value={c?.nearExpiry ?? 0}
          loading={alerts.isPending}
          to="/inventory/reports?report=expiry"
        />
        <StatTile
          icon={CalendarX2}
          tone="danger"
          label={t('inventory.alerts.expired')}
          value={c?.expired ?? 0}
          loading={alerts.isPending}
          to="/inventory/reports?report=expiry"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.alerts.title')}</CardTitle>
          <CardDescription>{t('inventory.alerts.description')}</CardDescription>
          <CardAction className="flex gap-3 text-sm">
            {Boolean(c?.pendingApprovals) && (
              <Link
                to="/inventory/adjustments?status=pending_approval"
                className="inline-flex items-center gap-1 text-amber-700 hover:underline dark:text-amber-400"
              >
                <ClipboardCheck className="size-4" aria-hidden />{' '}
                {t('inventory.alerts.pendingApprovals', { count: c!.pendingApprovals })}
              </Link>
            )}
            {Boolean(c?.incomingTransfers) && (
              <Link
                to="/inventory/transfers?direction=incoming&status=in_transit"
                className="inline-flex items-center gap-1 text-sky-700 hover:underline dark:text-sky-400"
              >
                <Truck className="size-4" aria-hidden />{' '}
                {t('inventory.alerts.incomingTransfers', { count: c!.incomingTransfers })}
              </Link>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {alerts.isPending ? (
            <Skeleton className="h-48" />
          ) : (
            <Tabs defaultValue="low">
              <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="low">{t('inventory.alerts.lowStock')}</TabsTrigger>
                <TabsTrigger value="out">{t('inventory.alerts.outOfStock')}</TabsTrigger>
                <TabsTrigger value="expiry">{t('inventory.alerts.expiry')}</TabsTrigger>
              </TabsList>
              <TabsContent value="low">
                <StockList rows={alerts.data?.lowStock ?? []} empty={t('inventory.alerts.noneLow')} />
              </TabsContent>
              <TabsContent value="out">
                <StockList rows={alerts.data?.outOfStock ?? []} empty={t('inventory.alerts.noneOut')} />
              </TabsContent>
              <TabsContent value="expiry">
                <BatchList
                  rows={[...(alerts.data?.expired ?? []), ...(alerts.data?.nearExpiry ?? [])]}
                  empty={t('inventory.alerts.noneExpiry')}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
