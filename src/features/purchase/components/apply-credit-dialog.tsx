import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApplyCredit, useOpenItems } from '../api/purchase-api';
import { useAllocations } from './use-allocations';

/** Open bills (or, with `docLabel`/`emptyLabel`, open sales invoices) with an amount input each. */
export function BillsAllocationTable({
  bills,
  amounts,
  onChange,
  docLabel,
  emptyLabel,
}: {
  bills: {
    id: string;
    number: string;
    supplierInvoiceNo?: string | null;
    customerReference?: string | null;
    dueDate: string;
    balance: string;
  }[];
  amounts: Record<string, string>;
  onChange: (id: string, value: string) => void;
  docLabel?: string;
  emptyLabel?: string;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  if (!bills.length)
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {emptyLabel ?? t('purchase.payments.noOpenBills')}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{docLabel ?? t('purchase.bills.entity')}</TableHead>
            <TableHead>{t('purchase.dueDate')}</TableHead>
            <TableHead className="text-right">{t('purchase.balance')}</TableHead>
            <TableHead className="w-40 text-right">{t('purchase.payments.allocate')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <div className="font-mono text-xs">{b.number}</div>
                {(b.supplierInvoiceNo ?? b.customerReference) && (
                  <div className="text-xs text-muted-foreground">
                    {b.supplierInvoiceNo ?? b.customerReference}
                  </div>
                )}
              </TableCell>
              <TableCell className={b.dueDate < today ? 'text-destructive' : undefined}>
                {formatDate(b.dueDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(b.balance)}</TableCell>
              <TableCell>
                <Input
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  value={amounts[b.id] ?? ''}
                  placeholder="0"
                  onChange={(e) => onChange(b.id, e.target.value.trim())}
                  aria-label={t('purchase.payments.allocateTo', { number: b.number })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Apply an advance payment or a debit note to open bills. */
export function ApplyCreditDialog({
  sourceType,
  sourceId,
  supplierId,
  available,
  onClose,
}: {
  sourceType: 'payment' | 'debit_note';
  sourceId: string;
  supplierId: string;
  available: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = useOpenItems(supplierId);
  const apply = useApplyCredit();
  const alloc = useAllocations();
  const over = alloc.total > Number(available) + 1e-9;

  const submit = () =>
    apply.mutate(
      { sourceType, sourceId, allocations: alloc.list() },
      {
        onSuccess: () => (toast.success(t('purchase.toast.creditApplied')), onClose()),
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <Dialog open onOpenChange={(o) => !o && !apply.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('purchase.payments.applyTitle')}</DialogTitle>
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
                onClick={() => alloc.autoFill(open.data?.bills ?? [], Number(available))}
              >
                {t('purchase.payments.autoAllocate')}
              </Button>
            </div>
            <BillsAllocationTable
              bills={open.data?.bills ?? []}
              amounts={alloc.amounts}
              onChange={(id, value) => alloc.setAmounts((a) => ({ ...a, [id]: value }))}
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
