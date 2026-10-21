import type { TFunction } from 'i18next';
import { assetUrl } from '@/lib/api';
import { formatCurrency, formatDate, formatNumber, formatQuantity } from '@/lib/format';
import type { InvoicePrintData } from '../api/sales-api';
import { lineName } from '../lib';

export type DocumentLanguage = 'en' | 'bn';

/**
 * The invoice as printed / sent: A4 (794 px wide at 96 dpi), company branding from the print
 * template, QR code, amount in words. Rendered by the browser, so Bangla text works in the PDF.
 */
export function InvoiceDocument({
  data,
  t,
  lang,
}: {
  data: InvoicePrintData;
  t: TFunction;
  lang: DocumentLanguage;
}) {
  const { invoice: inv, company, template } = data;
  const o = template.options;
  const accent = o.accentColor || '#171717';
  const money = (v: string | null | undefined) => formatCurrency(v, { locale: lang });
  const num = (v: string | null | undefined) => formatNumber(v, { locale: lang });
  const qty = (v: string | null | undefined) => formatQuantity(v, { locale: lang });
  const day = (v: string | null | undefined) => formatDate(v, { locale: lang });
  const items = inv.items ?? [];
  const showDiscount = items.some((l) => Number(l.discountAmount) > 0 || Number(l.documentDiscount) > 0);
  const words = data.amountInWords[lang];
  const show = (key: string) => o[key] !== false;

  return (
    <div
      className="w-[794px] bg-white px-12 py-10 text-[12px] leading-snug text-zinc-900"
      style={{
        fontFamily: "'Geist Variable', 'Hind Siliguri', 'Noto Sans Bengali', 'Kohinoor Bangla', sans-serif",
      }}
      lang={lang}
    >
      <header
        className="flex items-start justify-between gap-6 border-b-2 pb-4"
        style={{ borderColor: accent }}
      >
        <div className="flex items-start gap-3">
          {show('showLogo') && company.logoUrl && (
            <img
              src={assetUrl(company.logoUrl)}
              alt=""
              crossOrigin="anonymous"
              className="h-14 w-auto object-contain"
            />
          )}
          <div>
            <p className="text-lg font-bold" style={{ color: accent }}>
              {company.name}
            </p>
            {show('showCompanyAddress') && company.address && (
              <p className="max-w-72 text-zinc-600">{company.address}</p>
            )}
            <p className="text-zinc-600">
              {[company.phone, company.email, company.website].filter(Boolean).join(' · ')}
            </p>
            {show('showBin') && company.binNo && (
              <p className="text-zinc-600">
                {t('sales.doc.bin')}: {company.binNo}
              </p>
            )}
            {o.showVatRegNo === true && company.vatRegNo && (
              <p className="text-zinc-600">
                {t('sales.doc.vatReg')}: {company.vatRegNo}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-wide uppercase" style={{ color: accent }}>
            {lang === 'en' && o.title ? o.title : t('sales.doc.invoice')}
          </p>
          {o.showMushakRef === true && <p className="text-zinc-500">{t('print.mushak')}</p>}
          <table className="mt-2 ml-auto text-right">
            <tbody>
              <Meta label={t('sales.doc.number')} value={inv.number} strong />
              <Meta label={t('sales.doc.date')} value={day(inv.invoiceDate)} />
              <Meta label={t('sales.doc.due')} value={day(inv.dueDate)} />
              {inv.customerReference && (
                <Meta label={t('sales.doc.reference')} value={inv.customerReference} />
              )}
              {inv.order && <Meta label={t('sales.doc.order')} value={inv.order.number} />}
              {inv.challan && <Meta label={t('sales.doc.challan')} value={inv.challan.number} />}
            </tbody>
          </table>
        </div>
      </header>
      {Boolean(o.headerText) && <p className="mt-3 text-zinc-600">{String(o.headerText)}</p>}

      <section className="mt-4 flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {t('print.billTo')}
          </p>
          <p className="text-sm font-semibold">{inv.customer.name}</p>
          <p className="text-zinc-600">{inv.customer.code}</p>
          {data.customerAddress && <p className="max-w-80 text-zinc-600">{data.customerAddress}</p>}
          {inv.customer.phone && <p className="text-zinc-600">{inv.customer.phone}</p>}
          {inv.customer.binNo && (
            <p className="text-zinc-600">
              {t('sales.doc.bin')}: {inv.customer.binNo}
            </p>
          )}
        </div>
        {data.qrCode && (
          <div className="text-center">
            <img src={data.qrCode} alt="" className="size-24" />
            <p className="text-[9px] text-zinc-500">{t('sales.doc.scan')}</p>
          </div>
        )}
      </section>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="text-left text-white" style={{ backgroundColor: accent }}>
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">{t('print.item')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('print.qty')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('print.price')}</th>
            {showDiscount && (
              <th className="px-2 py-1.5 text-right font-medium">{t('sales.doc.discount')}</th>
            )}
            <th className="px-2 py-1.5 text-right font-medium">{t('sales.doc.vat')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('print.amount')}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {items.map((l, i) => (
            <tr key={l.id} className="border-b border-zinc-200 align-top">
              <td className="px-2 py-1.5">{num(String(i + 1))}</td>
              <td className="px-2 py-1.5">
                <div>{lineName(l)}</div>
                <div className="text-[10px] text-zinc-500">
                  {l.variant?.sku ?? l.product.sku}
                  {l.batch?.batchNo && ` · ${t('sales.doc.batch')} ${l.batch.batchNo}`}
                  {l.serialNumbers?.length
                    ? ` · ${t('sales.doc.serials')} ${l.serialNumbers.join(', ')}`
                    : ''}
                </div>
              </td>
              <td className="px-2 py-1.5 text-right whitespace-nowrap">
                {qty(l.quantity)} {l.unit?.code ?? l.product.baseUnit?.code}
              </td>
              <td className="px-2 py-1.5 text-right">{money(l.unitPrice)}</td>
              {showDiscount && (
                <td className="px-2 py-1.5 text-right">
                  {Number(l.discountAmount) > 0 ? money(l.discountAmount) : '—'}
                </td>
              )}
              <td className="px-2 py-1.5 text-right">{Number(l.taxAmount) > 0 ? money(l.taxAmount) : '—'}</td>
              <td className="px-2 py-1.5 text-right">{money(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-8">
        <div className="flex-1">
          {show('showAmountInWords') && (
            <p className="mt-1">
              <span className="font-semibold">{t('print.inWords')}: </span>
              {words}
            </p>
          )}
          {inv.notes && <p className="mt-2 whitespace-pre-line text-zinc-600">{inv.notes}</p>}
        </div>
        <table className="w-64 tabular-nums">
          <tbody>
            <Total label={t('print.subtotal')} value={money(inv.subtotal)} />
            {Number(inv.discountTotal) > 0 && (
              <Total label={t('sales.doc.discount')} value={`− ${money(inv.discountTotal)}`} />
            )}
            {Number(inv.taxTotal) > 0 && <Total label={t('sales.doc.vat')} value={money(inv.taxTotal)} />}
            {Number(inv.roundOff) !== 0 && <Total label={t('sales.roundOff')} value={money(inv.roundOff)} />}
            <tr className="border-t-2 text-sm font-bold" style={{ borderColor: accent }}>
              <td className="pt-1.5">{t('print.total')}</td>
              <td className="pt-1.5 text-right">{money(inv.total)}</td>
            </tr>
            {Number(inv.paidAmount) > 0 && (
              <>
                <Total label={t('sales.doc.paid')} value={money(inv.paidAmount)} />
                <Total label={t('sales.doc.balance')} value={money(inv.balance)} strong />
              </>
            )}
          </tbody>
        </table>
      </div>

      {(inv.terms || template.terms) && (
        <section className="mt-6">
          <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {t('print.terms')}
          </p>
          <p className="whitespace-pre-line text-zinc-600">{inv.terms || template.terms}</p>
        </section>
      )}

      {show('showSignature') && (
        <div className="mt-16 grid grid-cols-2 gap-16 text-center text-zinc-600">
          <p className="border-t border-zinc-400 pt-1">{t('print.customerSignature')}</p>
          <p className="border-t border-zinc-400 pt-1">{t('print.authorizedSignature')}</p>
        </div>
      )}
      {template.footerNote && (
        <p className="mt-8 text-center text-[10px] text-zinc-500">{template.footerNote}</p>
      )}
    </div>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td className="pr-3 text-zinc-500">{label}</td>
      <td className={strong ? 'font-semibold' : undefined}>{value}</td>
    </tr>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? 'font-semibold' : undefined}>
      <td className="py-0.5 text-zinc-600">{label}</td>
      <td className="py-0.5 text-right">{value}</td>
    </tr>
  );
}
