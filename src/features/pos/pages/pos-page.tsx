import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  CloudOff,
  Cloud,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  PauseCircle,
  Printer,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FullScreenLoader } from '@/components/common/full-screen-loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { posApi } from '../api/pos-api';
import { CartPanel } from '../components/cart-panel';
import { CustomerDialog } from '../components/customer-dialog';
import { DiscountDialog } from '../components/discount-dialog';
import { HeldDialog } from '../components/held-dialog';
import { LineDialog } from '../components/line-dialog';
import { PaymentDialog } from '../components/payment-dialog';
import { ProductGrid } from '../components/product-grid';
import { QueueDialog } from '../components/queue-dialog';
import {
  CashDialog,
  CloseRegisterDialog,
  OpenRegisterDialog,
  ReportDialog,
} from '../components/register-dialogs';
import { ReturnDialog } from '../components/return-dialog';
import { useCart } from '../lib/cart-store';
import { findByCode } from '../lib/catalog';
import { isNetworkError, usePos } from '../lib/pos-store';
import { printHtml, receiptHtml } from '../lib/print';
import { buildPayload, localReceipt, priceLines } from '../lib/sale';
import { useBarcodeScanner, useConnection, useShortcuts } from '../lib/use-pos-hooks';
import type { CartLine, CatalogItem, PaymentLine, ReceiptData } from '../types';

type DialogName =
  | 'customer'
  | 'pay'
  | 'discount'
  | 'held'
  | 'hold'
  | 'return'
  | 'cash'
  | 'report'
  | 'close'
  | 'queue'
  | 'clear';

/** Full-screen point of sale. */
export default function PosPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { can } = usePermission();
  const pos = usePos();
  const cart = useCart();
  const online = useConnection();
  const searchRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [editing, setEditing] = useState<CartLine | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (user) void usePos.getState().init(user.id);
  }, [user]);

  const boot = pos.boot;
  const register = boot?.register ?? null;
  const session = pos.session;
  const settings = boot?.settings.pos;
  const walkInId = register?.defaultCustomerId ?? null;
  const canEditPrice = Boolean(settings?.allowPriceEdit) || can('pos.update');
  const maxDiscount = can('pos.update') ? null : (settings?.maxDiscountPercent ?? null);
  const lang = i18n.language === 'bn' ? 'bn' : 'en';
  const pending = pos.queue.filter((q) => !q.failed).length;
  const failed = pos.queue.length - pending;

  const pricing = useMemo(() => (boot ? priceLines(cart.lines, cart, boot) : null), [boot, cart]);
  const totals = pricing?.totals;
  const due = totals
    ? Decimal.max(new Decimal(totals.total).minus(cart.credit?.amount ?? 0), 0).toString()
    : '0';

  const print = (receipt: ReceiptData, opts: { offline?: boolean; copy?: boolean } = {}) =>
    printHtml(
      receiptHtml(receipt, {
        paper: register?.receiptPaper ?? 'thermal_80',
        lang,
        register: register?.name,
        cashier: user?.name,
        ...opts,
      }),
      register?.receiptPaper ?? 'thermal_80',
      receipt.invoice.number || receipt.invoice.offlineNumber || 'Receipt',
    );

  const pick = (item: CatalogItem, unitId?: string | null) => {
    if (!session) return toast.error(t('pos.openFirst'));
    cart.add(item, unitId);
  };
  const scan = (code: string) => {
    const hit = pos.catalog ? findByCode(pos.catalog.items, code) : null;
    if (hit) pick(hit.item, hit.unitId);
    else toast.error(t('pos.notFound', { code }));
  };
  useBarcodeScanner(scan, Boolean(session) && !dialog && !editing);

  const startPay = () => {
    if (!cart.lines.length || !session) return;
    const serialMissing = cart.lines.find((l) => {
      const factor = Number(l.item.units.find((u) => u.unitId === l.unitId)?.factor ?? 1);
      return l.item.trackSerial && l.serialNumbers.length !== Number(l.quantity) * factor;
    });
    if (serialMissing) {
      toast.error(t('pos.serialsMissing', { name: serialMissing.item.name }));
      return setEditing(serialMissing);
    }
    setDialog('pay');
  };

  useShortcuts(
    {
      F2: () => searchRef.current?.focus(),
      F4: () => setDialog('customer'),
      F8: () => cart.lines.length && setDialog('hold'),
      F9: startPay,
      Escape: () => (dialog ? setDialog(null) : cart.lines.length && setDialog('clear')),
    },
    Boolean(session),
  );

  /** Complete the sale: online straight to the server; offline (or if the network drops) queued. */
  const complete = async (payments: PaymentLine[]) => {
    if (!session || !register || !boot || !pricing) return;
    const payload = buildPayload({
      lines: cart.lines,
      customer: cart.customer,
      discountType: cart.discountType,
      discountValue: cart.discountValue,
      notes: cart.notes,
      payments,
      credit: cart.credit ? { returnId: cart.credit.returnId, amount: cart.credit.amount } : null,
      registerId: register.id,
      sessionId: session.id,
    });
    const stockLines = cart.lines.map((l) => ({
      key: l.item.key,
      baseQuantity: new Decimal(l.quantity)
        .times(l.item.units.find((u) => u.unitId === l.unitId)?.factor ?? 1)
        .toString(),
    }));
    setPaying(true);
    try {
      let receipt: ReceiptData | null = null;
      let offline = !online;
      if (online) {
        try {
          receipt = await posApi.sale(payload);
        } catch (err) {
          if (!isNetworkError(err)) throw err;
          pos.setOnline(false);
          offline = true;
        }
      }
      if (offline) {
        if (!settings?.offlineEnabled) throw new Error(t('pos.offlineDisabled'));
        const number = await pos.nextOfflineNumber();
        payload.offline = { number, soldAt: new Date().toISOString() };
        receipt = localReceipt({
          payload,
          lines: cart.lines,
          priced: pricing.lines,
          totals: pricing.totals,
          customer: cart.customer,
          methods: boot.paymentMethods,
          company: boot.company,
          footer: settings.receiptFooter,
          number,
        });
        await pos.enqueue(payload, receipt);
      }
      pos.takeStock(stockLines);
      pos.setLastReceipt(receipt);
      cart.clear();
      setDialog(null);
      const change = new Decimal(receipt!.invoice.changeAmount || 0);
      toast.success(
        change.gt(0)
          ? t('pos.saleDoneChange', { change: formatCurrency(change.toString()) })
          : t(offline ? 'pos.saleQueued' : 'pos.saleDone'),
        { duration: change.gt(0) ? 10_000 : 4000 },
      );
      if (settings?.autoPrint) await print(receipt!, { offline });
      searchRef.current?.focus();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPaying(false);
    }
  };

  if (!user || pos.status === 'idle' || pos.status === 'loading') return <FullScreenLoader />;
  if (pos.status === 'error' || !boot)
    return (
      <CenterMessage title={t('pos.loadFailed')} text={pos.error ?? ''}>
        <Button onClick={() => pos.init(user.id)}>
          <RefreshCw aria-hidden /> {t('common.retry')}
        </Button>
      </CenterMessage>
    );
  if (!boot.registers.length)
    return (
      <CenterMessage title={t('pos.noRegisters')} text={t('pos.noRegistersHint')}>
        {can('settings.update') && (
          <Button asChild>
            <Link to="/settings/pos">{t('pos.setUpRegisters')}</Link>
          </Button>
        )}
      </CenterMessage>
    );
  if (!register)
    return (
      <CenterMessage title={t('pos.chooseRegister')} text={t('pos.chooseRegisterHint')}>
        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {boot.registers.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pos.selectRegister(r.id)}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:border-primary"
            >
              <MonitorSmartphone className="size-8 text-muted-foreground" aria-hidden />
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {r.branch.name} · {r.warehouse.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      </CenterMessage>
    );

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label={t('pos.exit')}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{register.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {session ? `${session.number} · ${user.name}` : t('pos.registerClosedShort')}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDialog('queue')}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
            online
              ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/50 bg-destructive/10 text-destructive',
          )}
          aria-label={t('pos.queueTitle')}
        >
          {online ? <Cloud className="size-4" aria-hidden /> : <CloudOff className="size-4" aria-hidden />}
          {online ? t('pos.online') : t('pos.offline')}
          {pending > 0 && <Badge variant="secondary">{t('pos.pending', { count: pending })}</Badge>}
          {failed > 0 && <Badge variant="destructive">{failed}</Badge>}
        </button>
        <Button
          variant="outline"
          className="hidden h-10 sm:inline-flex"
          onClick={() => setDialog('held')}
          disabled={!online}
        >
          <PauseCircle aria-hidden /> {t('pos.held')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-10" aria-label={t('pos.menu')}>
              <Menu aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => setDialog('held')} disabled={!online || !session}>
              <PauseCircle aria-hidden /> {t('pos.heldOrders')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog('return')} disabled={!online || !session}>
              <Undo2 aria-hidden /> {t('pos.returns')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => pos.lastReceipt && print(pos.lastReceipt, { copy: true })}
              disabled={!pos.lastReceipt}
            >
              <Printer aria-hidden /> {t('pos.reprint')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDialog('cash')} disabled={!online || !session}>
              <ArrowLeftRight aria-hidden /> {t('pos.cashInOut')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog('report')} disabled={!online || !session}>
              <BarChart3 aria-hidden /> {t('pos.report.x')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog('close')} disabled={!online || !session}>
              <LockKeyhole aria-hidden /> {t('pos.closeRegister')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => pos.refreshCatalog()} disabled={!online}>
              <RefreshCw aria-hidden /> {t('pos.refreshItems')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => pos.selectRegister(null)} disabled={Boolean(cart.lines.length)}>
              <MonitorSmartphone aria-hidden /> {t('pos.switchRegister')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-1">
        <section className="min-h-0 p-3 sm:p-4" aria-label={t('pos.items')}>
          {pos.catalog ? (
            <ProductGrid
              ref={searchRef}
              items={pos.catalog.items}
              categories={boot.categories}
              onPick={pick}
              onNotFound={(code) => toast.error(t('pos.notFound', { code }))}
            />
          ) : (
            <p className="py-16 text-center text-muted-foreground">
              {online ? t('common.loading') : t('pos.noCachedItems')}
            </p>
          )}
        </section>
        <aside className="min-h-0 border-t lg:border-t-0 lg:border-l" aria-label={t('pos.cart')}>
          <CartPanel
            priced={pricing?.lines ?? []}
            totals={
              totals ?? {
                subtotal: '0',
                discountTotal: '0',
                taxTotal: '0',
                roundOff: '0',
                total: '0',
                taxes: [],
              }
            }
            walkInName={register.defaultCustomer?.name ?? null}
            onCustomer={() => setDialog('customer')}
            onLine={setEditing}
            onDiscount={() => setDialog('discount')}
            onHold={() => setDialog('hold')}
            onClear={() => setDialog('clear')}
            onPay={startPay}
            disabled={!session}
          />
        </aside>
      </main>

      {!session && online && <OpenRegisterDialog register={register} onOpened={(s) => pos.setSession(s)} />}
      {!session && !online && <CenterOverlay text={t('pos.offlineNoSession')} />}
      {editing && (
        <LineDialog
          line={editing}
          canEditPrice={canEditPrice}
          maxDiscount={maxDiscount}
          onClose={() => setEditing(null)}
        />
      )}
      {dialog === 'customer' && (
        <CustomerDialog
          walkInId={walkInId}
          onPick={(c) => {
            cart.setCustomer(c);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'discount' && <DiscountDialog maxDiscount={maxDiscount} onClose={() => setDialog(null)} />}
      {dialog === 'pay' && boot && (
        <PaymentDialog
          due={due}
          methods={boot.paymentMethods}
          quickCash={settings?.quickCash ?? []}
          allowOnAccount={online && Boolean(cart.customer) && cart.customer?.id !== walkInId}
          busy={paying}
          onComplete={complete}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'hold' && (
        <HoldDialog
          total={totals?.total ?? '0'}
          onHold={async (label) => {
            try {
              await posApi.hold({
                registerId: register.id,
                label,
                customerId: cart.customer?.id ?? null,
                cart: cart.snapshot(),
                total: totals?.total ?? '0',
              });
              cart.clear();
              setDialog(null);
              toast.success(t('pos.heldDone', { label }));
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'held' && (
        <HeldDialog
          registerId={register.id}
          onRecall={(held) => {
            if (cart.lines.length) toast.warning(t('pos.cartReplaced'));
            cart.load(held);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'return' && session && (
        <ReturnDialog
          registerId={register.id}
          sessionId={session.id}
          methods={boot.paymentMethods}
          onDone={(result, sale, mode) => {
            setDialog(null);
            void pos.refreshCatalog();
            if (mode === 'exchange' && Number(result.credit) > 0) {
              cart.clear();
              const c = pos.customers.find((x) => x.id === result.customerId);
              cart.setCustomer(c && c.id !== walkInId ? c : null);
              cart.setCredit({ returnId: result.id, number: result.number, amount: result.credit });
              toast.success(t('pos.exchangeReady', { amount: formatCurrency(result.credit) }));
            } else {
              toast.success(
                t('pos.refunded', {
                  amount: formatCurrency(result.refundedAmount),
                  number: sale.invoice.number,
                }),
              );
            }
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'cash' && session && (
        <CashDialog
          session={session}
          onDone={(s) => {
            pos.setSession({ ...session, ...s });
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'report' && session && (
        <ReportDialog sessionId={session.id} paper={register.receiptPaper} onClose={() => setDialog(null)} />
      )}
      {dialog === 'close' && session && settings && (
        <CloseRegisterDialog
          session={session}
          denominations={settings.denominations}
          pendingSales={pending}
          paper={register.receiptPaper}
          onClosed={() => {
            pos.setSession(null);
            cart.clear();
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'queue' && <QueueDialog onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'clear'}
        onOpenChange={(o) => !o && setDialog(null)}
        destructive
        title={t('pos.clearTitle')}
        description={t('pos.clearText')}
        confirmLabel={t('pos.clear')}
        onConfirm={() => {
          cart.clear();
          setDialog(null);
        }}
      />
    </div>
  );
}

function HoldDialog({
  total,
  onHold,
  onClose,
}: {
  total: string;
  onHold: (label: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await onHold(label.trim() || new Date().toLocaleTimeString());
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('pos.holdTitle', { total: formatCurrency(total) })}</DialogTitle>
        </DialogHeader>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          placeholder={t('pos.holdLabel')}
          aria-label={t('pos.holdLabel')}
          className="h-12"
          autoFocus
        />
        <DialogFooter>
          <Button className="h-12 w-full" onClick={save} disabled={busy}>
            <PauseCircle aria-hidden /> {t('pos.hold')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CenterMessage({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <MonitorSmartphone className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">{title}</h1>
      {text && <p className="max-w-md text-muted-foreground">{text}</p>}
      {children}
      <Button variant="ghost" asChild>
        <Link to="/">
          <ArrowLeft aria-hidden /> {t('pos.exit')}
        </Link>
      </Button>
    </div>
  );
}

function CenterOverlay({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-6 text-center backdrop-blur-sm">
      <p className="max-w-sm text-lg">{text}</p>
    </div>
  );
}
