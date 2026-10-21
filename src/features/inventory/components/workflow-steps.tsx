import { useTranslation } from 'react-i18next';
import { Check, Circle, X } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UserRef } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TrailEntry {
  /** i18n key under inventory.trail.* */
  action: string;
  user?: UserRef | null;
  at?: string | null;
}

interface Props {
  /** Ordered happy-path statuses, e.g. ['draft', 'pending_approval', 'posted']. */
  steps: string[];
  status: string;
  trail: TrailEntry[];
  rejectionReason?: string | null;
}

/** Status stepper and audit trail of a workflow document. */
export function WorkflowSteps({ steps, status, trail, rejectionReason }: Props) {
  const { t } = useTranslation();
  const failed = status === 'rejected' || status === 'cancelled';
  // A rejected document goes back to the step before approval.
  const effective =
    status === 'rejected' ? (steps.includes('pending_approval') ? 'pending_approval' : steps[0]) : status;
  const current = failed && status === 'cancelled' ? -1 : steps.indexOf(effective);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('inventory.workflow')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ol className="flex flex-col gap-3" aria-label={t('inventory.workflow')}>
          {steps.map((step, i) => {
            const done = !failed ? i < current || (i === current && i === steps.length - 1) : i < current;
            const active = i === current && !done;
            const rejectedHere = status === 'rejected' && step === effective;
            return (
              <li key={step} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                    done && 'border-emerald-600 bg-emerald-600 text-white',
                    active && !rejectedHere && 'border-primary text-primary',
                    rejectedHere && 'border-destructive bg-destructive text-white',
                    !done && !active && !rejectedHere && 'text-muted-foreground',
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : rejectedHere ? (
                    <X className="size-3.5" aria-hidden />
                  ) : (
                    <Circle className="size-2 fill-current" aria-hidden />
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    active || rejectedHere ? 'font-medium' : done ? '' : 'text-muted-foreground',
                  )}
                >
                  {t(`inventory.status.${step}`)}
                </span>
              </li>
            );
          })}
          {status === 'cancelled' && (
            <li className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full border border-zinc-400 bg-zinc-400 text-white">
                <X className="size-3.5" aria-hidden />
              </span>
              <span className="text-sm font-medium">{t('inventory.status.cancelled')}</span>
            </li>
          )}
        </ol>

        {status === 'rejected' && rejectionReason && (
          <Alert variant="destructive">
            <AlertTitle>{t('inventory.rejectedBecause')}</AlertTitle>
            <AlertDescription>{rejectionReason}</AlertDescription>
          </Alert>
        )}

        <dl className="flex flex-col gap-2 border-t pt-4 text-sm">
          {trail
            .filter((e) => e.at)
            .map((e) => (
              <div key={e.action} className="flex flex-col">
                <dt className="text-muted-foreground">{t(`inventory.trail.${e.action}`)}</dt>
                <dd>
                  {e.user?.name ?? '—'}{' '}
                  <span className="text-muted-foreground">· {formatDateTime(e.at)}</span>
                </dd>
              </div>
            ))}
        </dl>
      </CardContent>
    </Card>
  );
}
