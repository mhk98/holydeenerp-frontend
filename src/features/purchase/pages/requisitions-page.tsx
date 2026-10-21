import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { PurchaseRequisition } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { requisitionsApi } from '../api/purchase-api';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES } from '../lib';

const STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'cancelled'] as const;

export default function RequisitionsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<PurchaseRequisition, unknown>[]>(
    () => [
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name ?? '—',
      },
      {
        id: 'requiredBy',
        meta: { label: t('purchase.requiredBy') },
        header: t('purchase.requiredBy'),
        cell: ({ row }) => formatDate(row.original.requiredBy),
      },
      {
        id: 'items',
        enableSorting: false,
        meta: {
          label: t('inventory.items'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.items'),
        cell: ({ row }) => row.original.itemsCount ?? '—',
      },
    ],
    [t],
  );
  return (
    <DocumentList<PurchaseRequisition>
      keyPrefix="purchase.requisitions"
      route={DOC_ROUTES.requisition}
      url="/purchase/requisitions"
      useList={requisitionsApi.useList}
      columns={columns}
      dateField="requisitionDate"
      dateSortKey="requisitionDate"
      statuses={STATUSES}
      tabs={['pending_approval', 'approved', 'ordered']}
      showSupplier={false}
      actions={
        <Can permission="purchase.create">
          <Button asChild>
            <Link to={`${DOC_ROUTES.requisition}/new`}>
              <Plus aria-hidden /> {t('purchase.requisitions.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[{ header: t('inventory.warehouse'), value: (r) => r.warehouse?.name }]}
    />
  );
}
