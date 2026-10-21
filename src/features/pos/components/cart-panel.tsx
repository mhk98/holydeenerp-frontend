import { useTranslation } from 'react-i18next';
import { Minus, PauseCircle, Plus, ShoppingCart, Tag, Trash2, UserRound, Wallet, X } from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '../lib/cart-store';
import type { CartTotals, PricedLine } from '../lib/pricing';
import type { CartLine } from '../types';

interface Props {
  priced: PricedLine[];
  totals: CartTotals;
  walkInName: string | null;
  onCustomer: () => void;
  onLine: (line: CartLine) => void;
  onDiscount: () => void;
  onHold: () => void;
  onClear: () => void;
  onPay: () => void;
  disabled?: boolean;
}

/** Right-hand side of the POS: customer, cart lines, totals and the big pay button. */
export function CartPanel({
  priced,
  totals,
  walkInName,
  onCustomer,
  onLine,
  onDiscount,
  onHold,
  onClear,
  onPay,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { lines, customer, credit, selectedId, bump, remove, select, setCredit } = useCart();
  const count = lines.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        onClick={onCustomer}
        className="flex h-14 shrink-0 items-center gap-3 border-b px-4 text-left hover:bg-muted/50"
      >
        <UserRound className="size-5 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {customer?.name ?? walkInName ?? t('pos.walkIn')}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {customer ? [customer.code, customer.phone].filter(Boolean).join(' · ') : t('pos.changeCustomer')}
          </span>
        </span>
        <kbd className="rounded border px-1.5 text-xs text-muted-foreground">F4</kbd>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!count ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <ShoppingCart className="size-10 opacity-40" aria-hidden />
            <p>{t('pos.emptyCart')}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {lines.map((l, i) => {
              const unit = l.item.units.find((u) => u.unitId === l.unitId);
              return (
                <li
                  key={l.id}
                  className={cn('flex gap-2 px-3 py-2', selectedId === l.id && 'bg-primary/5')}
                  onClick={() => select(l.id)}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onLine(l)}>
                    <span className="line-clamp-2 text-sm font-medium">
                      {l.item.name}
                      {l.item.variantName && (
                        <span className="text-muted-foreground"> — {l.item.variantName}</span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(l.unitPrice)} / {unit?.code ?? l.item.baseUnit.code}
                      {Number(priced[i]?.discountAmount) > 0 && (
                        <span className="text-emerald-600">
                          {' '}
                          · −{formatCurrency(priced[i].discountAmount)}
                        </span>
                      )}
                    </span>
                    {l.notes && (
                      <span className="block truncate text-xs text-muted-foreground italic">{l.notes}</span>
                    )}
                    {l.item.trackSerial && (
                      <span
                        className={cn(
                          'block text-xs',
                          l.serialNumbers.length ? 'text-muted-foreground' : 'text-destructive',
                        )}
                      >
                        {t('pos.serials', { count: l.serialNumbers.length })}
                      </span>
                    )}
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(priced[i]?.lineTotal)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          bump(l.id, -1);
                        }}
                        aria-label={t('pos.less')}
                      >
                        <Minus aria-hidden />
                      </Button>
                      <span className="min-w-8 text-center text-sm tabular-nums">
                        {formatQuantity(l.quantity)}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          bump(l.id, 1);
                        }}
                        aria-label={t('pos.more')}
                      >
                        <Plus aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(l.id);
                        }}
                        aria-label={t('common.remove')}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t bg-muted/30 px-4 py-3">
        <dl className="flex flex-col gap-1 text-sm tabular-nums">
          <Row label={t('purchase.subtotal')} value={formatCurrency(totals.subtotal)} />
          {Number(totals.discountTotal) > 0 && (
            <Row label={t('purchase.discount')} value={`− ${formatCurrency(totals.discountTotal)}`} />
          )}
          {totals.taxes.map((x) => (
            <Row key={x.name} label={x.name} value={formatCurrency(x.amount)} />
          ))}
          {Number(totals.roundOff) !== 0 && (
            <Row label={t('sales.roundOff')} value={formatCurrency(totals.roundOff)} />
          )}
          {credit && (
            <div className="flex items-center justify-between gap-2 text-emerald-700 dark:text-emerald-400">
              <dt className="flex items-center gap-1">
                {t('pos.creditFrom', { number: credit.number })}
                <button type="button" onClick={() => setCredit(null)} aria-label={t('common.remove')}>
                  <X className="size-3.5" aria-hidden />
                </button>
              </dt>
              <dd>− {formatCurrency(credit.amount)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-2 flex items-baseline justify-between border-t pt-2">
          <span className="text-lg font-medium">{t('purchase.total')}</span>
          <span className="text-3xl font-bold tabular-nums">{formatCurrency(totals.total)}</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={onDiscount}
            disabled={!count || disabled}
          >
            <Tag aria-hidden /> <span className="sr-only sm:not-sr-only">{t('pos.discount')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={onHold}
            disabled={!count || disabled}
          >
            <PauseCircle aria-hidden /> <span className="sr-only sm:not-sr-only">{t('pos.hold')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="col-span-2 h-12"
            onClick={onClear}
            disabled={!count}
          >
            <X aria-hidden /> {t('pos.clear')}
          </Button>
        </div>
        <Button
          type="button"
          className="mt-2 h-16 w-full text-xl font-semibold"
          onClick={onPay}
          disabled={!count || disabled}
        >
          <Wallet className="size-6" aria-hidden /> {t('pos.pay')} {formatCurrency(totals.total)}
          <kbd className="ml-2 rounded border border-primary-foreground/40 px-1.5 text-xs font-normal">
            F9
          </kbd>
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
