import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { SupplierPayment } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { usePayments } from '../api/purchase-api';
import { moneyColumn } from '../components/columns';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES } from '../lib';

const STATUSES = ['posted', 'void'] as const;

export default function PaymentsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<SupplierPayment, unknown>[]>(
    () => [
      {
        id: 'method',
        enableSorting: false,
        meta: { label: t('purchase.paymentMethod') },
        header: t('purchase.paymentMethod'),
        cell: ({ row }) => row.original.paymentMethod?.name,
      },
      {
        id: 'reference',
        enableSorting: false,
        meta: { label: t('purchase.reference') },
        header: t('purchase.reference'),
        cell: ({ row }) => row.original.reference ?? '—',
      },
      moneyColumn<SupplierPayment>('amount', t('purchase.amount'), (r) => r.amount),
      moneyColumn<SupplierPayment>(
        'unallocated',
        t('purchase.payments.unallocated'),
        (r) => r.unallocated,
        false,
      ),
    ],
    [t],
  );
  return (
    <DocumentList<SupplierPayment & { status: string }>
      keyPrefix="purchase.payments"
      route={DOC_ROUTES.payment}
      url="/purchase/payments"
      useList={usePayments}
      columns={columns}
      dateField="paymentDate"
      dateSortKey="paymentDate"
      statuses={STATUSES}
      actions={
        <Can permission={['purchase.create', 'accounting.create']}>
          <Button asChild>
            <Link to={`${DOC_ROUTES.payment}/new`}>
              <Plus aria-hidden /> {t('purchase.payments.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('purchase.supplier'), value: (r) => r.supplier?.name },
        { header: t('purchase.paymentMethod'), value: (r) => r.paymentMethod?.name },
        { header: t('purchase.reference'), value: (r) => r.reference },
        { header: t('purchase.amount'), value: (r) => r.amount },
      ]}
    />
  );
}
