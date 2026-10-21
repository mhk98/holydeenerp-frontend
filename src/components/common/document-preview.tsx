import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { assetUrl } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PaperSize, PrintTemplateOptions } from '@/types';

export interface PreviewCompany {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  binNo?: string | null;
  vatRegNo?: string | null;
  logoUrl?: string | null;
}

export interface PreviewLine {
  name: string;
  qty: string;
  unit: string;
  price: string;
  amount: string;
}

export interface PreviewDocument {
  number: string;
  date: string;
  customer?: { name: string; address?: string; phone?: string; bin?: string } | null;
  lines: PreviewLine[];
  subtotal: string;
  taxes: { name: string; amount: string }[];
  total: string;
  amountInWords?: string;
}

/** Sample data used by the template editor (amounts are fixed strings — no client-side maths). */
const SAMPLE_DOCUMENT: PreviewDocument = {
  number: 'INV-HO-2026-00042',
  date: new Date().toISOString(),
  customer: {
    name: 'Karim Traders',
    address: 'Shop 14, Kawran Bazar, Dhaka 1215',
    phone: '+8801711-445566',
    bin: '001234567-0201',
  },
  lines: [
    { name: 'Miniket Rice 25 kg', qty: '4', unit: 'bag', price: '1850.00', amount: '7400.00' },
    { name: 'Soybean Oil 5 L', qty: '6', unit: 'btl', price: '845.00', amount: '5070.00' },
    { name: 'Red Lentil (Masoor) 1 kg', qty: '10', unit: 'kg', price: '115.00', amount: '1150.00' },
  ],
  subtotal: '13620.00',
  taxes: [{ name: 'VAT 15%', amount: '2043.00' }],
  total: '15663.00',
  amountInWords: 'Taka Fifteen Thousand Six Hundred Sixty-Three Only',
};

/** Decorative barcode bars (real barcodes come from the Products module). */
function FakeBarcode({ value }: { value: string }) {
  const bars = [...value].flatMap((ch, i) => [((ch.charCodeAt(0) + i) % 3) + 1, (i % 2) + 1]);
  let x = 0;
  return (
    <svg viewBox={`0 0 ${bars.reduce((s, b) => s + b + 1, 0)} 30`} className="mx-auto h-8 w-40" aria-hidden>
      {bars.map((w, i) => {
        const rect =
          i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={30} fill="currentColor" /> : null;
        x += w + 1;
        return rect;
      })}
    </svg>
  );
}

const SIZE = { sm: 'text-[11px]', md: 'text-xs', lg: 'text-sm' } as const;

/**
 * Renders a sales document the way it will print. A4 = full invoice; thermal_80 = 80 mm receipt.
 * Wrap with `.print-area` to print only the document.
 */
export function DocumentPreview({
  paper,
  options,
  company,
  document = SAMPLE_DOCUMENT,
  terms,
  footerNote,
  className,
}: {
  paper: PaperSize;
  options: PrintTemplateOptions;
  company: PreviewCompany;
  document?: PreviewDocument;
  terms?: string | null;
  footerNote?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const accent = options.accentColor;

  if (paper === 'thermal_80') {
    return (
      <div
        className={cn(
          'mx-auto w-[302px] bg-white p-4 font-mono text-black shadow-sm',
          SIZE[options.fontSize],
          className,
        )}
      >
        <div className="text-center">
          {options.showLogo && company.logoUrl && (
            <img
              src={assetUrl(company.logoUrl)}
              alt=""
              className="mx-auto mb-1 h-10 object-contain grayscale"
            />
          )}
          <p className="text-sm font-bold">{company.name}</p>
          {options.showCompanyAddress && company.address && <p>{company.address}</p>}
          {company.phone && <p>{company.phone}</p>}
          {options.showBin && company.binNo && <p>BIN: {company.binNo}</p>}
          {options.headerText && <p className="mt-1">{options.headerText}</p>}
          <p className="mt-2 font-bold uppercase">{options.title}</p>
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <p>
          {document.number}
          <br />
          {formatDate(document.date)}
        </p>
        <div className="my-2 border-t border-dashed border-black" />
        {document.lines.map((l) => (
          <div key={l.name} className="mb-1">
            <p>{l.name}</p>
            <p className="flex justify-between">
              <span>
                {l.qty} × {formatCurrency(l.price, { decimals: 2 })}
              </span>
              <span>{formatCurrency(l.amount)}</span>
            </p>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="flex justify-between">
          <span>{t('print.subtotal')}</span>
          <span>{formatCurrency(document.subtotal)}</span>
        </p>
        {options.showTaxBreakdown &&
          document.taxes.map((tax) => (
            <p key={tax.name} className="flex justify-between">
              <span>{tax.name}</span>
              <span>{formatCurrency(tax.amount)}</span>
            </p>
          ))}
        <p className="mt-1 flex justify-between text-sm font-bold">
          <span>{t('print.total')}</span>
          <span>{formatCurrency(document.total)}</span>
        </p>
        <div className="my-2 border-t border-dashed border-black" />
        {terms && <p className="whitespace-pre-line">{terms}</p>}
        {options.showBarcode && (
          <div className="mt-2 text-center">
            <FakeBarcode value={document.number} />
            <p>{document.number}</p>
          </div>
        )}
        {footerNote && <p className="mt-2 text-center">{footerNote}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto aspect-[210/297] w-full max-w-[794px] bg-white p-[6%] text-zinc-900 shadow-sm',
        SIZE[options.fontSize],
        className,
      )}
      style={{ '--accent': accent } as CSSProperties}
    >
      <header
        className="flex items-start justify-between gap-6 border-b-2 pb-4"
        style={{ borderColor: accent }}
      >
        <div className="flex items-start gap-3">
          {options.showLogo && company.logoUrl && (
            <img src={assetUrl(company.logoUrl)} alt="" className="h-14 w-auto object-contain" />
          )}
          <div>
            <p className="text-lg font-bold" style={{ color: accent }}>
              {company.name}
            </p>
            {options.showCompanyAddress && company.address && (
              <p className="max-w-64 text-zinc-600">{company.address}</p>
            )}
            <p className="text-zinc-600">{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
            {options.showBin && company.binNo && <p className="text-zinc-600">BIN: {company.binNo}</p>}
            {options.showVatRegNo && company.vatRegNo && (
              <p className="text-zinc-600">VAT Reg: {company.vatRegNo}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-wide uppercase" style={{ color: accent }}>
            {options.title}
          </p>
          {options.showMushakRef && <p className="text-zinc-500">{t('print.mushak')}</p>}
          <p className="mt-2 font-medium">{document.number}</p>
          <p className="text-zinc-600">{formatDate(document.date)}</p>
        </div>
      </header>
      {options.headerText && <p className="mt-3 text-zinc-600">{options.headerText}</p>}

      {options.showCustomerDetails && document.customer && (
        <section className="mt-4">
          <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {t('print.billTo')}
          </p>
          <p className="font-semibold">{document.customer.name}</p>
          {document.customer.address && <p className="text-zinc-600">{document.customer.address}</p>}
          {document.customer.phone && <p className="text-zinc-600">{document.customer.phone}</p>}
          {document.customer.bin && <p className="text-zinc-600">BIN: {document.customer.bin}</p>}
        </section>
      )}

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="text-left text-white" style={{ backgroundColor: accent }}>
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">{t('print.item')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('print.qty')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('print.price')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('print.amount')}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {document.lines.map((l, i) => (
            <tr key={l.name} className="border-b border-zinc-200">
              <td className="px-2 py-1.5">{i + 1}</td>
              <td className="px-2 py-1.5">{l.name}</td>
              <td className="px-2 py-1.5 text-right">
                {l.qty} {l.unit}
              </td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(l.price)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64 space-y-1 tabular-nums">
        <p className="flex justify-between">
          <span className="text-zinc-600">{t('print.subtotal')}</span>
          <span>{formatCurrency(document.subtotal)}</span>
        </p>
        {options.showTaxBreakdown &&
          document.taxes.map((tax) => (
            <p key={tax.name} className="flex justify-between">
              <span className="text-zinc-600">{tax.name}</span>
              <span>{formatCurrency(tax.amount)}</span>
            </p>
          ))}
        <p className="flex justify-between border-t-2 pt-1 text-sm font-bold" style={{ borderColor: accent }}>
          <span>{t('print.total')}</span>
          <span>{formatCurrency(document.total)}</span>
        </p>
      </div>
      {options.showAmountInWords && document.amountInWords && (
        <p className="mt-3 text-zinc-600">
          <span className="font-medium text-zinc-900">{t('print.inWords')}:</span> {document.amountInWords}
        </p>
      )}

      {terms && (
        <section className="mt-6">
          <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            {t('print.terms')}
          </p>
          <p className="whitespace-pre-line text-zinc-600">{terms}</p>
        </section>
      )}

      {options.showSignature && (
        <div className="mt-12 flex justify-between gap-8 text-center text-zinc-600">
          <p className="w-40 border-t border-zinc-400 pt-1">{t('print.customerSignature')}</p>
          <p className="w-40 border-t border-zinc-400 pt-1">{t('print.authorizedSignature')}</p>
        </div>
      )}
      {footerNote && <p className="mt-8 text-center text-zinc-500">{footerNote}</p>}
    </div>
  );
}
