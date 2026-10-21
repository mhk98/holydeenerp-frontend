import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenText,
  CalendarDays,
  ChartNoAxesCombined,
  Landmark,
  ListChecks,
  type LucideIcon,
  Percent,
  Waves,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReportName } from '../api/reports-api';
import { ACCOUNTING_ROUTES } from '../lib';

const CARDS: [ReportName, LucideIcon][] = [
  ['profit-loss', ChartNoAxesCombined],
  ['balance-sheet', Landmark],
  ['cash-flow', Waves],
  ['trial-balance', ListChecks],
  ['general-ledger', BookOpenText],
  ['day-book', CalendarDays],
  ['vat', Percent],
];

/** Financial reports hub. */
export default function ReportsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('accounting.reports.title')}
        description={t('accounting.reports.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.reports.title') }]}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map(([name, Icon]) => (
          <Link
            key={name}
            to={`${ACCOUNTING_ROUTES.reports}/${name}`}
            className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {t(`accounting.reports.${name}.title`)}
                </CardTitle>
                <CardDescription>{t(`accounting.reports.${name}.description`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
