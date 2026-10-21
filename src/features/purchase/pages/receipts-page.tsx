import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { GoodsReceipt } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { receiptsApi } from '../api/purchase-api';
import { moneyColumn } from '../components/columns';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES } from '../lib';

const STATUSES = ['draft', 'posted', 'cancelled'] as const;

export default function ReceiptsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<GoodsReceipt, unknown>[]>(
    () => [
      {
        id: 'order',
        enableSorting: false,
        meta: { label: t('purchase.orders.entity') },
        header: t('purchase.orders.entity'),
        cell: ({ row }) =>
          row.original.order ? (
            <Link
              to={`${DOC_ROUTES.order}/${row.original.order.id}`}
              className="font-mono text-xs hover:underline"
            >
              {row.original.order.number}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name,
      },
      {
        id: 'supplierReference',
        enableSorting: false,
        meta: { label: t('purchase.challan') },
        header: t('purchase.challan'),
        cell: ({ row }) => row.original.supplierReference ?? '—',
      },
      moneyColumn<GoodsReceipt>('totalCost', t('purchase.receipts.totalCost'), (r) => r.totalCost),
    ],
    [t],
  );
  return (
    <DocumentList<GoodsReceipt>
      keyPrefix="purchase.receipts"
      route={DOC_ROUTES.receipt}
      url="/purchase/receipts"
      useList={receiptsApi.useList}
      columns={columns}
      dateField="receiptDate"
      dateSortKey="receiptDate"
      statuses={STATUSES}
      actions={
        <Can permission="purchase.create">
          <Button asChild>
            <Link to={`${DOC_ROUTES.receipt}/new`}>
              <Plus aria-hidden /> {t('purchase.receipts.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('purchase.supplier'), value: (r) => r.supplier?.name },
        { header: t('purchase.orders.entity'), value: (r) => r.order?.number },
        { header: t('purchase.receipts.totalCost'), value: (r) => r.totalCost },
      ]}
    />
  );
}
