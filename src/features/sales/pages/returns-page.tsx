import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { SalesReturn } from '@/types';
import { Can } from '@/components/common/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { moneyColumn } from '@/features/purchase/components/columns';
import { DocumentList } from '@/features/purchase/components/document-list';
import { salesReturnsApi } from '../api/sales-api';
import { RETURN_STATUSES, SALES_ROUTES } from '../lib';

export default function SalesReturnsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<SalesReturn, unknown>[]>(
    () => [
      {
        id: 'type',
        enableSorting: false,
        meta: { label: t('sales.returns.type') },
        header: t('sales.returns.type'),
        cell: ({ row }) => <Badge variant="outline">{t(`sales.returns.types.${row.original.type}`)}</Badge>,
      },
      {
        id: 'invoice',
        enableSorting: false,
        meta: { label: t('sales.invoices.entity') },
        header: t('sales.invoices.entity'),
        cell: ({ row }) => row.original.invoice?.number ?? '—',
      },
      moneyColumn<SalesReturn>('total', t('purchase.total'), (r) => r.total),
    ],
    [t],
  );
  return (
    <DocumentList<SalesReturn>
      module="sales"
      keyPrefix="sales.returns"
      route={SALES_ROUTES.return}
      url="/sales/returns"
      useList={salesReturnsApi.useList}
      columns={columns}
      dateField="returnDate"
      dateSortKey="returnDate"
      statuses={RETURN_STATUSES}
      filterKeys={['type']}
      extraFilters={[
        {
          key: 'type',
          label: t('sales.returns.type'),
          options: ['return', 'credit_note'].map((v) => ({ value: v, label: t(`sales.returns.types.${v}`) })),
        },
      ]}
      actions={
        <Can permission="sales.create">
          <Button asChild>
            <Link to={`${SALES_ROUTES.return}/new`}>
              <Plus aria-hidden /> {t('sales.returns.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('sales.customer'), value: (r) => r.customer?.name },
        { header: t('sales.returns.type'), value: (r) => t(`sales.returns.types.${r.type}`) },
        { header: t('sales.invoices.entity'), value: (r) => r.invoice?.number },
        { header: t('purchase.total'), value: (r) => r.total },
      ]}
    />
  );
}
