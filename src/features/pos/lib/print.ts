import Decimal from 'decimal.js';
import i18n from '@/lib/i18n';
import { assetUrl } from '@/lib/api';
import { formatCurrency, formatDateTime, formatNumber, formatQuantity } from '@/lib/format';
import type { PosSession, ReceiptData, SessionReport } from '../types';

/**
 * Printing for the POS: self-contained HTML in a hidden iframe, so the page size (80 mm roll or A4)
 * is set with @page and nothing of the app leaks into the print. Works offline.
 */

export type Paper = 'thermal_80' | 'a4';
type Lang = 'en' | 'bn';

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const FONT = `'Hind Siliguri', 'Noto Sans Bengali', 'Kohinoor Bangla', 'Segoe UI', Arial, sans-serif`;

const CSS: Record<Paper, string> = {
  thermal_80: `
    @page { size: 80mm auto; margin: 0; }
    body { width: 72mm; margin: 0 auto; padding: 3mm 0 6mm; font: 11.5px/1.35 ${FONT}; color: #000; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
    .hr { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 1px 0; }
    .big { font-size: 15px; } .small { font-size: 10px; } img.logo { max-height: 40px; filter: grayscale(1); }`,
  a4: `
    @page { size: A4; margin: 14mm; }
    body { margin: 0; font: 12px/1.45 ${FONT}; color: #111; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
    .hr { border-top: 1px solid #ccc; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    table.items th { background: #f3f3f3; text-align: left; padding: 6px; font-size: 11px; }
    table.items td { padding: 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    .big { font-size: 20px; } .small { font-size: 10.5px; color: #555; } img.logo { max-height: 56px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .totals { width: 280px; margin-left: auto; }`,
};

/** Print an HTML body on the given paper. Resolves once the print dialog has been shown. */
export function printHtml(body: string, paper: Paper, title = 'Receipt') {
  return new Promise<void>((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS[paper]}</style></head><body>${body}</body></html>`,
    );
    doc.close();
    const go = () => {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => {
        frame.remove();
        resolve();
      }, 1000);
    };
    const images = [...doc.images];
    if (!images.length) setTimeout(go, 50);
    else
      Promise.all(
        images.map((img) => (img.complete ? null : new Promise((done) => (img.onload = img.onerror = done)))),
      ).then(go);
  });
}

export function receiptHtml(
  data: ReceiptData,
  opts: { paper: Paper; lang: Lang; register?: string; cashier?: string; offline?: boolean; copy?: boolean },
) {
  const t = i18n.getFixedT(opts.lang);
  const money = (v: string | null | undefined) => esc(formatCurrency(v, { locale: opts.lang }));
  const num = (v: string | null | undefined) => esc(formatNumber(v, { locale: opts.lang }));
  const qty = (v: string | null | undefined) => esc(formatQuantity(v, { locale: opts.lang }));
  const inv = data.invoice;
  const items = inv.items ?? [];
  const number = inv.number || inv.offlineNumber || '';
  const thermal = opts.paper === 'thermal_80';
  const row = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td>${esc(label)}</td><td class="r">${value}</td></tr>`;

  const header = `
    ${data.company.logoUrl ? `<img class="logo" src="${esc(assetUrl(data.company.logoUrl))}" alt="">` : ''}
    <div class="b big">${esc(data.company.name)}</div>
    ${data.company.address ? `<div class="small">${esc(data.company.address)}</div>` : ''}
    ${data.company.phone ? `<div class="small">${esc(data.company.phone)}</div>` : ''}
    ${data.company.binNo ? `<div class="small">${esc(t('sales.doc.bin'))}: ${esc(data.company.binNo)}</div>` : ''}`;
  const meta = `
    <table class="small">
      ${row(t('pos.receipt.number'), esc(number))}
      ${inv.offlineNumber && inv.number && inv.offlineNumber !== inv.number ? row(t('pos.receipt.offlineNumber'), esc(inv.offlineNumber)) : ''}
      ${row(t('pos.receipt.date'), esc(formatDateTime(inv.postedAt ?? inv.createdAt ?? new Date().toISOString(), { locale: opts.lang })))}
      ${opts.register ? row(t('pos.receipt.register'), esc(opts.register)) : ''}
      ${opts.cashier ? row(t('pos.receipt.cashier'), esc(opts.cashier)) : ''}
      ${inv.customer && inv.customer.code ? row(t('sales.customer'), esc(inv.customer.name)) : ''}
    </table>`;
  const lineName = (l: (typeof items)[number]) =>
    l.variant ? `${l.product.name} — ${l.variant.name}` : l.product.name;
  const lines = thermal
    ? items
        .map(
          (l) => `
      <div>${esc(lineName(l))}</div>
      <table><tr>
        <td class="small">${qty(l.quantity)} ${esc(l.unit?.code ?? l.product.baseUnit?.code ?? '')} × ${money(l.unitPrice)}${
          Number(l.discountAmount) > 0 ? ` − ${money(l.discountAmount)}` : ''
        }</td>
        <td class="r">${money(l.lineTotal)}</td>
      </tr></table>
      ${l.serialNumbers?.length ? `<div class="small">S/N ${esc(l.serialNumbers.join(', '))}</div>` : ''}`,
        )
        .join('')
    : `<table class="items"><thead><tr><th>#</th><th>${esc(t('print.item'))}</th><th class="r">${esc(t('print.qty'))}</th><th class="r">${esc(t('print.price'))}</th><th class="r">${esc(t('sales.doc.discount'))}</th><th class="r">${esc(t('print.amount'))}</th></tr></thead><tbody>${items
        .map(
          (l, i) =>
            `<tr><td>${num(String(i + 1))}</td><td>${esc(lineName(l))}<div class="small">${esc(l.variant?.sku ?? l.product.sku)}</div></td><td class="r">${qty(l.quantity)} ${esc(l.unit?.code ?? l.product.baseUnit?.code ?? '')}</td><td class="r">${money(l.unitPrice)}</td><td class="r">${Number(l.discountAmount) > 0 ? money(l.discountAmount) : '—'}</td><td class="r">${money(l.lineTotal)}</td></tr>`,
        )
        .join('')}</tbody></table>`;
  const totals = `
    <table class="${thermal ? '' : 'totals'}">
      ${row(t('print.subtotal'), money(inv.subtotal))}
      ${Number(inv.discountTotal) > 0 ? row(t('sales.doc.discount'), `− ${money(inv.discountTotal)}`) : ''}
      ${Number(inv.taxTotal) > 0 ? row(t('sales.doc.vat'), money(inv.taxTotal)) : ''}
      ${Number(inv.roundOff) !== 0 ? row(t('sales.roundOff'), money(inv.roundOff)) : ''}
      ${row(t('print.total'), money(inv.total), 'b big')}
      ${data.payments.map((p) => row(`${p.method}${p.reference ? ` (${p.reference})` : ''}`, money(p.amount))).join('')}
      ${Number(inv.changeAmount) > 0 ? row(t('pos.receipt.change'), money(inv.changeAmount), 'b') : ''}
      ${new Decimal(inv.total).gt(data.paid) ? row(t('sales.doc.balance'), money(new Decimal(inv.total).minus(data.paid).toFixed(4)), 'b') : ''}
    </table>`;
  return `
    <div class="${thermal ? 'c' : 'head'}">
      <div>${header}</div>
      ${thermal ? '' : `<div class="r"><div class="b big">${esc(t('pos.receipt.title'))}</div>${meta}</div>`}
    </div>
    ${opts.copy ? `<div class="c b">${esc(t('pos.receipt.copy'))}</div>` : ''}
    ${opts.offline ? `<div class="c small">${esc(t('pos.receipt.offlineNote'))}</div>` : ''}
    <div class="hr"></div>
    ${thermal ? `${meta}<div class="hr"></div>` : ''}
    ${lines}
    <div class="hr"></div>
    ${totals}
    <div class="hr"></div>
    ${data.amountInWords[opts.lang] ? `<div class="small">${esc(t('print.inWords'))}: ${esc(data.amountInWords[opts.lang])}</div>` : ''}
    ${data.footer ? `<div class="hr"></div><div class="c">${esc(data.footer)}</div>` : ''}`;
}

/** X (running) or Z (closing) report on the register's paper. */
export function reportHtml(session: PosSession, report: SessionReport, opts: { paper: Paper; lang: Lang }) {
  const t = i18n.getFixedT(opts.lang);
  const money = (v: string | null | undefined) => esc(formatCurrency(v, { locale: opts.lang }));
  const row = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td>${esc(label)}</td><td class="r">${value}</td></tr>`;
  const z = session.status === 'closed';
  return `
    <div class="c b big">${esc(t(z ? 'pos.report.z' : 'pos.report.x'))}</div>
    <div class="c">${esc(session.register.name)} · ${esc(session.number)}</div>
    <div class="c small">${esc(formatDateTime(session.openedAt, { locale: opts.lang }))}${
      session.closedAt ? ` → ${esc(formatDateTime(session.closedAt, { locale: opts.lang }))}` : ''
    }</div>
    <div class="c small">${esc(session.opener?.name ?? '')}${session.closer ? ` / ${esc(session.closer.name)}` : ''}</div>
    <div class="hr"></div>
    <table>
      ${row(t('pos.report.salesCount'), esc(String(report.sales.count)))}
      ${row(t('pos.report.gross'), money(report.sales.gross))}
      ${row(t('pos.report.discounts'), `− ${money(report.sales.discounts)}`)}
      ${row(t('pos.report.tax'), money(report.sales.tax))}
      ${row(t('pos.report.netSales'), money(report.sales.total), 'b')}
      ${row(t('pos.report.returns', { count: report.returns.count }), `− ${money(report.returns.total)}`)}
      ${Number(report.sales.onAccount) > 0 ? row(t('pos.report.onAccount'), money(report.sales.onAccount)) : ''}
    </table>
    <div class="hr"></div>
    <div class="b">${esc(t('pos.report.payments'))}</div>
    <table>${report.payments
      .map(
        (p) =>
          row(p.name, money(p.received)) +
          (Number(p.refunded) > 0 ? row(`  ${t('pos.report.refunded')}`, `− ${money(p.refunded)}`) : ''),
      )
      .join('')}</table>
    <div class="hr"></div>
    <div class="b">${esc(t('pos.report.drawer'))}</div>
    <table>
      ${row(t('pos.report.opening'), money(report.cash.opening))}
      ${row(t('pos.report.cashSales'), money(report.cash.received))}
      ${row(t('pos.report.cashRefunds'), `− ${money(report.cash.refunded)}`)}
      ${row(t('pos.report.cashIn'), money(report.cash.cashIn))}
      ${row(t('pos.report.cashOut'), `− ${money(report.cash.cashOut)}`)}
      ${row(t('pos.report.expected'), money(report.cash.expected), 'b')}
      ${report.cash.counted != null ? row(t('pos.report.counted'), money(report.cash.counted), 'b') : ''}
      ${report.cash.variance != null ? row(t('pos.report.variance'), money(report.cash.variance), 'b') : ''}
    </table>
    ${
      session.denominations
        ? `<div class="hr"></div><table class="small">${Object.entries(session.denominations)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([d, c]) =>
              row(
                `${formatNumber(d, { locale: opts.lang, decimals: 0 })} × ${c}`,
                money(String(Number(d) * c)),
              ),
            )
            .join('')}</table>`
        : ''
    }
    <div class="hr"></div>
    <div class="c small">${esc(formatDateTime(new Date().toISOString(), { locale: opts.lang }))}</div>`;
}
