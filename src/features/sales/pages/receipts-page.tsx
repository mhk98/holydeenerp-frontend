import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CustomerReceipt } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { moneyColumn } from '@/features/purchase/components/columns';
import { DocumentList } from '@/features/purchase/components/document-list';
import { useReceipts } from '../api/sales-api';
import { SALES_ROUTES } from '../lib';

export default function CustomerReceiptsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<CustomerReceipt, unknown>[]>(
    () => [
      {
        id: 'method',
        enableSorting: false,
        meta: { label: t('purchase.paymentMethod') },
        header: t('purchase.paymentMethod'),
        cell: ({ row }) => row.original.paymentMethod?.name ?? '—',
      },
      {
        id: 'reference',
        enableSorting: false,
        meta: { label: t('purchase.reference') },
        header: t('purchase.reference'),
        cell: ({ row }) => row.original.reference ?? '—',
      },
      moneyColumn<CustomerReceipt>('amount', t('purchase.amount'), (r) => r.amount),
      moneyColumn<CustomerReceipt>('unallocated', t('sales.receipts.advance'), (r) => r.unallocated, false),
    ],
    [t],
  );
  return (
    <DocumentList<CustomerReceipt>
      module="sales"
      keyPrefix="sales.receipts"
      route={SALES_ROUTES.receipt}
      url="/sales/receipts"
      useList={useReceipts}
      columns={columns}
      dateField="receiptDate"
      dateSortKey="receiptDate"
      statuses={['posted', 'void']}
      actions={
        <Can permission={['sales.create', 'accounting.create']}>
          <Button asChild>
            <Link to={`${SALES_ROUTES.receipt}/new`}>
              <Plus aria-hidden /> {t('sales.receipts.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('sales.customer'), value: (r) => r.customer?.name },
        { header: t('purchase.paymentMethod'), value: (r) => r.paymentMethod?.name },
        { header: t('purchase.reference'), value: (r) => r.reference },
        { header: t('purchase.amount'), value: (r) => r.amount },
      ]}
    />
  );
}
