import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { RecurringInvoice } from '@/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { invoicesApi, useUpdateRecurring } from '../api/sales-api';
import { SALES_ROUTES } from '../lib';

const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

/**
 * Repeat an invoice on a schedule (`invoiceId`), or edit an existing schedule (`schedule`).
 * Each run copies the source invoice with today's prices kept as they were.
 */
export function RecurringDialog({
  invoiceId,
  schedule,
  defaultName,
  onClose,
}: {
  invoiceId?: string;
  schedule?: RecurringInvoice;
  defaultName?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = invoicesApi.useAction();
  const update = useUpdateRecurring();
  const [name, setName] = useState(schedule?.name ?? defaultName ?? '');
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>(schedule?.frequency ?? 'monthly');
  const [intervalCount, setIntervalCount] = useState(String(schedule?.intervalCount ?? 1));
  const [date, setDate] = useState(schedule?.nextRunDate ?? '');
  const [endDate, setEndDate] = useState(schedule?.endDate ?? '');
  const [autoPost, setAutoPost] = useState(schedule?.autoPost ?? false);
  const [autoEmail, setAutoEmail] = useState(schedule?.autoEmail ?? false);
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);
  const busy = create.isPending || update.isPending;
  const validInterval = /^([1-9]|1[0-2])$/.test(intervalCount);

  const submit = () => {
    const common = {
      frequency,
      intervalCount: Number(intervalCount),
      endDate: endDate || null,
      autoPost,
      autoEmail: autoPost && autoEmail,
    };
    if (schedule) {
      update.mutate(
        { id: schedule.id, data: { ...common, name, ...(date && { nextRunDate: date }), isActive } },
        {
          onSuccess: () => (toast.success(t('sales.recurring.saved')), onClose()),
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      create.mutate(
        {
          id: invoiceId!,
          action: 'make-recurring',
          body: { ...common, ...(name.trim() && { name: name.trim() }), ...(date && { startDate: date }) },
        },
        {
          onSuccess: (r) => {
            toast.success(t('sales.recurring.created'));
            onClose();
            navigate(`${SALES_ROUTES.recurring}?highlight=${r.id}`);
          },
          onError: (err) => toast.error(err.message),
        },
      );
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(schedule ? 'sales.recurring.edit' : 'sales.recurring.make')}</DialogTitle>
          <DialogDescription>{t('sales.recurring.hint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rec-name">{t('sales.recurring.name')}</Label>
            <Input id="rec-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t('sales.recurring.frequency')}</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`sales.recurring.frequencies.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rec-every">{t('sales.recurring.every')}</Label>
              <Input
                id="rec-every"
                inputMode="numeric"
                value={intervalCount}
                onChange={(e) => setIntervalCount(e.target.value.trim())}
                aria-invalid={!validInterval}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rec-date">
                {t(schedule ? 'sales.recurring.nextRun' : 'sales.recurring.firstRun')}
              </Label>
              <Input id="rec-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {!schedule && (
                <p className="text-xs text-muted-foreground">{t('sales.recurring.firstRunHint')}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rec-end">{t('sales.recurring.endDate')}</Label>
              <Input id="rec-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="rec-post" className="flex flex-col items-start gap-0.5">
              {t('sales.recurring.autoPost')}
              <span className="text-xs font-normal text-muted-foreground">
                {t('sales.recurring.autoPostHint')}
              </span>
            </Label>
            <Switch id="rec-post" checked={autoPost} onCheckedChange={setAutoPost} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="rec-email" className="flex flex-col items-start gap-0.5">
              {t('sales.recurring.autoEmail')}
              <span className="text-xs font-normal text-muted-foreground">
                {t('sales.recurring.autoEmailHint')}
              </span>
            </Label>
            <Switch
              id="rec-email"
              checked={autoPost && autoEmail}
              onCheckedChange={setAutoEmail}
              disabled={!autoPost}
            />
          </div>
          {schedule && (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="rec-active">{t('common.active')}</Label>
              <Switch id="rec-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={busy || !validInterval || (Boolean(schedule) && !name.trim())}>
            {busy && <Spinner />} {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
