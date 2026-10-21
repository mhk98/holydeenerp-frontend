import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import type { SalesInvoice } from '@/types';
import { Can } from '@/components/common/can';
import { Button } from '@/components/ui/button';
import { moneyColumn } from '@/features/purchase/components/columns';
import { DocumentList } from '@/features/purchase/components/document-list';
import { invoicesApi } from '../api/sales-api';
import { INVOICE_STATUSES, SALES_ROUTES, todayIn } from '../lib';

export default function InvoicesPage() {
  const { t } = useTranslation();
  const timezone = useSettingsStore((s) => s.timezone);
  const today = todayIn(timezone);
  const columns = useMemo<ColumnDef<SalesInvoice, unknown>[]>(
    () => [
      {
        id: 'dueDate',
        meta: { label: t('purchase.dueDate'), cellClassName: 'whitespace-nowrap' },
        header: t('purchase.dueDate'),
        cell: ({ row: { original: inv } }) => {
          const overdue = ['unpaid', 'partially_paid'].includes(inv.status) && inv.dueDate < today;
          return (
            <span className={cn(overdue && 'font-medium text-destructive')}>{formatDate(inv.dueDate)}</span>
          );
        },
      },
      moneyColumn<SalesInvoice>('total', t('purchase.total'), (r) => r.total),
      moneyColumn<SalesInvoice>('balance', t('purchase.balance'), (r) => r.balance, false),
    ],
    [t, today],
  );
  return (
    <DocumentList<SalesInvoice>
      module="sales"
      keyPrefix="sales.invoices"
      route={SALES_ROUTES.invoice}
      url="/sales/invoices"
      useList={invoicesApi.useList}
      columns={columns}
      dateField="invoiceDate"
      dateSortKey="invoiceDate"
      statuses={INVOICE_STATUSES}
      tabs={['draft', 'unpaid', 'partially_paid', 'paid']}
      actions={
        <Can permission="sales.create">
          <Button asChild>
            <Link to={`${SALES_ROUTES.invoice}/new`}>
              <Plus aria-hidden /> {t('sales.invoices.new')}
            </Link>
          </Button>
        </Can>
      }
      exportColumns={[
        { header: t('sales.customer'), value: (r) => r.customer?.name },
        { header: t('purchase.dueDate'), value: (r) => r.dueDate },
        { header: t('purchase.total'), value: (r) => r.total },
        { header: t('purchase.balance'), value: (r) => r.balance },
      ]}
    />
  );
}
