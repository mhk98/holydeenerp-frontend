import { useTranslation } from 'react-i18next';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SessionReport } from '../types';

/** X / Z report on screen: sales, payments by method, and the cash drawer reconciliation. */
export function SessionReportView({ report }: { report: SessionReport }) {
  const { t } = useTranslation();
  const variance = report.cash.variance != null ? Number(report.cash.variance) : null;
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <section>
        <h3 className="mb-2 font-medium">{t('pos.report.sales')}</h3>
        <dl className="flex flex-col gap-1">
          <Row label={t('pos.report.salesCount')} value={String(report.sales.count)} />
          <Row label={t('pos.report.items')} value={formatQuantity(report.sales.itemsQuantity)} />
          <Row label={t('pos.report.gross')} value={formatCurrency(report.sales.gross)} />
          <Row label={t('pos.report.discounts')} value={`− ${formatCurrency(report.sales.discounts)}`} />
          <Row label={t('pos.report.tax')} value={formatCurrency(report.sales.tax)} />
          <Row label={t('pos.report.netSales')} value={formatCurrency(report.sales.total)} strong />
          <Row
            label={t('pos.report.returns', { count: report.returns.count })}
            value={`− ${formatCurrency(report.returns.total)}`}
          />
          {Number(report.sales.onAccount) > 0 && (
            <Row label={t('pos.report.onAccount')} value={formatCurrency(report.sales.onAccount)} />
          )}
        </dl>
        <h3 className="mt-4 mb-2 font-medium">{t('pos.report.payments')}</h3>
        <dl className="flex flex-col gap-1">
          {report.payments.map((p) => (
            <Row
              key={p.methodId}
              label={p.name}
              value={`${formatCurrency(p.received)}${Number(p.refunded) > 0 ? ` (−${formatCurrency(p.refunded)})` : ''}`}
            />
          ))}
          {!report.payments.length && <p className="text-muted-foreground">—</p>}
        </dl>
      </section>
      <section>
        <h3 className="mb-2 font-medium">{t('pos.report.drawer')}</h3>
        <dl className="flex flex-col gap-1">
          <Row label={t('pos.report.opening')} value={formatCurrency(report.cash.opening)} />
          <Row label={t('pos.report.cashSales')} value={formatCurrency(report.cash.received)} />
          <Row label={t('pos.report.cashRefunds')} value={`− ${formatCurrency(report.cash.refunded)}`} />
          <Row label={t('pos.report.cashIn')} value={formatCurrency(report.cash.cashIn)} />
          <Row label={t('pos.report.cashOut')} value={`− ${formatCurrency(report.cash.cashOut)}`} />
          <Row label={t('pos.report.expected')} value={formatCurrency(report.cash.expected)} strong />
          {report.cash.counted != null && (
            <Row label={t('pos.report.counted')} value={formatCurrency(report.cash.counted)} strong />
          )}
          {variance != null && (
            <div
              className={cn(
                'flex justify-between gap-2 font-semibold',
                variance < 0 ? 'text-destructive' : variance > 0 ? 'text-amber-600' : 'text-emerald-600',
              )}
            >
              <dt>{t('pos.report.variance')}</dt>
              <dd className="tabular-nums">{formatCurrency(report.cash.variance)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-2', strong && 'border-t pt-1 font-semibold')}>
      <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
