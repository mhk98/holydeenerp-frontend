import { useWatch, type Control } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useCalculate } from '../api/purchase-api';
import type { PurchaseLineValues } from '../schemas';

type ActionMutation<R> = UseMutationResult<R, Error, { id: string; action: string; body?: unknown }>;

/**
 * Run a document action (submit, approve, post, convert-to-…). Conversions return a new
 * document; pass `goTo` to open it.
 */
export function useRunAction<R extends { id: string }>(
  mutation: ActionMutation<R>,
  module: 'purchase' | 'sales' = 'purchase',
) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    id: string,
    action: string,
    opts: { body?: unknown; message?: string; goTo?: string; onDone?: () => void } = {},
  ) =>
    mutation.mutate(
      { id, action, body: opts.body },
      {
        onSuccess: (result) => {
          toast.success(
            opts.message ?? t(`${module}.toast.${action}`, { defaultValue: t('purchase.toast.done') }),
          );
          opts.onDone?.();
          if (opts.goTo) navigate(`${opts.goTo}/${result.id}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
}

/** Live server totals for the lines of a form (debounced). */
export function useLinesTotals(control: Control<{ items: PurchaseLineValues[] }>, enabled = true) {
  const items = useWatch({ control, name: 'items' }) ?? [];
  const payload = items.map((l) => ({
    quantity: l.quantity || '0',
    unitPrice: l.unitPrice || '0',
    discountPercent: l.discountPercent || '0',
    taxGroupId: l.taxGroupId || null,
  }));
  const debounced = useDebouncedValue(JSON.stringify(payload), 300);
  return useCalculate(enabled ? (JSON.parse(debounced) as typeof payload) : []);
}
