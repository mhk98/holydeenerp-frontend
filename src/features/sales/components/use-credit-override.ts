import { useState } from 'react';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/use-permission';
import { isCreditLimitError } from '../lib';

type Attempt = (body: { creditOverride?: { reason: string } }) => Promise<unknown>;

/**
 * Confirm an order / post an invoice; when the credit limit would be exceeded, users with
 * sales.approve are asked for a reason and the action is retried as an override.
 * `onSettled` runs once the action succeeded or the override dialog was dismissed
 * (e.g. to open a newly saved draft). Render `<CreditOverrideDialog {...credit.dialog} />`.
 */
export function useCreditOverride() {
  const { can } = usePermission();
  const [pending, setPending] = useState<{
    attempt: Attempt;
    message: string;
    onSettled?: () => void;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (attempt: Attempt, onSettled?: () => void) => {
    try {
      await attempt({});
      onSettled?.();
      return true;
    } catch (err) {
      if (isCreditLimitError(err) && can('sales.approve')) {
        setPending({ attempt, message: (err as Error).message, onSettled });
        return false;
      }
      onSettled?.();
      throw err;
    }
  };

  const confirm = async (reason: string) => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.attempt({ creditOverride: { reason } });
      setPending(null);
      pending.onSettled?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return {
    run,
    dialog: {
      open: Boolean(pending),
      message: pending?.message ?? '',
      loading: busy,
      onConfirm: confirm,
      onClose: () => {
        pending?.onSettled?.();
        setPending(null);
      },
    },
  };
}
