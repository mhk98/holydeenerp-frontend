import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ClipboardList, Factory, PackageSearch } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { useMrp, useMrpRequisition, useSubAssemblyOrders } from '../api/manufacturing-api';
import { MFG_ROUTES } from '../lib';
import type { MrpRow } from '../types';

const keyOf = (r: MrpRow) => `${r.productId}:${r.variantId ?? ''}`;
const num = 'text-right tabular-nums';

/**
 * Material requirements of the open orders against stock, purchase orders, requisitions and
 * production. Shortages of bought items become a draft purchase requisition; of made items,
 * sub-assembly orders.
 */
export default function MrpPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const mrp = useMrp({ warehouseId: warehouseId ?? undefined, to: to || undefined });
  const requisition = useMrpRequisition();
  const subOrders = useSubAssemblyOrders();
  const [picked, setPicked] = useState<Record<string, string>>({});

  const rows = useMemo(() => mrp.data?.rows ?? [], [mrp.data]);
  const short = rows.filter((r) => Number(r.shortage) > 0);
  const chosen = (action: MrpRow['action']) =>
    rows
      .filter((r) => r.action === action && picked[keyOf(r)] !== undefined && Number(picked[keyOf(r)]) > 0)
      .map((r) => ({ productId: r.productId, variantId: r.variantId, quantity: picked[keyOf(r)] }));
  const toBuy = chosen('buy');
  const toMake = chosen('make');

  const toggle = (r: MrpRow, on: boolean) =>
    setPicked((p) => {
      const next = { ...p };
      if (on) next[keyOf(r)] = String(Number(r.shortage));
      else delete next[keyOf(r)];
      return next;
    });
  const allShort = short.length > 0 && short.every((r) => picked[keyOf(r)] !== undefined);

  const raise = () =>
    requisition.mutate(
      { warehouseId, requiredBy: to || null, lines: toBuy },
      {
        onSuccess: (doc) => {
          toast.success(t('manufacturing.mrp.requisitionCreated', { number: doc.number }), {
            action: { label: t('common.view'), onClick: () => navigate(`/purchases/requisitions/${doc.id}`) },
          });
          setPicked({});
        },
        onError: (err) => toast.error(err.message),
      },
    );
  const make = () =>
    subOrders.mutate(
      { rawWarehouseId: warehouseId ?? undefined, lines: toMake },
      {
        onSuccess: (orders) => {
          toast.success(t('manufacturing.mrp.ordersCreated', { count: orders.length }));
          setPicked({});
        },
        onError: (err) => toast.error(err.message),
      },
    );

  const summary = mrp.data?.summary;
  return (
    <>
      <PageHeader
        title={t('manufacturing.mrp.title')}
        description={t('manufacturing.mrp.description')}
        breadcrumbs={[{ label: t('nav.manufacturing') }, { label: t('manufacturing.mrp.title') }]}
        actions={
          <>
            {can('manufacturing.create') && (
              <Button variant="outline" disabled={!toMake.length || subOrders.isPending} onClick={make}>
                <Factory aria-hidden /> {t('manufacturing.mrp.makeSelected', { count: toMake.length })}
              </Button>
            )}
            {can('manufacturing.create') && (
              <Button disabled={!toBuy.length || requisition.isPending} onClick={raise}>
                <ClipboardList aria-hidden />{' '}
                {t('manufacturing.mrp.requestSelected', { count: toBuy.length })}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t('manufacturing.mrp.warehouse')}</Label>
          <WarehouseSelect value={warehouseId} onChange={setWarehouseId} allowAll className="w-56" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mrp-to">{t('manufacturing.mrp.horizon')}</Label>
          <Input
            id="mrp-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </div>
        {summary && (
          <p className="text-sm text-muted-foreground">
            {t('manufacturing.mrp.summary', {
              orders: summary.orders,
              items: summary.items,
              shortages: summary.shortages,
            })}
            {Number(summary.estimatedCost) > 0 &&
              ` · ${t('manufacturing.mrp.estimated', { amount: formatCurrency(summary.estimatedCost ?? 0) })}`}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {mrp.isPending ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : !rows.length ? (
            <EmptyState
              icon={PackageSearch}
              title={t('manufacturing.mrp.empty')}
              description={t('manufacturing.mrp.emptyHint')}
              action={
                <Button variant="outline" asChild>
                  <Link to={MFG_ROUTES.orders}>{t('manufacturing.orders.title')}</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allShort}
                      onCheckedChange={(on) => short.forEach((r) => toggle(r, Boolean(on)))}
                      aria-label={t('manufacturing.mrp.selectShortages')}
                    />
                  </TableHead>
                  <TableHead>{t('manufacturing.product')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.mrp.demand')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.mrp.onHand')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.mrp.onOrder')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.mrp.requested')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.mrp.inProduction')}</TableHead>
                  <TableHead className="text-right">{t('manufacturing.mrp.shortage')}</TableHead>
                  <TableHead className="w-32 text-right">{t('manufacturing.mrp.toPlan')}</TableHead>
                  <TableHead>{t('manufacturing.mrp.needBy')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const k = keyOf(r);
                  const isShort = Number(r.shortage) > 0;
                  const on = picked[k] !== undefined;
                  return (
                    <TableRow key={k} data-state={on ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => toggle(r, Boolean(v))}
                          aria-label={r.name}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {r.name}
                          {r.variantName && <span className="text-muted-foreground"> — {r.variantName}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <code className="font-mono">{r.sku}</code>
                          <StatusBadge tone={r.action === 'make' ? 'info' : 'neutral'}>
                            {t(`manufacturing.mrp.actions.${r.action}`)}
                          </StatusBadge>
                          <span className="truncate" title={r.orders}>
                            {r.orders}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={num}>{formatQuantity(r.demand)}</TableCell>
                      <TableCell className={num}>{formatQuantity(r.onHand)}</TableCell>
                      <TableCell className={num}>{formatQuantity(r.onOrder)}</TableCell>
                      <TableCell className={num}>{formatQuantity(r.requested)}</TableCell>
                      <TableCell className={num}>{formatQuantity(r.inProduction)}</TableCell>
                      <TableCell
                        className={cn(num, isShort ? 'font-semibold text-destructive' : 'text-emerald-600')}
                      >
                        {isShort ? formatQuantity(r.shortage) : t('manufacturing.mrp.covered')}
                        {r.unit && isShort && <span className="ml-1 text-xs font-normal">{r.unit}</span>}
                      </TableCell>
                      <TableCell>
                        {on && (
                          <Input
                            value={picked[k]}
                            onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.value }))}
                            inputMode="decimal"
                            className="h-8 text-right"
                            aria-label={t('manufacturing.mrp.toPlan')}
                          />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.needBy ? formatDate(r.needBy) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
