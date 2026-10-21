import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { SalesQuotation } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { moneyColumn } from '@/features/purchase/components/columns';
import { DocumentList } from '@/features/purchase/components/document-list';
import { quotationsApi } from '../api/sales-api';
import { QUOTATION_STATUSES, SALES_ROUTES } from '../lib';

export default function QuotationsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<SalesQuotation, unknown>[]>(
    () => [
      {
        id: 'validUntil',
        enableSorting: false,
        meta: { label: t('sales.validUntil'), cellClassName: 'whitespace-nowrap' },
        header: t('sales.validUntil'),
        cell: ({ row }) => (row.original.validUntil ? formatDate(row.original.validUntil) : '—'),
      },
      moneyColumn<SalesQuotation>('total', t('purchase.total'), (r) => r.total),
    ],
    [t],
  );
  return (
    <DocumentList<SalesQuotation>
      module="sales"
      keyPrefix="sales.quotations"
      route={SALES_ROUTES.quotation}
      url="/sales/quotations"
      useList={quotationsApi.useList}
      columns={columns}
      dateField="quotationDate"
      dateSortKey="quotationDate"
      statuses={QUOTATION_STATUSES}
      tabs={['draft', 'sent', 'accepted', 'converted']}
      actions={
        <Can permission="sales.create">
          <Button asChild>
            <Link to={`${SALES_ROUTES.quotation}/new`}>
              <Plus aria-hidden /> {t('sales.quotations.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('sales.customer'), value: (r) => r.customer?.name },
        { header: t('sales.validUntil'), value: (r) => r.validUntil },
        { header: t('purchase.total'), value: (r) => r.total },
      ]}
    />
  );
}
