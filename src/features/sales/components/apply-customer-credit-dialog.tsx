import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { BillsAllocationTable } from '@/features/purchase/components/apply-credit-dialog';
import { useAllocations } from '@/features/purchase/components/use-allocations';
import { useApplyCustomerCredit, useCustomerOpenItems } from '../api/sales-api';

/** Apply an advance receipt or a credit note to the customer's open invoices. */
export function ApplyCustomerCreditDialog({
  sourceType,
  sourceId,
  customerId,
  available,
  onClose,
}: {
  sourceType: 'receipt' | 'credit_note';
  sourceId: string;
  customerId: string;
  available: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = useCustomerOpenItems(customerId);
  const apply = useApplyCustomerCredit();
  const alloc = useAllocations();
  const over = alloc.total > Number(available) + 1e-9;

  const submit = () =>
    apply.mutate(
      { sourceType, sourceId, allocations: alloc.list('invoiceId') },
      {
        onSuccess: () => (toast.success(t('purchase.toast.creditApplied')), onClose()),
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <Dialog open onOpenChange={(o) => !o && !apply.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('sales.receipts.applyTitle')}</DialogTitle>
          <DialogDescription>
            {t('purchase.payments.applyHint', { amount: formatCurrency(available) })}
          </DialogDescription>
        </DialogHeader>
        {open.isPending ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => alloc.autoFill(open.data?.invoices ?? [], Number(available))}
              >
                {t('purchase.payments.autoAllocate')}
              </Button>
            </div>
            <BillsAllocationTable
              bills={open.data?.invoices ?? []}
              amounts={alloc.amounts}
              onChange={(id, value) => alloc.setAmounts((a) => ({ ...a, [id]: value }))}
              docLabel={t('sales.invoices.entity')}
              emptyLabel={t('sales.receipts.noOpenInvoices')}
            />
            <p className={over ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {t('purchase.payments.allocatedOf', {
                allocated: formatCurrency(alloc.total),
                available: formatCurrency(available),
              })}
            </p>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={apply.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={apply.isPending || over || alloc.total <= 0}>
            {apply.isPending && <Spinner />} {t('purchase.payments.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
