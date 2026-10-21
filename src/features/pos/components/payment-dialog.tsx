import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import { Banknote, CheckCircle2, CreditCard, Smartphone, Trash2, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { uuid } from '../lib/sale';
import type { PaymentLine, PaymentMethodOption } from '../types';

const ICON = { cash: Banknote, card: CreditCard, mobile_wallet: Smartphone } as Record<
  string,
  typeof Banknote
>;
const DEC = /^\d+(\.\d{1,4})?$/;
const D = (v: string | number) => new Decimal(v && DEC.test(String(v)) ? v : 0);

/**
 * Take the money: one or more payment lines (cash + card + bKash …). Only cash can be more than
 * what's due — the difference is the change. Named customers may leave the rest on account.
 */
export function PaymentDialog({
  due,
  methods,
  quickCash,
  allowOnAccount,
  busy,
  onComplete,
  onClose,
}: {
  /** Total minus store credit. */
  due: string;
  methods: PaymentMethodOption[];
  quickCash: number[];
  allowOnAccount: boolean;
  busy: boolean;
  onComplete: (payments: PaymentLine[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cash = methods.find((m) => m.type === 'cash') ?? methods[0];
  const [lines, setLines] = useState<PaymentLine[]>(() =>
    cash
      ? [{ id: uuid(), paymentMethodId: cash.id, amount: new Decimal(due).toString(), reference: '' }]
      : [],
  );
  const [activeId, setActiveId] = useState(lines[0]?.id ?? null);
  const methodOf = (id: string) => methods.find((m) => m.id === id);

  const total = new Decimal(due);
  const paid = lines.reduce((s, l) => s.plus(D(l.amount)), new Decimal(0));
  const nonCash = lines
    .filter((l) => methodOf(l.paymentMethodId)?.type !== 'cash')
    .reduce((s, l) => s.plus(D(l.amount)), new Decimal(0));
  const remaining = Decimal.max(total.minus(paid), 0);
  const change = Decimal.max(paid.minus(total), 0);
  const overNonCash = nonCash.gt(total);
  const missingRef = lines.some(
    (l) => D(l.amount).gt(0) && methodOf(l.paymentMethodId)?.requiresReference && !l.reference.trim(),
  );
  const badAmount = lines.some((l) => l.amount !== '' && !DEC.test(l.amount));
  const canComplete =
    !busy && !overNonCash && !missingRef && !badAmount && (remaining.isZero() || allowOnAccount);

  const setLine = (id: string, patch: Partial<PaymentLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addMethod = (m: PaymentMethodOption) => {
    const existing = lines.find((l) => l.paymentMethodId === m.id);
    if (existing) return setActiveId(existing.id);
    // A new method takes what is still to pay; the cash line shrinks to make room.
    const left = remaining.gt(0) ? remaining : Decimal.max(total.minus(nonCash), 0);
    const next = lines.map((l) =>
      methodOf(l.paymentMethodId)?.type === 'cash' && remaining.isZero()
        ? { ...l, amount: Decimal.max(D(l.amount).minus(left), 0).toString() }
        : l,
    );
    const line = { id: uuid(), paymentMethodId: m.id, amount: left.toString(), reference: '' };
    setLines([...next.filter((l) => D(l.amount).gt(0) || l.paymentMethodId !== cash?.id), line]);
    setActiveId(line.id);
  };
  const setCash = (amount: Decimal) => {
    if (!cash) return;
    const existing = lines.find((l) => l.paymentMethodId === cash.id);
    if (existing) setLine(existing.id, { amount: amount.toString() });
    else
      setLines([
        ...lines,
        { id: uuid(), paymentMethodId: cash.id, amount: amount.toString(), reference: '' },
      ]);
  };
  const cashLine = lines.find((l) => l.paymentMethodId === cash?.id);
  const cashDue = Decimal.max(total.minus(nonCash), 0);
  // Exact, the configured notes above what's due, and the next round 100 / 500.
  const quick = [
    cashDue,
    ...quickCash.map((q) => new Decimal(q)).filter((q) => q.gt(cashDue)),
    cashDue.dividedBy(100).ceil().times(100),
    cashDue.dividedBy(500).ceil().times(500),
  ]
    .filter((v, i, all) => v.gt(0) && all.findIndex((x) => x.eq(v)) === i)
    .sort((a, b) => a.comparedTo(b))
    .slice(0, 6);

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-baseline justify-between gap-4 pr-8">
            <span>{t('pos.payment')}</span>
            <span className="text-3xl tabular-nums">{formatCurrency(due)}</span>
          </DialogTitle>
          <DialogDescription>{t('pos.paymentHint')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {methods.map((m) => {
            const Icon = ICON[m.type] ?? Wallet;
            const used = lines.some((l) => l.paymentMethodId === m.id);
            return (
              <Button
                key={m.id}
                type="button"
                variant={used ? 'default' : 'outline'}
                className="h-14 flex-col gap-0.5 text-xs"
                onClick={() => addMethod(m)}
              >
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{m.name}</span>
              </Button>
            );
          })}
        </div>

        <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const m = methodOf(l.paymentMethodId);
            return (
              <li
                key={l.id}
                className={cn(
                  'grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_10rem_auto]',
                  activeId === l.id && 'border-primary',
                )}
                onClick={() => setActiveId(l.id)}
              >
                <div className="flex flex-col justify-center">
                  <span className="font-medium">{m?.name}</span>
                  {m?.requiresReference && (
                    <Input
                      value={l.reference}
                      onChange={(e) => setLine(l.id, { reference: e.target.value })}
                      placeholder={t('pos.reference')}
                      aria-label={t('pos.reference')}
                      aria-invalid={D(l.amount).gt(0) && !l.reference.trim()}
                      className="mt-1 h-10"
                    />
                  )}
                </div>
                <Input
                  inputMode="decimal"
                  value={l.amount}
                  onChange={(e) => setLine(l.id, { amount: e.target.value.trim() })}
                  onFocus={(e) => e.target.select()}
                  aria-label={t('pos.amountFor', { method: m?.name })}
                  aria-invalid={l.amount !== '' && !DEC.test(l.amount)}
                  className="h-12 text-right text-xl tabular-nums"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-12"
                  onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                  aria-label={t('common.remove')}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>

        {cash && (
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('pos.quickCash')}</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {quick.map((q) => (
                <Button
                  key={q.toString()}
                  type="button"
                  variant={cashLine && D(cashLine.amount).eq(q) ? 'secondary' : 'outline'}
                  className="h-12 text-base tabular-nums"
                  onClick={() => setCash(q)}
                >
                  {formatCurrency(q.toString(), { decimals: 0 })}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center">
          <Stat label={t('pos.paid')} value={formatCurrency(paid.toString())} />
          <Stat
            label={allowOnAccount && remaining.gt(0) ? t('pos.onAccount') : t('pos.remaining')}
            value={formatCurrency(remaining.toString())}
            tone={remaining.gt(0) ? 'warning' : undefined}
          />
          <Stat
            label={t('pos.change')}
            value={formatCurrency(change.toString())}
            tone={change.gt(0) ? 'success' : undefined}
            big
          />
        </div>
        {overNonCash && <p className="text-sm text-destructive">{t('pos.nonCashOver')}</p>}
        {missingRef && <p className="text-sm text-destructive">{t('pos.referenceNeeded')}</p>}
        {remaining.gt(0) && !allowOnAccount && (
          <p className="text-sm text-muted-foreground">{t('pos.payInFull')}</p>
        )}

        <Button
          type="button"
          className="h-16 w-full text-xl"
          disabled={!canComplete}
          onClick={() => onComplete(lines)}
        >
          {busy ? <Spinner /> : <CheckCircle2 className="size-6" aria-hidden />} {t('pos.completeSale')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: 'warning' | 'success';
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-semibold tabular-nums',
          big ? 'text-2xl' : 'text-lg',
          tone === 'warning' && 'text-amber-600',
          tone === 'success' && 'text-emerald-600',
        )}
      >
        {value}
      </div>
    </div>
  );
}
