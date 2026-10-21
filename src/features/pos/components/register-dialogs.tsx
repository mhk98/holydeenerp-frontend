import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { ArrowDownToLine, ArrowUpFromLine, LockKeyhole, Printer, Unlock } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { posApi } from '../api/pos-api';
import { printHtml, reportHtml, type Paper } from '../lib/print';
import type { PosRegister, PosSession } from '../types';
import { SessionReportView } from './session-report';

const DEC = /^\d+(\.\d{1,4})?$/;

/** Start a shift: the cash in the drawer to begin with. */
export function OpenRegisterDialog({
  register,
  onOpened,
  onClose,
}: {
  register: PosRegister;
  onOpened: (s: PosSession) => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const [cash, setCash] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const s = await posApi.openSession({
        registerId: register.id,
        openingCash: cash || '0',
        notes: notes.trim() || null,
      });
      toast.success(t('pos.registerOpened', { name: register.name }));
      onOpened(s);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => !onClose && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('pos.openRegister', { name: register.name })}</DialogTitle>
          <DialogDescription>{t('pos.openRegisterHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="open-cash">{t('pos.openingCash')}</Label>
            <Input
              id="open-cash"
              inputMode="decimal"
              value={cash}
              onChange={(e) => setCash(e.target.value.trim())}
              placeholder="0"
              aria-invalid={cash !== '' && !DEC.test(cash)}
              className="h-14 text-right text-2xl tabular-nums"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="open-notes">{t('inventory.notes')}</Label>
            <Textarea id="open-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="h-12 w-full" onClick={open} disabled={busy || (cash !== '' && !DEC.test(cash))}>
            {busy ? <Spinner /> : <Unlock aria-hidden />} {t('pos.open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Put money in (float, change) or take it out (expenses, bank drop) — with a reason. */
export function CashDialog({
  session,
  onDone,
  onClose,
}: {
  session: PosSession;
  onDone: (s: PosSession) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const s = await posApi.cash(session.id, { type, amount, reason: reason.trim() });
      toast.success(t(type === 'in' ? 'pos.cashAdded' : 'pos.cashTaken', { amount: formatCurrency(amount) }));
      onDone(s);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pos.cashInOut')}</DialogTitle>
          <DialogDescription>{t('pos.cashInOutHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            value={type}
            onValueChange={(v) => v && setType(v as 'in' | 'out')}
            className="w-full"
          >
            <ToggleGroupItem value="in" className="h-12 flex-1">
              <ArrowDownToLine aria-hidden /> {t('pos.cashIn')}
            </ToggleGroupItem>
            <ToggleGroupItem value="out" className="h-12 flex-1">
              <ArrowUpFromLine aria-hidden /> {t('pos.cashOut')}
            </ToggleGroupItem>
          </ToggleGroup>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.trim())}
            placeholder="0"
            aria-label={t('purchase.amount')}
            className="h-14 text-right text-2xl tabular-nums"
            autoFocus
          />
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('pos.cashReason')}
            aria-label={t('pos.cashReason')}
            className="h-12"
          />
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full"
            onClick={save}
            disabled={busy || !DEC.test(amount) || Number(amount) <= 0 || reason.trim().length < 2}
          >
            {busy && <Spinner />} {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** X report (open session) / Z report (closed) with printing. */
export function ReportDialog({
  sessionId,
  paper,
  onClose,
}: {
  sessionId: string;
  paper: Paper;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const q = useQuery({
    queryKey: ['pos', 'session', sessionId, 'report'],
    queryFn: () => posApi.session(sessionId),
  });
  const s = q.data;
  const lang = i18n.language === 'bn' ? 'bn' : 'en';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(s?.status === 'closed' ? 'pos.report.z' : 'pos.report.x')}</DialogTitle>
          <DialogDescription>{s ? `${s.register.name} · ${s.number}` : ''}</DialogDescription>
        </DialogHeader>
        {!s?.report ? <Skeleton className="h-64" /> : <SessionReportView report={s.report} />}
        <DialogFooter>
          <Button
            variant="outline"
            className="h-12"
            disabled={!s?.report}
            onClick={() => s?.report && printHtml(reportHtml(s, s.report, { paper, lang }), paper, s.number)}
          >
            <Printer aria-hidden /> {t('purchase.actions.print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** End of shift: count the drawer note by note; the variance shows live. */
export function CloseRegisterDialog({
  session,
  denominations,
  pendingSales,
  paper,
  onClosed,
  onClose,
}: {
  session: PosSession;
  denominations: number[];
  pendingSales: number;
  paper: Paper;
  onClosed: (s: PosSession) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const live = useQuery({
    queryKey: ['pos', 'session', session.id, 'close'],
    queryFn: () => posApi.session(session.id),
  });
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const counted = denominations.reduce(
    (s, d) => s.plus(new Decimal(d).times(Number(counts[d]) || 0)),
    new Decimal(0),
  );
  const expected = live.data?.report ? new Decimal(live.data.report.cash.expected) : null;
  const variance = expected ? counted.minus(expected) : null;

  const close = async () => {
    setBusy(true);
    try {
      const denoms = Object.fromEntries(
        denominations.filter((d) => Number(counts[d]) > 0).map((d) => [String(d), Number(counts[d])]),
      );
      const s = await posApi.close(session.id, { denominations: denoms, notes: notes.trim() || null });
      toast.success(t('pos.registerClosed'));
      if (s.report)
        await printHtml(
          reportHtml(s, s.report, { paper, lang: i18n.language === 'bn' ? 'bn' : 'en' }),
          paper,
          s.number,
        );
      onClosed(s);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('pos.closeRegister')}</DialogTitle>
          <DialogDescription>{t('pos.closeRegisterHint')}</DialogDescription>
        </DialogHeader>
        {pendingSales > 0 && (
          <Alert variant="destructive">
            <AlertDescription>{t('pos.syncBeforeClose', { count: pendingSales })}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {denominations.map((d) => (
            <label key={d} className="flex items-center gap-2 rounded-lg border p-2">
              <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                {formatNumber(d, { decimals: 0 })}
              </span>
              <span className="text-muted-foreground">×</span>
              <Input
                inputMode="numeric"
                value={counts[d] ?? ''}
                onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, '') }))}
                placeholder="0"
                aria-label={t('pos.countOf', { value: d })}
                className="h-11 text-right text-lg tabular-nums"
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">{t('pos.report.expected')}</div>
            <div className="text-lg font-semibold tabular-nums">
              {expected ? formatCurrency(expected.toString()) : '…'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('pos.report.counted')}</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(counted.toString())}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('pos.report.variance')}</div>
            <div
              className={cn(
                'text-lg font-semibold tabular-nums',
                variance &&
                  (variance.isZero()
                    ? 'text-emerald-600'
                    : variance.lt(0)
                      ? 'text-destructive'
                      : 'text-amber-600'),
              )}
            >
              {variance ? formatCurrency(variance.toString()) : '…'}
            </div>
          </div>
        </div>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('pos.closingNotes')}
          aria-label={t('pos.closingNotes')}
        />
        <DialogFooter>
          <Button className="h-12 w-full" onClick={close} disabled={busy || pendingSales > 0 || !expected}>
            {busy ? <Spinner /> : <LockKeyhole aria-hidden />} {t('pos.closeAndPrint')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
