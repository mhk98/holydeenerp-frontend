import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Coins,
  Layers,
  Package,
  Pencil,
  Scale,
} from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StockCardRow } from '@/types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProductStock, useStockCard } from '../api/inventory-api';
import { MovementTypeLabel, SignedQuantity, StockStatusBadge } from '../components/inventory-badges';
import { StatTile } from '../components/stat-tile';
import { referenceLink } from '../lib';
import { WarehouseSelect } from '../components/warehouse-select';

const ALL = '__all__';

function TimelineEntry({ row, unit }: { row: StockCardRow; unit: string }) {
  const { t } = useTranslation();
  const isIn = Number(row.quantity) > 0;
  const link = referenceLink(row.referenceType, row.referenceId);
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span
        className={cn(
          'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-background',
          isIn ? 'border-emerald-500 text-emerald-600' : 'border-red-500 text-red-600',
        )}
        aria-hidden
      >
        {isIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              <MovementTypeLabel type={row.movementType} quantity={row.quantity} />
            </span>
            {link ? (
              <Link to={link} className="font-mono text-xs text-primary hover:underline">
                {row.referenceNo}
              </Link>
            ) : (
              <span className="font-mono text-xs">{row.referenceNo}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{formatDate(row.movementDate)}</span>
            <span>{row.warehouseName}</span>
            {row.variantName && <span>{row.variantName}</span>}
            {row.batchNo && (
              <span>
                {t('inventory.batch')} <span className="font-mono">{row.batchNo}</span>
                {row.expiryDate && ` · ${t('inventory.expires')} ${formatDate(row.expiryDate)}`}
              </span>
            )}
            {row.userName && <span>{row.userName}</span>}
            <span title={formatDateTime(row.createdAt)}>{formatDateTime(row.createdAt)}</span>
          </div>
          {row.notes && <p className="text-xs text-muted-foreground">{row.notes}</p>}
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-4 text-right text-sm sm:min-w-80">
          <div>
            <div className="text-xs text-muted-foreground">{t('inventory.quantity')}</div>
            <SignedQuantity value={row.quantity} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('inventory.unitCost')}</div>
            <div className="tabular-nums">{formatCurrency(row.unitCost)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('inventory.balance')}</div>
            <div className="font-medium tabular-nums">
              {formatQuantity(row.runningQuantity)}{' '}
              <span className="text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(row.runningValue)}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Product stock card: where the product is, its batches and a timeline of every movement. */
export default function StockCardPage() {
  const { productId } = useParams();
  const { t } = useTranslation();
  const { can } = usePermission();
  const [params, setParams] = useSearchParams();
  const warehouseId = params.get('warehouseId');
  const variantId = params.get('variantId');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Number(params.get('page')) || 1;
  // Expiry badges compare with the time the page was opened.
  const [now] = useState(() => Date.now());

  const filter = { ...(warehouseId && { warehouseId }), ...(variantId && { variantId }) };
  const stock = useProductStock(productId, warehouseId ? { warehouseId } : {});
  const card = useStockCard(productId, {
    ...filter,
    ...(from && { from }),
    ...(to && { to }),
    page,
    limit: 25,
  });

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  if (stock.isPending) return <PageSkeleton />;
  if (!stock.data) return <EmptyState icon={Package} title={t('inventory.card.notFound')} />;

  const { product, totals, balances, batches, serials } = stock.data;
  const unit = product.baseUnit?.code ?? '';
  const visibleBalances = variantId ? balances.filter((b) => b.variantId === variantId) : balances;
  const visibleBatches = variantId ? batches.filter((b) => b.variantId === variantId) : batches;
  const inStockSerials = serials.filter((s) => s.status === 'in_stock').reduce((n, s) => n + s.count, 0);
  const meta = card.data?.meta;

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{product.sku}</code>
            {product.barcode && <span className="font-mono text-xs">{product.barcode}</span>}
            {(product.trackBatch || product.trackExpiry) && (
              <Badge variant="secondary">
                {t(product.trackExpiry ? 'inventory.tracking.expiry' : 'inventory.tracking.batch')}
              </Badge>
            )}
            {product.trackSerial && <Badge variant="secondary">{t('inventory.tracking.serial')}</Badge>}
            <StockStatusBadge status={totals.status} />
          </span>
        }
        breadcrumbs={[
          { label: t('nav.inventory') },
          { label: t('inventory.stock.title'), to: '/inventory/stock' },
          { label: t('inventory.card.title') },
        ]}
        actions={
          can('products.view') && (
            <Button variant="outline" asChild>
              <Link to={`/inventory/products/${product.id}`}>
                <Pencil aria-hidden /> {t('inventory.card.openProduct')}
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Package}
          label={t('inventory.onHand')}
          value={`${formatQuantity(totals.quantity)} ${unit}`}
        />
        <StatTile icon={Coins} label={t('inventory.stockValue')} value={formatCurrency(totals.totalValue)} />
        <StatTile icon={Scale} label={t('inventory.avgCost')} value={formatCurrency(totals.avgCost)} />
        <StatTile
          icon={Layers}
          label={product.trackSerial ? t('inventory.serialsInStock') : t('inventory.reorderLevel')}
          value={
            product.trackSerial
              ? inStockSerials
              : Number(product.reorderLevel) > 0
                ? `${formatQuantity(product.reorderLevel)} ${unit}`
                : '—'
          }
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('inventory.card.byWarehouse')}</CardTitle>
          </CardHeader>
          <CardContent>
            {visibleBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('inventory.card.noStock')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('inventory.warehouse')}</TableHead>
                    {product.hasVariants && <TableHead>{t('inventory.variant')}</TableHead>}
                    <TableHead className="text-right">{t('inventory.onHand')}</TableHead>
                    <TableHead className="text-right">{t('inventory.stockValue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBalances.map((b) => (
                    <TableRow key={`${b.warehouseId}:${b.variantId}`}>
                      <TableCell>{b.warehouseName}</TableCell>
                      {product.hasVariants && <TableCell>{b.variantName}</TableCell>}
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          Number(b.quantity) < 0 && 'text-destructive',
                        )}
                      >
                        {formatQuantity(b.quantity)} {unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(b.totalValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {(product.trackBatch || product.trackExpiry) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.card.batches')}</CardTitle>
              <CardDescription>{t('inventory.card.batchesHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              {visibleBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('inventory.noBatches')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inventory.batch')}</TableHead>
                      <TableHead>{t('inventory.expiryDate')}</TableHead>
                      <TableHead>{t('inventory.warehouse')}</TableHead>
                      <TableHead className="text-right">{t('inventory.onHand')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBatches.map((b) => {
                      const days = b.expiryDate
                        ? Math.round((new Date(`${b.expiryDate}T00:00:00Z`).getTime() - now) / 86_400_000)
                        : null;
                      return (
                        <TableRow key={`${b.batchId}:${b.warehouseId}`}>
                          <TableCell className="font-mono text-xs">{b.batchNo}</TableCell>
                          <TableCell>
                            {b.expiryDate ? (
                              <StatusBadge tone={days! < 0 ? 'danger' : days! <= 30 ? 'warning' : 'success'}>
                                {formatDate(b.expiryDate)}
                              </StatusBadge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>{b.warehouseName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatQuantity(b.quantity)} {unit}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {product.trackSerial && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.card.serials')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {serials.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('inventory.card.noSerials')}</p>
              )}
              {serials.map((s) => (
                <Badge key={`${s.warehouseId}:${s.status}`} variant="outline" className="gap-1.5 font-normal">
                  {t(`inventory.serialStatus.${s.status}`)}
                  <span className="font-medium tabular-nums">{s.count}</span>
                  {s.warehouseId && (
                    <span className="text-muted-foreground">
                      · {balances.find((b) => b.warehouseId === s.warehouseId)?.warehouseName}
                    </span>
                  )}
                </Badge>
              ))}
              <Button variant="link" size="sm" asChild className="h-auto p-0">
                <Link to={`/inventory/serials?productId=${product.id}`}>
                  {t('inventory.card.allSerials')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-base">{t('inventory.card.timeline')}</CardTitle>
            <CardDescription>{t('inventory.card.timelineHint')}</CardDescription>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t('inventory.warehouse')}</Label>
              <WarehouseSelect allowAll value={warehouseId} onChange={(id) => set({ warehouseId: id })} />
            </div>
            {product.hasVariants && (
              <div className="flex flex-col gap-1.5">
                <Label>{t('inventory.variant')}</Label>
                <Select
                  value={variantId ?? ALL}
                  onValueChange={(v) => set({ variantId: v === ALL ? null : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('inventory.allVariants')}</SelectItem>
                    {product.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-from">{t('inventory.from')}</Label>
              <Input
                id="card-from"
                type="date"
                value={from}
                onChange={(e) => set({ from: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-to">{t('inventory.to')}</Label>
              <Input id="card-to" type="date" value={to} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {card.data && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-4">
              {[
                [
                  t('inventory.card.opening'),
                  `${formatQuantity(card.data.opening.quantity)} ${unit}`,
                  formatCurrency(card.data.opening.value),
                ],
                [t('inventory.card.in'), `+${formatQuantity(card.data.inQuantity)} ${unit}`, null],
                [t('inventory.card.out'), `−${formatQuantity(card.data.outQuantity)} ${unit}`, null],
                [
                  t('inventory.card.closing'),
                  `${formatQuantity(card.data.closing.quantity)} ${unit}`,
                  formatCurrency(card.data.closing.value),
                ],
              ].map(([label, qty, value]) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-medium tabular-nums">{qty}</div>
                  {value && <div className="text-xs text-muted-foreground tabular-nums">{value}</div>}
                </div>
              ))}
            </div>
          )}

          {card.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : !card.data?.rows.length ? (
            <EmptyState title={t('inventory.card.noMovements')} className="py-10" />
          ) : (
            <ol
              className={cn(
                'relative before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border',
                card.isFetching && 'opacity-60',
              )}
            >
              {card.data.rows.map((row) => (
                <TimelineEntry key={row.id} row={row} unit={unit} />
              ))}
            </ol>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {t('inventory.card.pageOf', { page: meta.page, pages: meta.totalPages, total: meta.total })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => set({ page: String(page - 1) })}
                >
                  <ChevronLeft aria-hidden /> {t('inventory.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => set({ page: String(page + 1) })}
                >
                  {t('inventory.next')} <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
