import { useTranslation } from 'react-i18next';
import { RefreshCw, Trash2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { usePos } from '../lib/pos-store';

/** Sales waiting to reach the server; refused ones show why and can be discarded. */
export function QueueDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { queue, online, syncing, sync, discard } = usePos();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pos.queueTitle')}</DialogTitle>
          <DialogDescription>{t(online ? 'pos.queueOnline' : 'pos.queueOffline')}</DialogDescription>
        </DialogHeader>
        {!queue.length ? (
          <p className="py-8 text-center text-muted-foreground">{t('pos.queueEmpty')}</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
            {queue.map((q) => (
              <li key={q.clientUuid} className="flex items-start gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm">{q.receipt.invoice.offlineNumber}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(q.queuedAt)}</div>
                  {q.lastError && (
                    <div className={q.failed ? 'text-xs text-destructive' : 'text-xs text-amber-600'}>
                      {q.lastError}
                    </div>
                  )}
                </div>
                <span className="font-semibold tabular-nums">{formatCurrency(q.receipt.invoice.total)}</span>
                {q.failed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => discard(q.clientUuid)}
                    aria-label={t('pos.discard')}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button
          className="h-12"
          onClick={() => sync()}
          disabled={!online || syncing || !queue.some((q) => !q.failed)}
        >
          {syncing ? <Spinner /> : <RefreshCw aria-hidden />} {t('pos.syncNow')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
