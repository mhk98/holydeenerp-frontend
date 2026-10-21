import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Circle, Clock, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApprovalLevel, PurchaseApprovalEntry, PurchaseTotals, UserRef } from '@/types';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_TONE } from '../lib';

export function PurchaseStatusBadge({
  status,
  className,
  module = 'purchase',
}: {
  status: string;
  className?: string;
  module?: 'purchase' | 'sales';
}) {
  const { t } = useTranslation();
  return (
    <StatusBadge tone={STATUS_TONE[status] ?? 'neutral'} className={className}>
      {t(`${module}.status.${status}`, { defaultValue: status })}
    </StatusBadge>
  );
}

/** Document totals; `totals` from the server (saved document or /calculate preview). */
export function TotalsCard({
  totals,
  taxes,
  loading,
  extra,
}: {
  totals?: PurchaseTotals;
  taxes?: { name: string; amount: string }[];
  loading?: boolean;
  extra?: { label: string; value: string; strong?: boolean }[];
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('purchase.totals')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {!totals ? (
          loading ? (
            <Skeleton className="h-24" />
          ) : (
            <p className="text-muted-foreground">{t('purchase.addItemsForTotals')}</p>
          )
        ) : (
          <>
            <Row label={t('purchase.subtotal')} value={formatCurrency(totals.subtotal)} />
            {Number(totals.discountTotal) > 0 && (
              <Row label={t('purchase.discount')} value={`− ${formatCurrency(totals.discountTotal)}`} />
            )}
            {(taxes?.length
              ? taxes
              : Number(totals.taxTotal) > 0
                ? [{ name: t('purchase.tax'), amount: totals.taxTotal }]
                : []
            ).map((x) => (
              <Row key={x.name} label={x.name} value={formatCurrency(x.amount)} />
            ))}
            <div className="mt-1 border-t pt-2">
              <Row label={t('purchase.total')} value={formatCurrency(totals.total)} strong />
            </div>
            {extra?.map((e) => (
              <Row key={e.label} {...e} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', strong && 'text-base font-semibold')}>
      <span className={strong ? undefined : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Approval levels of a PO: done, current and waiting, plus the full history. */
export function ApprovalPanel({
  plan,
  level,
  status,
  history,
  roles,
  rejectionReason,
}: {
  plan: ApprovalLevel[];
  level: number;
  status: string;
  history: PurchaseApprovalEntry[];
  roles: { id: string; name: string }[];
  rejectionReason?: string | null;
}) {
  const { t } = useTranslation();
  const approvedAt = (lvl: number) =>
    [...history].reverse().find((h) => h.level === lvl && h.action === 'approved');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('purchase.approval.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {status === 'draft' && rejectionReason && (
          <Alert variant="destructive">
            <AlertTitle>{t('purchase.approval.sentBack')}</AlertTitle>
            <AlertDescription>{rejectionReason}</AlertDescription>
          </Alert>
        )}
        {!plan.length ? (
          <p className="text-muted-foreground">
            {status === 'draft' ? t('purchase.approval.decidedOnSubmit') : t('purchase.approval.none')}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {plan.map((l, i) => {
              const done = status !== 'draft' && i < level;
              const current = status === 'pending_approval' && i === level;
              const entry = done ? approvedAt(l.level ?? i + 1) : undefined;
              return (
                <li key={l.name} className="flex gap-3">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border',
                      done && 'border-emerald-600 bg-emerald-600 text-white',
                      current && 'border-amber-500 text-amber-600',
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : current ? (
                      <Clock className="size-3.5" aria-hidden />
                    ) : (
                      <Circle className="size-2 fill-current text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('purchase.approval.from', { amount: formatCurrency(l.minAmount) })}
                      {l.roleId &&
                        ` · ${roles.find((r) => r.id === l.roleId)?.name ?? t('purchase.approval.role')}`}
                    </div>
                    {entry && (
                      <div className="text-xs">
                        {entry.user?.name} · {formatDateTime(entry.createdAt)}
                      </div>
                    )}
                    {current && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        {t('purchase.approval.waiting')}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {history.length > 0 && (
          <div className="border-t pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              {t('purchase.approval.history')}
            </div>
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id} className="flex gap-2 text-xs">
                  {h.action === 'approved' ? (
                    <Check className="size-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <X className="size-3.5 text-destructive" aria-hidden />
                  )}
                  <span>
                    <span className="font-medium">{h.user?.name}</span> {t(`purchase.approval.${h.action}`)}{' '}
                    {h.levelName && `(${h.levelName})`} · {formatDateTime(h.createdAt)}
                    {h.note && <span className="block text-muted-foreground">“{h.note}”</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Who did what and when on a document. */
export function TrailCard({
  entries,
}: {
  entries: { label: string; user?: UserRef | null; at?: string | null }[];
}) {
  const { t } = useTranslation();
  const shown = entries.filter((e) => e.at);
  if (!shown.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('purchase.activity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-2 text-sm">
          {shown.map((e) => (
            <div key={e.label}>
              <dt className="text-muted-foreground">{e.label}</dt>
              <dd>
                {e.user?.name ?? '—'} <span className="text-muted-foreground">· {formatDateTime(e.at)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Linked documents (source and follow-ups) with their status. */
export function RelatedDocuments({
  groups,
}: {
  groups: {
    label: string;
    route: string;
    docs: { id: string; number: string; status?: string; extra?: ReactNode }[];
  }[];
}) {
  const { t } = useTranslation();
  const visible = groups.filter((g) => g.docs.length);
  if (!visible.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('purchase.related')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {visible.map((g) => (
          <div key={g.label}>
            <div className="mb-1 text-xs text-muted-foreground">{g.label}</div>
            <ul className="flex flex-col gap-1">
              {g.docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <Link to={`${g.route}/${d.id}`} className="font-mono text-xs text-primary hover:underline">
                    {d.number}
                  </Link>
                  <span className="flex items-center gap-2">
                    {d.extra}
                    {d.status && <PurchaseStatusBadge status={d.status} />}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
