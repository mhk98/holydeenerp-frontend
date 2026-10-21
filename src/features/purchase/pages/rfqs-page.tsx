import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { PurchaseRfq } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { rfqsApi } from '../api/purchase-api';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES } from '../lib';

const STATUSES = ['draft', 'sent', 'awarded', 'cancelled'] as const;

export default function RfqsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<PurchaseRfq, unknown>[]>(
    () => [
      {
        id: 'quoteDeadline',
        meta: { label: t('purchase.quoteDeadline') },
        header: t('purchase.quoteDeadline'),
        cell: ({ row }) => formatDate(row.original.quoteDeadline),
      },
      {
        id: 'quotes',
        enableSorting: false,
        meta: {
          label: t('purchase.rfqs.quotes'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('purchase.rfqs.quotes'),
        cell: ({ row }) => `${row.original.quotedCount ?? 0} / ${row.original.suppliersCount ?? 0}`,
      },
      {
        id: 'requisition',
        enableSorting: false,
        meta: { label: t('purchase.requisitions.entity') },
        header: t('purchase.requisitions.entity'),
        cell: ({ row }) =>
          row.original.requisition ? (
            <Link
              to={`${DOC_ROUTES.requisition}/${row.original.requisition.id}`}
              className="font-mono text-xs hover:underline"
            >
              {row.original.requisition.number}
            </Link>
          ) : (
            '—'
          ),
      },
    ],
    [t],
  );
  return (
    <DocumentList<PurchaseRfq>
      keyPrefix="purchase.rfqs"
      route={DOC_ROUTES.rfq}
      url="/purchase/rfqs"
      useList={rfqsApi.useList}
      columns={columns}
      dateField="rfqDate"
      dateSortKey="rfqDate"
      statuses={STATUSES}
      showSupplier={false}
      actions={
        <Can permission="purchase.create">
          <Button asChild>
            <Link to={`${DOC_ROUTES.rfq}/new`}>
              <Plus aria-hidden /> {t('purchase.rfqs.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[]}
    />
  );
}
