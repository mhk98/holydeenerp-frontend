import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { exportRows, type ExportColumn, type ExportFormat } from '@/lib/export';
import { useAuthStore } from '@/stores/auth-store';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ACCOUNTING_ROUTES } from '../lib';

export type ReportFilters = Record<string, string>;
const ALL = '__all__';

/** A flat table for Excel / PDF / CSV export. */
export interface ReportExport {
  columns: ExportColumn<Record<string, string | number | null>>[];
  rows: Record<string, string | number | null>[];
}

/**
 * Frame of every financial report: title, filters (period or as-of date, branch, comparison),
 * export (CSV / Excel / PDF) and print. The report body prints on its own (`.print-area`) with the
 * company name and period on top.
 */
export function ReportShell({
  name,
  filters,
  setFilters,
  mode,
  compare,
  extraFilters,
  periodLabel,
  loading,
  exportData,
  children,
}: {
  name: string;
  filters: ReportFilters;
  setFilters: (patch: ReportFilters) => void;
  /** "range": from / to; "asOf": one date. */
  mode: 'range' | 'asOf';
  /** Offer a comparison period / date. */
  compare?: boolean;
  extraFilters?: ReactNode;
  periodLabel: string;
  loading: boolean;
  exportData?: () => ReportExport | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const company = useAuthStore((s) => s.user?.company?.name);
  const branches = useAuthStore((s) => s.user?.branches ?? []);
  const title = t(`accounting.reports.${name}.title`);
  const comparing = Boolean(filters.compareFrom || filters.compareTo || filters.compareAsOf);

  const doExport = (format: ExportFormat) => {
    const data = exportData?.();
    if (!data) return;
    exportRows(format, data.rows, data.columns, { filename: name, title: `${title} — ${periodLabel}` }).catch(
      (err: Error) => toast.error(err.message),
    );
  };

  const dateInput = (key: string, label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`f-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`f-${key}`}
        type="date"
        className="w-40"
        value={filters[key] ?? ''}
        onChange={(e) => setFilters({ [key]: e.target.value })}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title={title}
        description={t(`accounting.reports.${name}.description`)}
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.reports.title'), to: ACCOUNTING_ROUTES.reports },
          { label: title },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden /> {t('accounting.reports.print')}
            </Button>
            {can('accounting.export') && exportData && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download aria-hidden /> {t('accounting.reports.export')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => doExport('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => doExport('pdf')}>PDF</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => doExport('csv')}>CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4">
          {mode === 'range' ? (
            <>
              {dateInput('from', t('accounting.from'))}
              {dateInput('to', t('accounting.to'))}
            </>
          ) : (
            dateInput('asOf', t('accounting.reports.asOf'))
          )}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('accounting.branch')}</Label>
            <Select
              value={filters.branchId || ALL}
              onValueChange={(v) => setFilters({ branchId: v === ALL ? '' : v })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('accounting.reports.allBranches')}</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {extraFilters}
          {compare && (
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="compare"
                checked={comparing}
                onCheckedChange={(on) =>
                  setFilters(
                    on ? defaultCompare(mode, filters) : { compareFrom: '', compareTo: '', compareAsOf: '' },
                  )
                }
              />
              <Label htmlFor="compare">{t('accounting.reports.compare')}</Label>
            </div>
          )}
          {compare && comparing && mode === 'range' && (
            <>
              {dateInput('compareFrom', t('accounting.reports.compareFrom'))}
              {dateInput('compareTo', t('accounting.reports.compareTo'))}
            </>
          )}
          {compare &&
            comparing &&
            mode === 'asOf' &&
            dateInput('compareAsOf', t('accounting.reports.compareAsOf'))}
        </CardContent>
      </Card>
      <Card className="print-area">
        <CardContent>
          <div className="mb-4 hidden text-center print:block">
            <div className="text-lg font-semibold">{company}</div>
            <div className="font-medium">{title}</div>
            <div className="text-sm">{periodLabel}</div>
          </div>
          {loading ? <Skeleton className="h-64" /> : children}
        </CardContent>
      </Card>
    </>
  );
}

/** Same-length period just before the chosen one (or a year earlier for an as-of date). */
function defaultCompare(mode: 'range' | 'asOf', f: ReportFilters): ReportFilters {
  const shift = (date: string, years: number) => {
    if (!date) return '';
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + years);
    return d.toISOString().slice(0, 10);
  };
  if (mode === 'asOf') return { compareAsOf: shift(f.asOf || new Date().toISOString().slice(0, 10), -1) };
  return { compareFrom: shift(f.from, -1), compareTo: shift(f.to, -1) };
}
