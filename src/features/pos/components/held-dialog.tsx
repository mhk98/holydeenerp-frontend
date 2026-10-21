import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlayCircle } from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { posApi } from '../api/pos-api';
import type { HeldCart } from '../types';

/** Parked carts of the branch; recalling one loads it into the cart. */
export function HeldDialog({
  registerId,
  onRecall,
  onClose,
}: {
  registerId: string;
  onRecall: (cart: HeldCart) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const held = useQuery({ queryKey: ['pos', 'held', registerId], queryFn: () => posApi.held(registerId) });
  const recall = async (id: string) => {
    try {
      const order = await posApi.recall(id);
      queryClient.invalidateQueries({ queryKey: ['pos', 'held'] });
      onRecall(order.cart);
    } catch (err) {
      toast.error((err as Error).message);
      held.refetch();
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pos.heldOrders')}</DialogTitle>
          <DialogDescription>{t('pos.heldHint')}</DialogDescription>
        </DialogHeader>
        {held.isPending ? (
          <Skeleton className="h-40" />
        ) : !held.data?.length ? (
          <p className="py-8 text-center text-muted-foreground">{t('pos.noHeld')}</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
            {held.data.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{h.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      h.customer?.name,
                      t('pos.itemsCount', { count: h.cart.lines.length }),
                      h.creator?.name,
                      formatRelativeTime(h.createdAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <span className="font-semibold tabular-nums">{formatCurrency(h.total)}</span>
                <Button className="h-11" onClick={() => recall(h.id)}>
                  <PlayCircle aria-hidden /> {t('pos.recall')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
