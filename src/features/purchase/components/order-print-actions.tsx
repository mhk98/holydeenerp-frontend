import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Mail, Printer } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { fetchOrderPrint, ordersApi } from '../api/purchase-api';
import { buildOrderPdf, type T } from './order-pdf';

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Print / Download PDF / Email buttons for a purchase order. */
export function OrderPrintActions({
  orderId,
  number,
  supplierEmail,
  canEmail,
}: {
  orderId: string;
  number: string;
  supplierEmail?: string | null;
  canEmail: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  // Supplier documents are in English (the PDF font has no Bangla glyphs).
  const render = async () =>
    buildOrderPdf(await fetchOrderPrint(orderId), i18n.getFixedT('en') as unknown as T);

  const run = async (kind: 'print' | 'pdf') => {
    setBusy(kind);
    try {
      const blob = await render();
      const url = URL.createObjectURL(blob);
      if (kind === 'print') {
        // The browser's PDF viewer prints exactly what the supplier receives.
        const win = window.open(url, '_blank');
        if (!win) toast.error(t('purchase.pdf.popupBlocked'));
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${number}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => run('print')} disabled={Boolean(busy)}>
        {busy === 'print' ? <Spinner /> : <Printer aria-hidden />} {t('purchase.actions.print')}
      </Button>
      <Button type="button" variant="outline" onClick={() => run('pdf')} disabled={Boolean(busy)}>
        {busy === 'pdf' ? <Spinner /> : <Download aria-hidden />} PDF
      </Button>
      {canEmail && (
        <Button type="button" variant="outline" onClick={() => setEmailOpen(true)}>
          <Mail aria-hidden /> {t('purchase.actions.email')}
        </Button>
      )}
      {emailOpen && (
        <EmailOrderDialog
          orderId={orderId}
          number={number}
          defaultTo={supplierEmail ?? ''}
          render={render}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </>
  );
}

function EmailOrderDialog({
  orderId,
  number,
  defaultTo,
  render,
  onClose,
}: {
  orderId: string;
  number: string;
  defaultTo: string;
  render: () => Promise<Blob>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const action = ordersApi.useAction();
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(t('purchase.email.subject', { number }));
  const [message, setMessage] = useState(t('purchase.email.body', { number }));
  const [sending, setSending] = useState(false);
  const split = (s: string) =>
    s
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  const send = async () => {
    setSending(true);
    try {
      const pdfBase64 = await blobToBase64(await render());
      await action.mutateAsync({
        id: orderId,
        action: 'email',
        body: { to: split(to), cc: split(cc), subject, message, pdfBase64, filename: `${number}.pdf` },
      });
      toast.success(t('purchase.email.sent', { to }));
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('purchase.email.title', { number })}</DialogTitle>
          <DialogDescription>{t('purchase.email.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-to">{t('purchase.email.to')}</Label>
            <Input
              id="po-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="supplier@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-cc">{t('purchase.email.cc')}</Label>
            <Input id="po-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-subject">{t('purchase.email.subjectLabel')}</Label>
            <Input id="po-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-message">{t('purchase.email.message')}</Label>
            <Textarea id="po-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('purchase.email.attachment', { file: `${number}.pdf` })}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={send} disabled={sending || !split(to).length || !subject.trim()}>
            {sending ? <Spinner /> : <Mail aria-hidden />} {t('purchase.email.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
