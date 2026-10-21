import { useState } from 'react';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CreditOverrideEntry, SalesTotals } from '@/types';
import { FormField } from '@/components/common/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { PurchaseStatusBadge } from '@/features/purchase/components/purchase-ui';
import type { SalesLinesForm } from '../schemas';

export function SalesStatusBadge({ status, className }: { status: string; className?: string }) {
  return <PurchaseStatusBadge status={status} className={className} module="sales" />;
}

/**
 * Totals of a sales document: subtotal, discounts, taxes, round-off and total. With `control`
 * the invoice-level discount (% or fixed) can be edited.
 */
export function SalesTotalsCard({
  totals,
  taxes,
  loading,
  control,
  extra,
}: {
  totals?: Pick<SalesTotals, 'subtotal' | 'discountTotal' | 'taxTotal' | 'roundOff' | 'total'>;
  taxes?: { name: string; amount: string }[];
  loading?: boolean;
  control?: Control<SalesLinesForm>;
  extra?: { label: string; value: string; strong?: boolean }[];
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('purchase.totals')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {control && (
          <div className="mb-1 flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{t('sales.invoiceDiscount')}</Label>
            <div className="flex gap-2">
              <FormField
                control={control}
                name="discountType"
                render={({ field, aria }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-24" {...aria} aria-label={t('sales.discountType')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="amount">{t('sales.fixed')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <div className="flex-1">
                <FormField
                  control={control}
                  name="discountValue"
                  render={({ field, aria }) => (
                    <Input
                      {...field}
                      {...aria}
                      inputMode="decimal"
                      placeholder="0"
                      className="text-right tabular-nums"
                      aria-label={t('sales.invoiceDiscount')}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        )}
        {!totals ? (
          loading ? (
            <Skeleton className="h-24" />
          ) : (
            <p className="text-muted-foreground">{t('purchase.addItemsForTotals')}</p>
          )
        ) : (
          <>
            <Row label={t('purchase.subtotal')} value={formatCurrency(totals.subtotal)} />
            {Number(totals.discountTotal) > 0 && (
              <Row label={t('purchase.discount')} value={`− ${formatCurrency(totals.discountTotal)}`} />
            )}
            {(taxes?.length
              ? taxes
              : Number(totals.taxTotal) > 0
                ? [{ name: t('purchase.tax'), amount: totals.taxTotal }]
                : []
            ).map((x) => (
              <Row key={x.name} label={x.name} value={formatCurrency(x.amount)} />
            ))}
            {Number(totals.roundOff) !== 0 && (
              <Row label={t('sales.roundOff')} value={formatCurrency(totals.roundOff)} />
            )}
            <div className="mt-1 border-t pt-2">
              <Row label={t('purchase.total')} value={formatCurrency(totals.total)} strong />
            </div>
            {extra?.map((e) => (
              <Row key={e.label} {...e} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', strong && 'text-base font-semibold')}>
      <span className={strong ? undefined : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Ask for the reason of a credit-limit override (sales.approve). */
export function CreditOverrideDialog({
  open,
  message,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  message: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" aria-hidden /> {t('sales.credit.title')}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="credit-reason">{t('sales.credit.reason')}</Label>
          <Textarea
            id="credit-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('sales.credit.reasonPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('sales.credit.logged')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onConfirm(reason.trim())} disabled={loading || reason.trim().length < 3}>
            {loading && <Spinner />} {t('sales.credit.override')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Credit-limit overrides logged on a document. */
export function CreditOverridesCard({ entries }: { entries?: CreditOverrideEntry[] }) {
  const { t } = useTranslation();
  if (!entries?.length) return null;
  return (
    <Alert>
      <ShieldAlert aria-hidden />
      <AlertDescription>
        <div className="mb-1 font-medium text-foreground">{t('sales.credit.overridden')}</div>
        <ul className="flex flex-col gap-2 text-xs">
          {entries.map((e) => (
            <li key={e.id}>
              {t('sales.credit.entry', {
                user: e.user?.name ?? '—',
                limit: formatCurrency(e.creditLimit),
                outstanding: formatCurrency(e.outstanding),
                amount: formatCurrency(e.documentAmount),
              })}{' '}
              · {formatDateTime(e.createdAt)}
              <span className="block">“{e.reason}”</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
