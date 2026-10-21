import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { DeliveryChallan } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { DocumentList } from '@/features/purchase/components/document-list';
import { challansApi } from '../api/sales-api';
import { CHALLAN_STATUSES, SALES_ROUTES } from '../lib';

export default function ChallansPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<DeliveryChallan, unknown>[]>(
    () => [
      {
        id: 'order',
        enableSorting: false,
        meta: { label: t('sales.orders.entity') },
        header: t('sales.orders.entity'),
        cell: ({ row }) =>
          row.original.order ? (
            <Link
              to={`${SALES_ROUTES.order}/${row.original.order.id}`}
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
        cell: ({ row }) => row.original.warehouse?.name ?? '—',
      },
      {
        id: 'vehicleNo',
        enableSorting: false,
        meta: { label: t('sales.challans.vehicleNo') },
        header: t('sales.challans.vehicleNo'),
        cell: ({ row }) => row.original.vehicleNo ?? '—',
      },
    ],
    [t],
  );
  return (
    <DocumentList<DeliveryChallan>
      module="sales"
      keyPrefix="sales.challans"
      route={SALES_ROUTES.challan}
      url="/sales/challans"
      useList={challansApi.useList}
      columns={columns}
      dateField="challanDate"
      dateSortKey="challanDate"
      statuses={CHALLAN_STATUSES}
      tabs={['draft', 'posted']}
      actions={
        <Can permission="sales.create">
          <Button asChild>
            <Link to={`${SALES_ROUTES.challan}/new`}>
              <Plus aria-hidden /> {t('sales.challans.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('sales.customer'), value: (r) => r.customer?.name },
        { header: t('sales.orders.entity'), value: (r) => r.order?.number },
        { header: t('inventory.warehouse'), value: (r) => r.warehouse?.name },
        { header: t('sales.challans.vehicleNo'), value: (r) => r.vehicleNo },
      ]}
    />
  );
}
