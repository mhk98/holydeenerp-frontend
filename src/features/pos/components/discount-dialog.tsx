import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCart } from '../lib/cart-store';

/** Discount on the whole cart (% or fixed) and a note for the sale. */
export function DiscountDialog({
  maxDiscount,
  onClose,
}: {
  maxDiscount: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cart = useCart();
  const [type, setType] = useState(cart.discountType);
  const [value, setValue] = useState(cart.discountValue);
  const [notes, setNotes] = useState(cart.notes);
  const invalid =
    (value !== '' && !/^\d+(\.\d{1,4})?$/.test(value)) ||
    (type === 'percent' && Number(value) > 100) ||
    (type === 'percent' && maxDiscount != null && Number(value) > maxDiscount);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pos.cartDiscount')}</DialogTitle>
          <DialogDescription>{t('pos.cartDiscountHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={type}
              onValueChange={(v) => v && setType(v as typeof type)}
            >
              <ToggleGroupItem value="percent" className="h-12 px-4">
                %
              </ToggleGroupItem>
              <ToggleGroupItem value="amount" className="h-12 px-4">
                {t('sales.fixed')}
              </ToggleGroupItem>
            </ToggleGroup>
            <Input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value.trim())}
              placeholder="0"
              aria-invalid={invalid}
              aria-label={t('pos.cartDiscount')}
              className="h-12 flex-1 text-right text-lg tabular-nums"
              autoFocus
            />
          </div>
          {maxDiscount != null && (
            <p className="text-xs text-muted-foreground">
              {t('pos.discountLimit', { percent: maxDiscount })}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cart-notes">{t('inventory.notes')}</Label>
            <Textarea id="cart-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="h-12"
            onClick={() => (cart.setDiscount('percent', ''), onClose())}
          >
            {t('pos.removeDiscount')}
          </Button>
          <Button
            className="h-12 px-8"
            disabled={invalid}
            onClick={() => {
              cart.setDiscount(type, value);
              cart.setNotes(notes);
              onClose();
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
