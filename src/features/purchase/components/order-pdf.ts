import { formatDate, formatNumber, formatQuantity } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import type { OrderPrintData } from '../api/purchase-api';
import { lineName } from '../lib';

export type T = (key: string, opts?: Record<string, unknown>) => string;

const hexToRgb = (hex?: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [23, 23, 23];
};

/** Render the purchase order as an A4 PDF (same layout for print, download and email). */
export async function buildOrderPdf({ order, company, supplierAddress, template }: OrderPrintData, t: T) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  // The PDF's built-in font has Latin glyphs only: format in English with the currency code (no ৳ sign).
  const { amountDecimals, currency } = useSettingsStore.getState();
  const formatCurrency = (v: string | null | undefined) =>
    formatNumber(v, { locale: 'en', decimals: amountDecimals });
  const qty = (v: string) => formatQuantity(v, { locale: 'en' });
  const day = (v: string) => formatDate(v, { locale: 'en' });
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hexToRgb(template.options.accentColor as string | undefined);
  const width = doc.internal.pageSize.getWidth();
  const left = 14;
  const right = width - 14;

  doc.setFontSize(15).setFont('helvetica', 'bold').text(company.name, left, 18);
  doc.setFontSize(8.5).setFont('helvetica', 'normal');
  const companyLines = [
    company.address,
    company.phone,
    company.email,
    company.binNo && `BIN: ${company.binNo}`,
  ].filter(Boolean) as string[];
  companyLines.forEach((line, i) => doc.text(line, left, 23 + i * 4));

  doc
    .setFontSize(16)
    .setFont('helvetica', 'bold')
    .setTextColor(...accent);
  doc.text(String(template.options.title || t('purchase.pdf.title')).toUpperCase(), right, 18, {
    align: 'right',
  });
  doc.setTextColor(0).setFontSize(9).setFont('helvetica', 'normal');
  const meta: [string, string][] = [
    [t('purchase.pdf.number'), order.number],
    [t('purchase.pdf.date'), day(order.orderDate)],
    ...(order.expectedDate
      ? ([[t('purchase.pdf.expected'), day(order.expectedDate)]] as [string, string][])
      : []),
    [t('purchase.pdf.terms'), t('purchase.pdf.termsDays', { days: order.paymentTermsDays })],
  ];
  meta.forEach(([k, v], i) => {
    doc.text(`${k}:`, right - 45, 25 + i * 4.5);
    doc.text(v, right, 25 + i * 4.5, { align: 'right' });
  });

  const blockY = Math.max(25 + meta.length * 4.5, 23 + companyLines.length * 4) + 6;
  doc.setFont('helvetica', 'bold').text(t('purchase.pdf.supplier'), left, blockY);
  doc.text(t('purchase.pdf.deliverTo'), width / 2 + 4, blockY);
  doc.setFont('helvetica', 'normal');
  const supplierLines = [
    order.supplier.name,
    supplierAddress,
    order.supplier.phone,
    order.supplier.email,
  ].filter(Boolean) as string[];
  supplierLines.forEach((line, i) =>
    doc.text(doc.splitTextToSize(line, width / 2 - 20)[0], left, blockY + 5 + i * 4),
  );
  [order.warehouse.name, company.name].forEach((line, i) =>
    doc.text(line, width / 2 + 4, blockY + 5 + i * 4),
  );

  autoTable(doc, {
    startY: blockY + 6 + Math.max(supplierLines.length, 2) * 4,
    head: [
      [
        '#',
        t('purchase.pdf.item'),
        t('purchase.pdf.qty'),
        t('purchase.pdf.price'),
        t('purchase.pdf.disc'),
        t('purchase.pdf.tax'),
        `${t('purchase.pdf.amount')} (${currency})`,
      ],
    ],
    body: (order.items ?? []).map((l, i) => [
      String(i + 1),
      `${lineName(l)}\n${l.variant?.sku ?? l.product.sku}`,
      `${qty(l.quantity)} ${l.unit?.code ?? l.product.baseUnit?.code ?? ''}`,
      formatCurrency(l.unitPrice),
      Number(l.discountPercent) ? `${Number(l.discountPercent)}%` : '—',
      Number(l.taxAmount) ? formatCurrency(l.taxAmount) : '—',
      formatCurrency(l.lineTotal),
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: accent },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable adds lastAutoTable at runtime
  let y = ((doc as any).lastAutoTable?.finalY ?? 120) + 6;
  const totals: [string, string][] = [
    [t('purchase.subtotal'), formatCurrency(order.subtotal)],
    ...(Number(order.discountTotal)
      ? ([[t('purchase.discount'), `-${formatCurrency(order.discountTotal)}`]] as [string, string][])
      : []),
    [t('purchase.tax'), formatCurrency(order.taxTotal)],
  ];
  totals.forEach(([k, v]) => {
    doc.text(k, right - 60, y);
    doc.text(v, right, y, { align: 'right' });
    y += 5;
  });
  doc.setFont('helvetica', 'bold').setFontSize(10.5);
  doc.text(`${t('purchase.total')} (${currency})`, right - 60, y + 1);
  doc.text(formatCurrency(order.total), right, y + 1, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  y += 10;

  for (const [title, text] of [
    [t('purchase.pdf.notes'), order.notes],
    [t('purchase.pdf.termsTitle'), order.terms ?? template.terms],
  ] as [string, string | null][]) {
    if (!text) continue;
    doc.setFont('helvetica', 'bold').text(title, left, y);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(text, right - left);
    doc.text(wrapped, left, y + 4.5);
    y += 6 + wrapped.length * 4;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const signY = Math.min(Math.max(y + 18, pageHeight - 40), pageHeight - 20);
  doc.line(right - 60, signY, right, signY);
  doc.text(t('purchase.pdf.authorised'), right - 30, signY + 4.5, { align: 'center' });
  if (template.footerNote)
    doc.setFontSize(7.5).text(template.footerNote, width / 2, pageHeight - 8, { align: 'center' });
  return doc.output('blob');
}
