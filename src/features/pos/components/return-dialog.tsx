import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { Repeat, Search, Undo2 } from 'lucide-react';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/format';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { posApi } from '../api/pos-api';
import type { PaymentMethodOption, PosReturnResult, ReceiptData } from '../types';

/**
 * Return from a receipt: find the sale, choose what comes back, then refund it (cash / card / bKash)
 * or keep it as store credit for an exchange.
 */
export function ReturnDialog({
  registerId,
  sessionId,
  methods,
  onDone,
  onClose,
}: {
  registerId: string;
  sessionId: string;
  methods: PaymentMethodOption[];
  onDone: (result: PosReturnResult, sale: ReceiptData, mode: 'refund' | 'exchange') => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [number, setNumber] = useState('');
  const [sale, setSale] = useState<ReceiptData | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'refund' | 'exchange'>('refund');
  const [methodId, setMethodId] = useState(methods.find((m) => m.type === 'cash')?.id ?? '');
  const [busy, setBusy] = useState(false);

  const find = async () => {
    setBusy(true);
    try {
      const found = await posApi.lookup(number.trim());
      setSale(found);
      setQty({});
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const items = sale?.invoice.items ?? [];
  const left = (id: string) => sale?.returnable?.find((r) => r.invoiceItemId === id);
  const refund = items.reduce((s, i) => {
    const r = left(i.id);
    return r && Number(qty[i.id]) > 0 ? s.plus(new Decimal(qty[i.id]).times(r.unitRefund)) : s;
  }, new Decimal(0));
  const invalid = items.some((i) => {
    const v = qty[i.id];
    return v && (!/^\d+(\.\d{1,4})?$/.test(v) || Number(v) > Number(left(i.id)?.returnableBaseQuantity ?? 0));
  });
  const chosen = items.filter((i) => Number(qty[i.id]) > 0);

  const submit = async () => {
    if (!sale) return;
    setBusy(true);
    try {
      const result = await posApi.returnItems(sale.invoice.id, {
        registerId,
        sessionId,
        reason: reason.trim() || null,
        items: chosen.map((i) => ({ invoiceItemId: i.id, quantity: qty[i.id] })),
        ...(mode === 'refund' && methodId && { refund: { paymentMethodId: methodId } }),
      });
      onDone(result, sale, mode);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('pos.returns')}</DialogTitle>
          <DialogDescription>{t('pos.returnsHint')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void find();
          }}
        >
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={t('pos.receiptNumber')}
            aria-label={t('pos.receiptNumber')}
            className="h-12 font-mono"
            autoFocus
          />
          <Button type="submit" className="h-12" disabled={busy || !number.trim()}>
            {busy && !sale ? <Spinner /> : <Search aria-hidden />} {t('pos.find')}
          </Button>
        </form>

        {sale && (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{sale.invoice.number}</span> ·{' '}
              {formatDateTime(sale.invoice.postedAt)} · {sale.invoice.customer?.name} ·{' '}
              {formatCurrency(sale.invoice.total)}
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('inventory.item')}</TableHead>
                    <TableHead className="text-right">{t('pos.canReturn')}</TableHead>
                    <TableHead className="w-28 text-right">{t('pos.returnQty')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => {
                    const r = left(i.id);
                    const max = r?.returnableBaseQuantity ?? '0';
                    return (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.variant ? `${i.product.name} — ${i.variant.name}` : i.product.name}
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(r?.unitRefund)} / {i.product.baseUnit?.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatQuantity(max)}</TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            value={qty[i.id] ?? ''}
                            onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value.trim() }))}
                            placeholder="0"
                            disabled={Number(max) <= 0}
                            aria-label={t('pos.returnQty')}
                            className="h-11 text-right tabular-nums"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('sales.returns.reason')}
              className="h-12"
            />
            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(v) => v && setMode(v as typeof mode)}
              className="w-full"
            >
              <ToggleGroupItem value="refund" className="h-12 flex-1">
                <Undo2 aria-hidden /> {t('pos.refund')}
              </ToggleGroupItem>
              <ToggleGroupItem value="exchange" className="h-12 flex-1">
                <Repeat aria-hidden /> {t('pos.exchange')}
              </ToggleGroupItem>
            </ToggleGroup>
            {mode === 'refund' ? (
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger className="h-12 w-full" aria-label={t('pos.refundBy')}>
                  <SelectValue placeholder={t('pos.refundBy')} />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Alert>
                <AlertDescription>{t('pos.exchangeHint')}</AlertDescription>
              </Alert>
            )}
          </>
        )}
        {sale && (
          <DialogFooter>
            <Button
              className="h-14 w-full text-lg"
              onClick={submit}
              disabled={busy || !chosen.length || invalid}
            >
              {busy ? <Spinner /> : <Undo2 aria-hidden />}{' '}
              {t(mode === 'refund' ? 'pos.refundAmount' : 'pos.creditAmount', {
                amount: formatCurrency(refund.toString()),
              })}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
