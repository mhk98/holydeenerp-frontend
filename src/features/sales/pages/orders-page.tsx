import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { SalesOrder } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { moneyColumn } from '@/features/purchase/components/columns';
import { DocumentList } from '@/features/purchase/components/document-list';
import { salesOrdersApi } from '../api/sales-api';
import { ORDER_STATUSES, SALES_ROUTES } from '../lib';

export default function SalesOrdersPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<SalesOrder, unknown>[]>(
    () => [
      {
        id: 'deliveryDate',
        enableSorting: false,
        meta: { label: t('sales.deliveryDate'), cellClassName: 'whitespace-nowrap' },
        header: t('sales.deliveryDate'),
        cell: ({ row }) => (row.original.deliveryDate ? formatDate(row.original.deliveryDate) : '—'),
      },
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name ?? '—',
      },
      moneyColumn<SalesOrder>('total', t('purchase.total'), (r) => r.total),
    ],
    [t],
  );
  return (
    <DocumentList<SalesOrder>
      module="sales"
      keyPrefix="sales.orders"
      route={SALES_ROUTES.order}
      url="/sales/orders"
      useList={salesOrdersApi.useList}
      columns={columns}
      dateField="orderDate"
      dateSortKey="orderDate"
      statuses={ORDER_STATUSES}
      tabs={['draft', 'confirmed', 'partially_delivered', 'delivered', 'invoiced']}
      actions={
        <Can permission="sales.create">
          <Button asChild>
            <Link to={`${SALES_ROUTES.order}/new`}>
              <Plus aria-hidden /> {t('sales.orders.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('sales.customer'), value: (r) => r.customer?.name },
        { header: t('inventory.warehouse'), value: (r) => r.warehouse?.name },
        { header: t('sales.deliveryDate'), value: (r) => r.deliveryDate },
        { header: t('purchase.total'), value: (r) => r.total },
      ]}
    />
  );
}
