import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { PurchaseOrder } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { ordersApi } from '../api/purchase-api';
import { moneyColumn } from '../components/columns';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES, PO_STATUSES } from '../lib';

export default function OrdersPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<PurchaseOrder, unknown>[]>(
    () => [
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name,
      },
      {
        id: 'expectedDate',
        meta: { label: t('purchase.expectedDate') },
        header: t('purchase.expectedDate'),
        cell: ({ row }) => formatDate(row.original.expectedDate),
      },
      {
        id: 'received',
        enableSorting: false,
        meta: { label: t('purchase.orders.received') },
        header: t('purchase.orders.received'),
        cell: ({ row }) => {
          const pct = Math.min(100, Number(row.original.receivedPercent ?? 0));
          return (
            <div className="flex w-24 items-center gap-2" title={`${pct}%`}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{Math.round(pct)}%</span>
            </div>
          );
        },
      },
      moneyColumn<PurchaseOrder>('total', t('purchase.total'), (r) => r.total),
    ],
    [t],
  );
  return (
    <DocumentList<PurchaseOrder>
      keyPrefix="purchase.orders"
      route={DOC_ROUTES.order}
      url="/purchase/orders"
      useList={ordersApi.useList}
      columns={columns}
      dateField="orderDate"
      dateSortKey="orderDate"
      statuses={PO_STATUSES}
      tabs={['draft', 'pending_approval', 'approved', 'partially_received', 'received', 'billed', 'closed']}
      actions={
        <Can permission="purchase.create">
          <Button asChild>
            <Link to={`${DOC_ROUTES.order}/new`}>
              <Plus aria-hidden /> {t('purchase.orders.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('purchase.supplier'), value: (r) => r.supplier?.name },
        { header: t('inventory.warehouse'), value: (r) => r.warehouse?.name },
        { header: t('purchase.total'), value: (r) => r.total },
      ]}
    />
  );
}
