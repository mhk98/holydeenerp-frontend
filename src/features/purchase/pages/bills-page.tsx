import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SupplierBill } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { billsApi } from '../api/purchase-api';
import { moneyColumn } from '../components/columns';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES } from '../lib';

const STATUSES = ['draft', 'unpaid', 'partially_paid', 'paid', 'cancelled'] as const;

export default function BillsPage() {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const columns = useMemo<ColumnDef<SupplierBill, unknown>[]>(
    () => [
      {
        id: 'supplierInvoiceNo',
        enableSorting: false,
        meta: { label: t('purchase.supplierInvoiceNo') },
        header: t('purchase.supplierInvoiceNo'),
        cell: ({ row }) => row.original.supplierInvoiceNo ?? '—',
      },
      {
        id: 'dueDate',
        meta: { label: t('purchase.dueDate'), cellClassName: 'whitespace-nowrap' },
        header: t('purchase.dueDate'),
        cell: ({ row: { original: b } }) => {
          const overdue = ['unpaid', 'partially_paid'].includes(b.status) && b.dueDate < today;
          return (
            <span className={cn(overdue && 'font-medium text-destructive')}>{formatDate(b.dueDate)}</span>
          );
        },
      },
      moneyColumn<SupplierBill>('total', t('purchase.total'), (r) => r.total),
      moneyColumn<SupplierBill>('balance', t('purchase.balance'), (r) => r.balance, false),
    ],
    [t, today],
  );
  return (
    <DocumentList<SupplierBill>
      keyPrefix="purchase.bills"
      route={DOC_ROUTES.bill}
      url="/purchase/bills"
      useList={billsApi.useList}
      columns={columns}
      dateField="billDate"
      dateSortKey="billDate"
      statuses={STATUSES}
      tabs={['draft', 'unpaid', 'partially_paid', 'paid']}
      actions={
        <Can permission="purchase.create">
          <Button asChild>
            <Link to={`${DOC_ROUTES.bill}/new`}>
              <Plus aria-hidden /> {t('purchase.bills.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('purchase.supplier'), value: (r) => r.supplier?.name },
        { header: t('purchase.supplierInvoiceNo'), value: (r) => r.supplierInvoiceNo },
        { header: t('purchase.dueDate'), value: (r) => r.dueDate },
        { header: t('purchase.total'), value: (r) => r.total },
        { header: t('purchase.balance'), value: (r) => r.balance },
      ]}
    />
  );
}
