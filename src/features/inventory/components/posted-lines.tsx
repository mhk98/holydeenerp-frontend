import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import type { StockAdjustmentItem, StockTransferItem } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Line = StockAdjustmentItem | StockTransferItem;
const isAdjustment = (l: Line): l is StockAdjustmentItem => 'direction' in l;

/** Read-only lines of a posted / dispatched document, with the costs fixed at posting. */
export function PostedLines({ items, total }: { items: Line[]; total?: string }) {
  const { t } = useTranslation();
  const showReason = items.some((l) => isAdjustment(l) && l.reason);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('inventory.item')}</TableHead>
            <TableHead>{t('inventory.batch')}</TableHead>
            <TableHead className="text-right">{t('inventory.quantity')}</TableHead>
            <TableHead className="text-right">{t('inventory.unitCost')}</TableHead>
            <TableHead className="text-right">{t('inventory.value')}</TableHead>
            {showReason && <TableHead>{t('inventory.reason')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((l) => {
            const out = isAdjustment(l) ? l.direction === 'out' : true;
            return (
              <TableRow key={l.id} className="align-top">
                <TableCell>
                  <div className="font-medium">
                    {l.product.name}
                    {l.variant && ` — ${l.variant.name}`}
                  </div>
                  <code className="font-mono text-xs text-muted-foreground">
                    {l.variant?.sku ?? l.product.sku}
                  </code>
                  {l.serialNumbers?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.serialNumbers.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[10px] font-normal">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {l.notes && <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p>}
                </TableCell>
                <TableCell className="text-xs">
                  {l.batch ? (
                    <>
                      <span className="font-mono">{l.batch.batchNo}</span>
                      {l.batch.expiryDate && (
                        <div className="text-muted-foreground">{formatDate(l.batch.expiryDate)}</div>
                      )}
                    </>
                  ) : isAdjustment(l) && l.batchNo ? (
                    <span className="font-mono">{l.batchNo}</span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  <span
                    className={
                      out ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                    }
                  >
                    {out ? '−' : '+'}
                    {formatQuantity(l.quantity)} {l.unit?.code ?? l.product.baseUnit?.code}
                  </span>
                  {l.unitFactor !== '1.000000' && Number(l.unitFactor) !== 1 && (
                    <div className="text-xs text-muted-foreground">
                      = {formatQuantity(l.baseQuantity)} {l.product.baseUnit?.code}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(l.unitCost)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(l.totalCost)}
                </TableCell>
                {showReason && (
                  <TableCell>
                    {isAdjustment(l) && l.reason ? t(`inventory.reasons.${l.reason}`) : '—'}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
        {total !== undefined && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right">
                {t('inventory.total')}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(total)}</TableCell>
              {showReason && <TableCell />}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
