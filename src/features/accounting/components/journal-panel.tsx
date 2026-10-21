import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import { StatusBadge } from '@/components/common/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSourceJournals } from '../api/accounting-api';
import { ACCOUNTING_ROUTES, ENTRY_TONE, accountName } from '../lib';

/** The journal entries a document posted, line by line. */
export function JournalPanel({ sourceType, sourceId }: { sourceType: string; sourceId: string }) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const journals = useSourceJournals(sourceType, sourceId);
  if (journals.isPending) return <Skeleton className="h-32" />;
  if (!journals.data?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('accounting.journalPanel.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {journals.data.map((j) => (
          <div key={j.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to={`${ACCOUNTING_ROUTES.journals}/${j.id}`}
                className="font-mono text-primary hover:underline"
              >
                {j.number}
              </Link>
              <StatusBadge tone={ENTRY_TONE[j.entryType]}>
                {t(`accounting.entryTypes.${j.entryType}`)}
              </StatusBadge>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounting.account')}</TableHead>
                    <TableHead className="text-right">{t('accounting.debit')}</TableHead>
                    <TableHead className="text-right">{t('accounting.credit')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(j.lines ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{l.account.code}</span>
                        {accountName(l.account, language)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(l.debit) ? formatCurrency(l.debit) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(l.credit) ? formatCurrency(l.credit) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
