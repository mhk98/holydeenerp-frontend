import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  REPORTS,
  useReport,
  type BalanceSheet,
  type CashFlow,
  type DayBook,
  type GeneralLedger,
  type ProfitLoss,
  type ReportName,
  type Section,
  type TrialBalance,
  type VatReport,
} from '../api/reports-api';
import { AccountSelect } from '../components/account-select';
import { ReportShell, type ReportExport, type ReportFilters } from '../components/report-shell';
import { ACCOUNTING_ROUTES, accountName, rangeLabel } from '../lib';

const money = (v: string | number | null | undefined) => (v == null ? '' : formatCurrency(v));
const n = (v: string | number | null | undefined) => (v == null || v === '' ? null : Number(v));

/** "Dr" / "Cr" split of a signed (debit − credit) amount. */
const drCr = (signed: string) => {
  const v = Number(signed);
  return { dr: v > 0 ? v : 0, cr: v < 0 ? -v : 0 };
};

function Amount({ value, strong }: { value: string | number | null | undefined; strong?: boolean }) {
  const v = Number(value ?? 0);
  return (
    <TableCell
      className={cn('text-right tabular-nums', strong && 'font-semibold', v < 0 && 'text-destructive')}
    >
      {value == null ? '' : formatCurrency(v)}
    </TableCell>
  );
}

function Unbalanced({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <Alert variant="destructive" className="mb-4">
      <CircleAlert aria-hidden />
      <AlertDescription>
        {t('accounting.reports.unbalanced')}{' '}
        <Link to={ACCOUNTING_ROUTES.health} className="underline">
          {t('accounting.health.title')}
        </Link>
      </AlertDescription>
    </Alert>
  );
}

// ── Trial balance ─────────────────────────────────────────────────────────

function TrialBalanceView({ data }: { data: TrialBalance }) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  return (
    <>
      <Unbalanced show={!data.balanced} />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2}>{t('accounting.account')}</TableHead>
              <TableHead colSpan={2} className="text-center">
                {t('accounting.reports.opening')}
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                {t('accounting.reports.period')}
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                {t('accounting.reports.closing')}
              </TableHead>
            </TableRow>
            <TableRow>
              {[0, 1, 2].flatMap((i) => [
                <TableHead key={`d${i}`} className="text-right">
                  {t('accounting.debit')}
                </TableHead>,
                <TableHead key={`c${i}`} className="text-right">
                  {t('accounting.credit')}
                </TableHead>,
              ])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => {
              const o = drCr(r.opening);
              const c = drCr(r.closing);
              return (
                <TableRow key={r.accountId}>
                  <TableCell>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{r.code}</span>
                    {accountName(r, language)}
                  </TableCell>
                  <Amount value={o.dr || null} />
                  <Amount value={o.cr || null} />
                  <Amount value={Number(r.debit) || null} />
                  <Amount value={Number(r.credit) || null} />
                  <Amount value={c.dr || null} />
                  <Amount value={c.cr || null} />
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">{t('accounting.total')}</TableCell>
              <Amount value={data.totals.openingDebit} strong />
              <Amount value={data.totals.openingCredit} strong />
              <Amount value={data.totals.debit} strong />
              <Amount value={data.totals.credit} strong />
              <Amount value={data.totals.closingDebit} strong />
              <Amount value={data.totals.closingCredit} strong />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

const trialBalanceExport = (
  data: TrialBalance,
  t: (k: string) => string,
  lang: 'en' | 'bn',
): ReportExport => ({
  columns: [
    { header: t('fields.code'), value: (r) => r.code },
    { header: t('accounting.account'), value: (r) => r.account },
    { header: `${t('accounting.reports.opening')} ${t('accounting.debit')}`, value: (r) => r.od },
    { header: `${t('accounting.reports.opening')} ${t('accounting.credit')}`, value: (r) => r.oc },
    { header: t('accounting.debit'), value: (r) => r.debit },
    { header: t('accounting.credit'), value: (r) => r.credit },
    { header: `${t('accounting.reports.closing')} ${t('accounting.debit')}`, value: (r) => r.cd },
    { header: `${t('accounting.reports.closing')} ${t('accounting.credit')}`, value: (r) => r.cc },
  ],
  rows: [
    ...data.rows.map((r) => {
      const o = drCr(r.opening);
      const c = drCr(r.closing);
      return {
        code: r.code,
        account: accountName(r, lang),
        od: o.dr,
        oc: o.cr,
        debit: n(r.debit),
        credit: n(r.credit),
        cd: c.dr,
        cc: c.cr,
      };
    }),
    {
      code: null,
      account: t('accounting.total'),
      od: n(data.totals.openingDebit),
      oc: n(data.totals.openingCredit),
      debit: n(data.totals.debit),
      credit: n(data.totals.credit),
      cd: n(data.totals.closingDebit),
      cc: n(data.totals.closingCredit),
    },
  ],
});

// ── Sectioned statements (P&L, balance sheet) ─────────────────────────────

function SectionRows({ section, comparing, title }: { section: Section; comparing: boolean; title: string }) {
  const language = useSettingsStore((s) => s.language);
  const { t } = useTranslation();
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={comparing ? 4 : 2} className="font-medium">
          {title}
        </TableCell>
      </TableRow>
      {section.rows.map((r) => (
        <TableRow key={r.accountId ?? r.name}>
          <TableCell className="pl-6">
            {r.code && <span className="mr-2 font-mono text-xs text-muted-foreground">{r.code}</span>}
            {accountName(r, language)}
          </TableCell>
          <Amount value={r.amount} />
          {comparing && <Amount value={r.compare} />}
          {comparing && <Amount value={Number(r.amount) - Number(r.compare ?? 0)} />}
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="pl-6 font-medium">{t('accounting.reports.totalOf', { name: title })}</TableCell>
        <Amount value={section.total} strong />
        {comparing && <Amount value={section.compareTotal} strong />}
        {comparing && <Amount value={Number(section.total) - Number(section.compareTotal ?? 0)} strong />}
      </TableRow>
    </>
  );
}

function ResultRow({
  label,
  figure,
  comparing,
}: {
  label: string;
  figure: { amount: string; compare: string | null };
  comparing: boolean;
}) {
  return (
    <TableRow className="border-t-2">
      <TableCell className="font-semibold">{label}</TableCell>
      <Amount value={figure.amount} strong />
      {comparing && <Amount value={figure.compare} strong />}
      {comparing && <Amount value={Number(figure.amount) - Number(figure.compare ?? 0)} strong />}
    </TableRow>
  );
}

function StatementHead({ current, compare }: { current: string; compare: string | null }) {
  const { t } = useTranslation();
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t('accounting.account')}</TableHead>
        <TableHead className="text-right">{current}</TableHead>
        {compare && <TableHead className="text-right">{compare}</TableHead>}
        {compare && <TableHead className="text-right">{t('accounting.reports.change')}</TableHead>}
      </TableRow>
    </TableHeader>
  );
}

function ProfitLossView({ data }: { data: ProfitLoss }) {
  const { t } = useTranslation();
  const comparing = Boolean(data.compare);
  const s = Object.fromEntries(data.sections.map((x) => [x.key, x]));
  const title = (k: string) => t(`accounting.reports.sections.${k}`);
  return (
    <div className="overflow-x-auto">
      <Table>
        <StatementHead
          current={rangeLabel(t, data.from, data.to)}
          compare={data.compare ? rangeLabel(t, data.compare.from, data.compare.to) : null}
        />
        <TableBody>
          <SectionRows section={s.revenue} comparing={comparing} title={title('revenue')} />
          {s.salesReturns.rows.length > 0 && (
            <SectionRows section={s.salesReturns} comparing={comparing} title={title('salesReturns')} />
          )}
          <ResultRow label={title('netSales')} figure={data.netSales} comparing={comparing} />
          <SectionRows section={s.cogs} comparing={comparing} title={title('cogs')} />
          <ResultRow label={title('grossProfit')} figure={data.grossProfit} comparing={comparing} />
          <SectionRows section={s.expenses} comparing={comparing} title={title('expenses')} />
          <ResultRow label={title('operatingProfit')} figure={data.operatingProfit} comparing={comparing} />
          {s.otherIncome.rows.length > 0 && (
            <SectionRows section={s.otherIncome} comparing={comparing} title={title('otherIncome')} />
          )}
          {s.otherExpenses.rows.length > 0 && (
            <SectionRows section={s.otherExpenses} comparing={comparing} title={title('otherExpenses')} />
          )}
          <ResultRow label={title('netProfit')} figure={data.netProfit} comparing={comparing} />
        </TableBody>
      </Table>
    </div>
  );
}

function BalanceSheetView({ data }: { data: BalanceSheet }) {
  const { t } = useTranslation();
  const comparing = Boolean(data.compareAsOf);
  const s = Object.fromEntries(data.sections.map((x) => [x.key, x]));
  const title = (k: string) => t(`accounting.reports.sections.${k}`);
  return (
    <>
      <Unbalanced show={!data.balanced} />
      <div className="overflow-x-auto">
        <Table>
          <StatementHead
            current={rangeLabel(t, undefined, undefined, data.asOf)}
            compare={data.compareAsOf ? rangeLabel(t, undefined, undefined, data.compareAsOf) : null}
          />
          <TableBody>
            <SectionRows section={s.currentAssets} comparing={comparing} title={title('currentAssets')} />
            <SectionRows section={s.fixedAssets} comparing={comparing} title={title('fixedAssets')} />
            <ResultRow
              label={title('totalAssets')}
              figure={{ amount: data.totalAssets, compare: data.compareTotalAssets }}
              comparing={comparing}
            />
            <SectionRows
              section={s.currentLiabilities}
              comparing={comparing}
              title={title('currentLiabilities')}
            />
            <SectionRows
              section={s.longTermLiabilities}
              comparing={comparing}
              title={title('longTermLiabilities')}
            />
            <SectionRows section={s.equity} comparing={comparing} title={title('equity')} />
            <ResultRow
              label={title('totalLiabilitiesEquity')}
              figure={{ amount: data.totalLiabilitiesEquity, compare: data.compareTotalLiabilitiesEquity }}
              comparing={comparing}
            />
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/** Flatten a sectioned statement for export. */
function statementExport(
  sections: Section[],
  results: { after: string; label: string; figure: { amount: string; compare: string | null } }[],
  t: TFunction,
  lang: 'en' | 'bn',
  comparing: boolean,
): ReportExport {
  const rows: Record<string, string | number | null>[] = [];
  const title = (k: string) => t(`accounting.reports.sections.${k}`);
  for (const sec of sections) {
    rows.push({ code: null, account: title(sec.key), amount: null, compare: null });
    for (const r of sec.rows)
      rows.push({ code: r.code, account: accountName(r, lang), amount: n(r.amount), compare: n(r.compare) });
    rows.push({
      code: null,
      account: t('accounting.reports.totalOf', { name: title(sec.key) }),
      amount: n(sec.total),
      compare: n(sec.compareTotal),
    });
    for (const res of results.filter((x) => x.after === sec.key))
      rows.push({
        code: null,
        account: res.label,
        amount: n(res.figure.amount),
        compare: n(res.figure.compare),
      });
  }
  return {
    columns: [
      { header: t('fields.code'), value: (r) => r.code },
      { header: t('accounting.account'), value: (r) => r.account },
      { header: t('accounting.amount'), value: (r) => r.amount },
      ...(comparing
        ? [
            {
              header: t('accounting.reports.comparison'),
              value: (r: Record<string, string | number | null>) => r.compare,
            },
          ]
        : []),
    ],
    rows,
  };
}

// ── Cash flow ─────────────────────────────────────────────────────────────

function CashFlowView({ data }: { data: CashFlow }) {
  const { t } = useTranslation();
  const block = (key: 'operating' | 'investing' | 'financing') => (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={2} className="font-medium">
          {t(`accounting.reports.cashFlow.${key}`)}
        </TableCell>
      </TableRow>
      {data[key].rows.map((r) => (
        <TableRow key={r.key}>
          <TableCell className="pl-6">{t(`accounting.reports.cashFlow.lines.${r.key}`)}</TableCell>
          <Amount value={r.amount} />
        </TableRow>
      ))}
      <TableRow>
        <TableCell className="pl-6 font-medium">{t(`accounting.reports.cashFlow.net.${key}`)}</TableCell>
        <Amount value={data[key].total} strong />
      </TableRow>
    </>
  );
  return (
    <>
      <Unbalanced show={!data.balanced} />
      <Table>
        <TableBody>
          {block('operating')}
          {block('investing')}
          {block('financing')}
          <TableRow className="border-t-2">
            <TableCell className="font-semibold">{t('accounting.reports.cashFlow.netChange')}</TableCell>
            <Amount value={data.netChange} strong />
          </TableRow>
          <TableRow>
            <TableCell>{t('accounting.reports.cashFlow.opening')}</TableCell>
            <Amount value={data.openingCash} />
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">{t('accounting.reports.cashFlow.closing')}</TableCell>
            <Amount value={data.closingCash} strong />
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}

const cashFlowExport = (data: CashFlow, t: (k: string) => string): ReportExport => {
  const rows: Record<string, string | number | null>[] = [];
  for (const key of ['operating', 'investing', 'financing'] as const) {
    rows.push({ line: t(`accounting.reports.cashFlow.${key}`), amount: null });
    for (const r of data[key].rows)
      rows.push({ line: t(`accounting.reports.cashFlow.lines.${r.key}`), amount: n(r.amount) });
    rows.push({ line: t(`accounting.reports.cashFlow.net.${key}`), amount: n(data[key].total) });
  }
  rows.push({ line: t('accounting.reports.cashFlow.netChange'), amount: n(data.netChange) });
  rows.push({ line: t('accounting.reports.cashFlow.opening'), amount: n(data.openingCash) });
  rows.push({ line: t('accounting.reports.cashFlow.closing'), amount: n(data.closingCash) });
  return {
    columns: [
      { header: t('fields.description'), value: (r) => r.line },
      { header: t('accounting.amount'), value: (r) => r.amount },
    ],
    rows,
  };
};

// ── General ledger ────────────────────────────────────────────────────────

function GeneralLedgerView({ data }: { data: GeneralLedger }) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  return (
    <div className="flex flex-col gap-6">
      {data.accounts.map((a) => (
        <div key={a.accountId} className="overflow-x-auto">
          <h3 className="mb-2 font-medium">
            <span className="mr-2 font-mono text-sm text-muted-foreground">{a.code}</span>
            {accountName(a, language)}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounting.date')}</TableHead>
                <TableHead>{t('accounting.journals.number')}</TableHead>
                <TableHead>{t('accounting.journals.narration')}</TableHead>
                <TableHead className="text-right">{t('accounting.debit')}</TableHead>
                <TableHead className="text-right">{t('accounting.credit')}</TableHead>
                <TableHead className="text-right">{t('accounting.balance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={5} className="font-medium">
                  {t('accounting.reports.openingBalance')}
                </TableCell>
                <Amount value={a.opening} strong />
              </TableRow>
              {a.rows.map((r, i) => (
                <TableRow key={`${r.journalId}-${i}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell>
                    <Link
                      to={`${ACCOUNTING_ROUTES.journals}/${r.journalId}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {r.number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <div className="truncate">{r.narration ?? r.description ?? '—'}</div>
                    {(r.partyName || r.sourceNo) && (
                      <div className="truncate text-xs text-muted-foreground">
                        {[r.partyName, r.sourceNo].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </TableCell>
                  <Amount value={Number(r.debit) || null} />
                  <Amount value={Number(r.credit) || null} />
                  <Amount value={r.balance} />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  {t('accounting.reports.closingBalance')}
                </TableCell>
                <Amount value={a.debit} strong />
                <Amount value={a.credit} strong />
                <Amount value={a.closing} strong />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ))}
    </div>
  );
}

const generalLedgerExport = (
  data: GeneralLedger,
  t: (k: string) => string,
  lang: 'en' | 'bn',
): ReportExport => ({
  columns: [
    { header: t('accounting.account'), value: (r) => r.account },
    { header: t('accounting.date'), value: (r) => r.date },
    { header: t('accounting.journals.number'), value: (r) => r.number },
    { header: t('accounting.journals.narration'), value: (r) => r.narration },
    { header: t('accounting.debit'), value: (r) => r.debit },
    { header: t('accounting.credit'), value: (r) => r.credit },
    { header: t('accounting.balance'), value: (r) => r.balance },
  ],
  rows: data.accounts.flatMap((a) => {
    const account = `${a.code} ${accountName(a, lang)}`;
    return [
      {
        account,
        date: null,
        number: null,
        narration: t('accounting.reports.openingBalance'),
        debit: null,
        credit: null,
        balance: n(a.opening),
      },
      ...a.rows.map((r) => ({
        account,
        date: r.date,
        number: r.number,
        narration: [r.narration ?? r.description, r.partyName].filter(Boolean).join(' · '),
        debit: n(r.debit),
        credit: n(r.credit),
        balance: n(r.balance),
      })),
      {
        account,
        date: null,
        number: null,
        narration: t('accounting.reports.closingBalance'),
        debit: n(a.debit),
        credit: n(a.credit),
        balance: n(a.closing),
      },
    ];
  }),
});

// ── Day book ──────────────────────────────────────────────────────────────

function DayBookView({ data, onPage }: { data: DayBook; onPage: (page: number) => void }) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t('accounting.reports.dayBookSummary', { count: data.meta.total, amount: money(data.totalDebit) })}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('accounting.date')}</TableHead>
              <TableHead>{t('accounting.journals.number')}</TableHead>
              <TableHead>{t('accounting.account')}</TableHead>
              <TableHead className="text-right">{t('accounting.debit')}</TableHead>
              <TableHead className="text-right">{t('accounting.credit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.entries.map((e) =>
              e.lines.map((l, i) => (
                <TableRow key={l.id} className={cn(i === 0 && 'border-t-2')}>
                  <TableCell className="whitespace-nowrap">
                    {i === 0 ? formatDate(e.entryDate) : ''}
                  </TableCell>
                  <TableCell>
                    {i === 0 && (
                      <>
                        <Link
                          to={`${ACCOUNTING_ROUTES.journals}/${e.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {e.number}
                        </Link>
                        <div className="max-w-xs truncate text-xs text-muted-foreground">{e.narration}</div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className={cn(Number(l.credit) > 0 && 'pl-8')}>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{l.account.code}</span>
                    {accountName(l.account, language)}
                    {l.party && <span className="text-xs text-muted-foreground"> · {l.party.name}</span>}
                  </TableCell>
                  <Amount value={Number(l.debit) || null} />
                  <Amount value={Number(l.credit) || null} />
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </div>
      {data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            disabled={data.meta.page <= 1}
            onClick={() => onPage(data.meta.page - 1)}
          >
            {t('table.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {data.meta.page} / {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.meta.page >= data.meta.totalPages}
            onClick={() => onPage(data.meta.page + 1)}
          >
            {t('table.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

const dayBookExport = (data: DayBook, t: (k: string) => string, lang: 'en' | 'bn'): ReportExport => ({
  columns: [
    { header: t('accounting.date'), value: (r) => r.date },
    { header: t('accounting.journals.number'), value: (r) => r.number },
    { header: t('accounting.journals.narration'), value: (r) => r.narration },
    { header: t('accounting.account'), value: (r) => r.account },
    { header: t('accounting.debit'), value: (r) => r.debit },
    { header: t('accounting.credit'), value: (r) => r.credit },
  ],
  rows: data.entries.flatMap((e) =>
    e.lines.map((l) => ({
      date: e.entryDate,
      number: e.number,
      narration: e.narration,
      account: `${l.account.code} ${accountName(l.account, lang)}`,
      debit: n(l.debit) || null,
      credit: n(l.credit) || null,
    })),
  ),
});

// ── VAT ───────────────────────────────────────────────────────────────────

function VatView({ data }: { data: VatReport }) {
  const { t } = useTranslation();
  const block = (key: 'output' | 'input') => (
    <div className="overflow-x-auto">
      <h3 className="mb-2 font-medium">{t(`accounting.reports.vat.${key}`)}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('accounting.reports.vat.taxGroup')}</TableHead>
            <TableHead className="text-right">{t('accounting.reports.vat.taxable')}</TableHead>
            <TableHead className="text-right">{t('accounting.reports.vat.tax')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data[key].rows.map((r) => (
            <TableRow key={r.taxGroup}>
              <TableCell>{r.taxGroup}</TableCell>
              <Amount value={r.taxable} />
              <Amount value={r.tax} />
            </TableRow>
          ))}
          {!data[key].rows.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                {t('accounting.reports.vat.none')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-medium">{t('accounting.total')}</TableCell>
            <Amount value={data[key].taxable} strong />
            <Amount value={data[key].tax} strong />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      {block('output')}
      {block('input')}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <span className="font-semibold">
          {t(
            Number(data.netPayable) >= 0
              ? 'accounting.reports.vat.payable'
              : 'accounting.reports.vat.refundable',
          )}
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {formatCurrency(Math.abs(Number(data.netPayable)))}
        </span>
      </div>
    </div>
  );
}

const vatExport = (data: VatReport, t: (k: string) => string): ReportExport => ({
  columns: [
    { header: t('accounting.reports.vat.section'), value: (r) => r.section },
    { header: t('accounting.reports.vat.taxGroup'), value: (r) => r.group },
    { header: t('accounting.reports.vat.taxable'), value: (r) => r.taxable },
    { header: t('accounting.reports.vat.tax'), value: (r) => r.tax },
  ],
  rows: [
    ...(['output', 'input'] as const).flatMap((key) => [
      ...data[key].rows.map((r) => ({
        section: t(`accounting.reports.vat.${key}`),
        group: r.taxGroup,
        taxable: n(r.taxable),
        tax: n(r.tax),
      })),
      {
        section: t(`accounting.reports.vat.${key}`),
        group: t('accounting.total'),
        taxable: n(data[key].taxable),
        tax: n(data[key].tax),
      },
    ]),
    { section: t('accounting.reports.vat.payable'), group: null, taxable: null, tax: n(data.netPayable) },
  ],
});

// ── Page ──────────────────────────────────────────────────────────────────

const MODE: Record<ReportName, 'range' | 'asOf'> = {
  'trial-balance': 'range',
  'profit-loss': 'range',
  'balance-sheet': 'asOf',
  'cash-flow': 'range',
  'general-ledger': 'range',
  'day-book': 'range',
  vat: 'range',
};
const FILTER_KEYS = [
  'from',
  'to',
  'asOf',
  'branchId',
  'compareFrom',
  'compareTo',
  'compareAsOf',
  'accountId',
  'page',
];

export default function ReportPage() {
  const { report = '' } = useParams();
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [params, setParams] = useSearchParams();
  const name = REPORTS.find((r) => r === report);
  const filters: ReportFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
  const setFilters = useCallback(
    (patch: ReportFilters) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const needsAccount = name === 'general-ledger' && !filters.accountId;
  const query = useReport<unknown>(name ?? 'trial-balance', filters, Boolean(name) && !needsAccount);
  if (!name) return <Navigate to={ACCOUNTING_ROUTES.reports} replace />;

  const data = query.data as Record<string, unknown> | undefined;
  const periodLabel = data
    ? MODE[name] === 'asOf'
      ? rangeLabel(t, undefined, undefined, data.asOf as string)
      : rangeLabel(t, data.from as string, data.to as string)
    : '';
  const exporters: Record<ReportName, () => ReportExport | null> = {
    'trial-balance': () => trialBalanceExport(data as unknown as TrialBalance, t, language),
    'profit-loss': () => {
      const pl = data as unknown as ProfitLoss;
      const r = (key: string) => t(`accounting.reports.sections.${key}`);
      return statementExport(
        pl.sections,
        [
          { after: 'salesReturns', label: r('netSales'), figure: pl.netSales },
          { after: 'cogs', label: r('grossProfit'), figure: pl.grossProfit },
          { after: 'expenses', label: r('operatingProfit'), figure: pl.operatingProfit },
          { after: 'otherExpenses', label: r('netProfit'), figure: pl.netProfit },
        ],
        t,
        language,
        Boolean(pl.compare),
      );
    },
    'balance-sheet': () => {
      const bs = data as unknown as BalanceSheet;
      const r = (key: string) => t(`accounting.reports.sections.${key}`);
      return statementExport(
        bs.sections,
        [
          {
            after: 'fixedAssets',
            label: r('totalAssets'),
            figure: { amount: bs.totalAssets, compare: bs.compareTotalAssets },
          },
          {
            after: 'equity',
            label: r('totalLiabilitiesEquity'),
            figure: { amount: bs.totalLiabilitiesEquity, compare: bs.compareTotalLiabilitiesEquity },
          },
        ],
        t,
        language,
        Boolean(bs.compareAsOf),
      );
    },
    'cash-flow': () => cashFlowExport(data as unknown as CashFlow, t),
    'general-ledger': () => generalLedgerExport(data as unknown as GeneralLedger, t, language),
    'day-book': () => dayBookExport(data as unknown as DayBook, t, language),
    vat: () => vatExport(data as unknown as VatReport, t),
  };

  const view = () => {
    if (!data) return null;
    switch (name) {
      case 'trial-balance':
        return <TrialBalanceView data={data as unknown as TrialBalance} />;
      case 'profit-loss':
        return <ProfitLossView data={data as unknown as ProfitLoss} />;
      case 'balance-sheet':
        return <BalanceSheetView data={data as unknown as BalanceSheet} />;
      case 'cash-flow':
        return <CashFlowView data={data as unknown as CashFlow} />;
      case 'general-ledger':
        return <GeneralLedgerView data={data as unknown as GeneralLedger} />;
      case 'day-book':
        return (
          <DayBookView
            data={data as unknown as DayBook}
            onPage={(page) => setFilters({ page: String(page) })}
          />
        );
      default:
        return <VatView data={data as unknown as VatReport} />;
    }
  };

  return (
    <ReportShell
      name={name}
      filters={filters}
      setFilters={setFilters}
      mode={MODE[name]}
      compare={name === 'profit-loss' || name === 'balance-sheet'}
      periodLabel={periodLabel}
      loading={query.isPending && !needsAccount}
      exportData={data ? exporters[name] : undefined}
      extraFilters={
        name === 'general-ledger' && (
          <div className="flex w-72 flex-col gap-1.5">
            <Label className="text-xs">{t('accounting.account')}</Label>
            <AccountSelect
              value={filters.accountId || null}
              onChange={(id) => setFilters({ accountId: id ?? '' })}
            />
          </div>
        )
      }
    >
      {needsAccount ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('accounting.reports.pickAccount')}
        </p>
      ) : query.isError ? (
        <p className="py-8 text-center text-sm text-destructive">{(query.error as Error).message}</p>
      ) : (
        view()
      )}
    </ReportShell>
  );
}
