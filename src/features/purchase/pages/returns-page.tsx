import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { PurchaseReturn } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { returnsApi } from '../api/purchase-api';
import { moneyColumn } from '../components/columns';
import { DocumentList } from '../components/document-list';
import { DOC_ROUTES } from '../lib';

const STATUSES = ['draft', 'posted', 'cancelled'] as const;

export default function ReturnsPage() {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<PurchaseReturn, unknown>[]>(
    () => [
      {
        id: 'type',
        enableSorting: false,
        meta: { label: t('fields.type') },
        header: t('fields.type'),
        cell: ({ row }) => t(`purchase.returnTypes.${row.original.type}`),
      },
      {
        id: 'reason',
        enableSorting: false,
        meta: { label: t('inventory.reason') },
        header: t('inventory.reason'),
        cell: ({ row }) => row.original.reason ?? '—',
      },
      moneyColumn<PurchaseReturn>('total', t('purchase.total'), (r) => r.total),
    ],
    [t],
  );
  return (
    <DocumentList<PurchaseReturn>
      keyPrefix="purchase.returns"
      route={DOC_ROUTES.return}
      url="/purchase/returns"
      useList={returnsApi.useList}
      columns={columns}
      dateField="returnDate"
      dateSortKey="returnDate"
      statuses={STATUSES}
      filterKeys={['type']}
      extraFilters={[
        {
          key: 'type',
          label: t('fields.type'),
          options: ['return', 'debit_note'].map((v) => ({ value: v, label: t(`purchase.returnTypes.${v}`) })),
        },
      ]}
      actions={
        <Can permission="purchase.create">
          <Button asChild>
            <Link to={`${DOC_ROUTES.return}/new`}>
              <Plus aria-hidden /> {t('purchase.returns.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('purchase.supplier'), value: (r) => r.supplier?.name },
        { header: t('fields.type'), value: (r) => t(`purchase.returnTypes.${r.type}`) },
        { header: t('purchase.total'), value: (r) => r.total },
      ]}
    />
  );
}
