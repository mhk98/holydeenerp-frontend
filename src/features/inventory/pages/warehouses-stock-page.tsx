import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Coins, Package, PackageX, Truck, Warehouse } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockSummary } from '../api/inventory-api';
import { StatTile } from '../components/stat-tile';

/** Stock by warehouse: value, items in stock, low/out counts and incoming transfers. */
export default function WarehousesStockPage() {
  const { t } = useTranslation();
  const summary = useStockSummary();
  const totals = summary.data?.totals;

  return (
    <>
      <PageHeader
        title={t('inventory.warehouses.title')}
        description={t('inventory.warehouses.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.warehouses.title') }]}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Coins}
          label={t('inventory.stockValue')}
          value={formatCurrency(totals?.totalValue)}
          loading={summary.isPending}
        />
        <StatTile
          icon={AlertTriangle}
          tone="warning"
          label={t('inventory.stockStatus.low')}
          value={totals?.lowCount ?? 0}
          loading={summary.isPending}
          to="/inventory/stock?status=low"
        />
        <StatTile
          icon={PackageX}
          tone="danger"
          label={t('inventory.stockStatus.out')}
          value={totals?.outCount ?? 0}
          loading={summary.isPending}
          to="/inventory/stock?status=out"
        />
        <StatTile
          icon={Truck}
          tone="info"
          label={t('inventory.incoming')}
          value={formatCurrency(totals?.incomingValue)}
          loading={summary.isPending}
          to="/inventory/transfers?direction=incoming&status=in_transit"
        />
      </div>

      {summary.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : !summary.data?.warehouses.length ? (
        <EmptyState icon={Warehouse} title={t('inventory.warehouses.empty')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summary.data.warehouses.map((w) => (
            <Card key={w.id} className={w.isActive ? undefined : 'opacity-60'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Warehouse className="size-4 text-muted-foreground" aria-hidden />
                  {w.name}
                  {!w.isActive && <Badge variant="outline">{t('common.inactive')}</Badge>}
                </CardTitle>
                <CardDescription>
                  {w.branchName} · <span className="font-mono">{w.code}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t('inventory.stockValue')}</div>
                  <div className="text-lg font-semibold tabular-nums">{formatCurrency(w.totalValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('inventory.reports.itemsInStock')}</div>
                  <div className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                    <Package className="size-4 text-muted-foreground" aria-hidden />
                    {formatNumber(w.itemsInStock)}
                  </div>
                </div>
                <Link
                  to={`/inventory/stock?warehouseId=${w.id}&status=low`}
                  className="rounded-md hover:underline"
                >
                  <div className="text-xs text-muted-foreground">{t('inventory.stockStatus.low')}</div>
                  <div
                    className={w.lowCount ? 'font-medium text-amber-600 dark:text-amber-400' : 'font-medium'}
                  >
                    {w.lowCount}
                  </div>
                </Link>
                <Link
                  to={`/inventory/stock?warehouseId=${w.id}&status=out`}
                  className="rounded-md hover:underline"
                >
                  <div className="text-xs text-muted-foreground">{t('inventory.stockStatus.out')}</div>
                  <div className={w.outCount ? 'font-medium text-red-600 dark:text-red-400' : 'font-medium'}>
                    {w.outCount}
                  </div>
                </Link>
                {Number(w.incomingValue) > 0 && (
                  <div className="col-span-2 flex items-center gap-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    <Truck className="size-3.5" aria-hidden />{' '}
                    {t('inventory.warehouses.incoming', { value: formatCurrency(w.incomingValue) })}
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t">
                <Link
                  to={`/inventory/stock?warehouseId=${w.id}`}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t('inventory.warehouses.viewStock')} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
