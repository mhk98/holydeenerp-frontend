import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BellRing, Download, Eye, Mail, Printer } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { fetchInvoicePrint, invoicesApi } from '../api/sales-api';
import { InvoiceDocument, type DocumentLanguage } from './invoice-document';
import { buildInvoicePdf } from './invoice-pdf';

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const split = (s: string) =>
  s
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function LanguageSelect({
  value,
  onChange,
}: {
  value: DocumentLanguage;
  onChange: (v: DocumentLanguage) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DocumentLanguage)}>
      <SelectTrigger className="w-32" aria-label={t('sales.doc.language')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="bn">বাংলা</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Preview / Print / PDF / Email / Remind for a posted invoice. */
export function InvoiceActions({
  invoiceId,
  number,
  customerEmail,
  canEmail,
  canRemind,
}: {
  invoiceId: string;
  number: string;
  customerEmail?: string | null;
  canEmail: boolean;
  canRemind: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState<DocumentLanguage>(i18n.language === 'bn' ? 'bn' : 'en');
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const [dialog, setDialog] = useState<'preview' | 'email' | 'remind' | null>(null);
  const render = async (language = lang) => buildInvoicePdf(await fetchInvoicePrint(invoiceId), language);

  const run = async (kind: 'print' | 'pdf') => {
    setBusy(kind);
    try {
      const url = URL.createObjectURL(await render());
      if (kind === 'print') {
        if (!window.open(url, '_blank')) toast.error(t('purchase.pdf.popupBlocked'));
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
      <LanguageSelect value={lang} onChange={setLang} />
      <Button type="button" variant="outline" onClick={() => setDialog('preview')}>
        <Eye aria-hidden /> {t('sales.actions.preview')}
      </Button>
      <Button type="button" variant="outline" onClick={() => run('print')} disabled={Boolean(busy)}>
        {busy === 'print' ? <Spinner /> : <Printer aria-hidden />} {t('purchase.actions.print')}
      </Button>
      <Button type="button" variant="outline" onClick={() => run('pdf')} disabled={Boolean(busy)}>
        {busy === 'pdf' ? <Spinner /> : <Download aria-hidden />} PDF
      </Button>
      {canEmail && (
        <Button type="button" variant="outline" onClick={() => setDialog('email')}>
          <Mail aria-hidden /> {t('purchase.actions.email')}
        </Button>
      )}
      {canRemind && (
        <Button type="button" variant="outline" onClick={() => setDialog('remind')}>
          <BellRing aria-hidden /> {t('sales.actions.remind')}
        </Button>
      )}
      {dialog === 'preview' && (
        <PreviewDialog
          invoiceId={invoiceId}
          number={number}
          lang={lang}
          setLang={setLang}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'email' && (
        <EmailInvoiceDialog
          invoiceId={invoiceId}
          number={number}
          defaultTo={customerEmail ?? ''}
          lang={lang}
          setLang={setLang}
          render={render}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'remind' && (
        <RemindDialog invoiceId={invoiceId} defaultTo={customerEmail ?? ''} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function PreviewDialog({
  invoiceId,
  number,
  lang,
  setLang,
  onClose,
}: {
  invoiceId: string;
  number: string;
  lang: DocumentLanguage;
  setLang: (l: DocumentLanguage) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const data = useQuery({
    queryKey: ['sales', 'invoice-print', invoiceId],
    queryFn: () => fetchInvoicePrint(invoiceId),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-[860px]">
        <DialogHeader className="flex-row items-center justify-between gap-4 pr-8">
          <div>
            <DialogTitle>{number}</DialogTitle>
            <DialogDescription>{t('sales.doc.previewHint')}</DialogDescription>
          </div>
          <LanguageSelect value={lang} onChange={setLang} />
        </DialogHeader>
        <div className="-mx-6 max-h-[70vh] overflow-auto bg-muted px-6 py-4">
          {data.data ? (
            <div className="mx-auto w-fit shadow-sm">
              <InvoiceDocument data={data.data} t={i18n.getFixedT(lang)} lang={lang} />
            </div>
          ) : data.isError ? (
            <p className="text-sm text-destructive">{data.error.message}</p>
          ) : (
            <Skeleton className="mx-auto h-[600px] w-full max-w-[794px]" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailInvoiceDialog({
  invoiceId,
  number,
  defaultTo,
  lang,
  setLang,
  render,
  onClose,
}: {
  invoiceId: string;
  number: string;
  defaultTo: string;
  lang: DocumentLanguage;
  setLang: (l: DocumentLanguage) => void;
  render: (lang: DocumentLanguage) => Promise<Blob>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const action = invoicesApi.useAction();
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(t('sales.email.subject', { number }));
  const [message, setMessage] = useState(t('sales.email.body', { number }));
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const pdfBase64 = await blobToBase64(await render(lang));
      await action.mutateAsync({
        id: invoiceId,
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
          <DialogTitle>{t('sales.email.title', { number })}</DialogTitle>
          <DialogDescription>{t('sales.email.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-to">{t('purchase.email.to')}</Label>
            <Input
              id="inv-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-cc">{t('purchase.email.cc')}</Label>
            <Input id="inv-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-subject">{t('purchase.email.subjectLabel')}</Label>
            <Input id="inv-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-message">{t('purchase.email.message')}</Label>
            <Textarea
              id="inv-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {t('purchase.email.attachment', { file: `${number}.pdf` })}
            </p>
            <LanguageSelect value={lang} onChange={setLang} />
          </div>
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

function RemindDialog({
  invoiceId,
  defaultTo,
  onClose,
}: {
  invoiceId: string;
  defaultTo: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const action = invoicesApi.useAction();
  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState('');
  const send = () =>
    action.mutate(
      {
        id: invoiceId,
        action: 'remind',
        body: {
          ...(split(to).length && { to: split(to) }),
          ...(message.trim() && { message: message.trim() }),
        },
      },
      {
        onSuccess: () => {
          toast.success(t('sales.remind.sent'));
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && !action.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('sales.remind.title')}</DialogTitle>
          <DialogDescription>{t('sales.remind.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rem-to">{t('purchase.email.to')}</Label>
            <Input
              id="rem-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rem-message">{t('sales.remind.message')}</Label>
            <Textarea
              id="rem-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('sales.remind.messagePlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={action.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={send} disabled={action.isPending}>
            {action.isPending ? <Spinner /> : <BellRing aria-hidden />} {t('sales.remind.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
