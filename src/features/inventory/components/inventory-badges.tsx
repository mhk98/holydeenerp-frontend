import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/status-badge';
import type { AdjustmentStatus, CountStatus, StockStatus, TransferStatus } from '@/types';
import { DOC_STATUS_TONE, STOCK_STATUS_TONE } from '../lib';

type DocStatus = AdjustmentStatus | TransferStatus | CountStatus;

/** Workflow status of an adjustment, transfer or count. */
export function DocStatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <StatusBadge tone={DOC_STATUS_TONE[status]} className={className}>
      {t(`inventory.status.${status}`)}
    </StatusBadge>
  );
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const { t } = useTranslation();
  return <StatusBadge tone={STOCK_STATUS_TONE[status]}>{t(`inventory.stockStatus.${status}`)}</StatusBadge>;
}

/** Ledger movement type with an in/out arrow. */
export function MovementTypeLabel({ type, quantity }: { type: string; quantity: string }) {
  const { t } = useTranslation();
  const isIn = Number(quantity) > 0;
  const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon
        className={cn(
          'size-3.5',
          isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        )}
        aria-hidden
      />
      {t(`inventory.movementTypes.${type}`, { defaultValue: type })}
    </span>
  );
}

/** Signed quantity: green for stock in, red for stock out. */
export function SignedQuantity({ value, unit }: { value: string; unit?: string | null }) {
  const n = Number(value);
  return (
    <span
      className={cn(
        'tabular-nums',
        n > 0 && 'text-emerald-700 dark:text-emerald-400',
        n < 0 && 'text-red-700 dark:text-red-400',
      )}
    >
      {n > 0 ? '+' : ''}
      {formatQuantity(value)}
      {unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
    </span>
  );
}
