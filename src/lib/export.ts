/**
 * Table export to CSV, Excel and PDF. Excel/PDF libraries are loaded on demand
 * so they never weigh down the main bundle.
 */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const stamp = () => new Date().toISOString().slice(0, 10);

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const cellText = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function toCsv<T>(rows: T[], columns: ExportColumn<T>[]) {
  const escape = (v: unknown) => {
    const s = cellText(v);
    // Quote when needed; neutralise spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map((c) => escape(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(','));
  // BOM so Excel opens UTF-8 (Bangla) correctly.
  return String.fromCharCode(0xfeff) + lines.join(String.fromCharCode(13, 10));
}

async function toXlsx<T>(rows: T[], columns: ExportColumn<T>[], title: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31) || 'Sheet1');
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: Math.max(12, c.header.length + 4),
  }));
  for (const row of rows)
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.header, c.value(row) ?? ''])));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function toPdf<T>(rows: T[], columns: ExportColumn<T>[], title: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cellText(c.value(row)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [23, 23, 23] },
  });
  return doc.output('blob');
}

export async function exportRows<T>(
  format: ExportFormat,
  rows: T[],
  columns: ExportColumn<T>[],
  { filename, title }: { filename: string; title: string },
) {
  const base = `${filename}-${stamp()}`;
  if (format === 'csv')
    return download(new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
  if (format === 'xlsx') return download(await toXlsx(rows, columns, title), `${base}.xlsx`);
  return download(await toPdf(rows, columns, title), `${base}.pdf`);
}
