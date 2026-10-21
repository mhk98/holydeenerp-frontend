import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import i18n from '@/lib/i18n';
import type { InvoicePrintData } from '../api/sales-api';
import { InvoiceDocument, type DocumentLanguage } from './invoice-document';

const waitForImages = (root: HTMLElement) =>
  Promise.all(
    [...root.querySelectorAll('img')].map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((done) => {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }),
    ),
  );

/**
 * Render the invoice off-screen and turn it into an A4 PDF (an image of the page, so Bangla and the
 * ৳ sign come out exactly as on screen). Long invoices continue on further pages.
 */
export async function buildInvoicePdf(data: InvoicePrintData, lang: DocumentLanguage) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<InvoiceDocument data={data} t={i18n.getFixedT(lang)} lang={lang} />));
    await waitForImages(host);
    await document.fonts.ready;
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pxPerMm = canvas.width / pageW;
    const pagePx = Math.floor(pageH * pxPerMm);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    for (let y = 0, page = 0; y < canvas.height; y += pagePx, page += 1) {
      const h = Math.min(pagePx, canvas.height - y);
      slice.height = h;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, h / pxPerMm);
    }
    pdf.setProperties({ title: data.invoice.number, subject: data.company.name });
    return pdf.output('blob');
  } finally {
    root.unmount();
    host.remove();
  }
}
