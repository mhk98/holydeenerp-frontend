import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import { Trash2 } from 'lucide-react';
import { ChipsInput } from '@/components/common/chips-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCart } from '../lib/cart-store';
import type { CartLine } from '../types';

const DEC = /^\d+(\.\d{1,4})?$/;

/** Edit one cart line: quantity, unit, price (when allowed), discount, notes and serial numbers. */
export function LineDialog({
  line,
  canEditPrice,
  maxDiscount,
  onClose,
}: {
  line: CartLine;
  canEditPrice: boolean;
  /** Cashier limit in % (null = no limit). */
  maxDiscount: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { update, remove } = useCart();
  const [quantity, setQuantity] = useState(line.quantity);
  const [unitId, setUnitId] = useState(line.unitId);
  const [price, setPrice] = useState(String(Number(line.unitPrice)));
  const [discountType, setDiscountType] = useState(line.discountType);
  const [discountValue, setDiscountValue] = useState(line.discountValue);
  const [notes, setNotes] = useState(line.notes);
  const [serials, setSerials] = useState(line.serialNumbers);

  const gross = DEC.test(quantity) && DEC.test(price) ? new Decimal(quantity).times(price) : new Decimal(0);
  const discountPct =
    !discountValue || !DEC.test(discountValue)
      ? new Decimal(0)
      : discountType === 'percent'
        ? new Decimal(discountValue)
        : gross.gt(0)
          ? new Decimal(discountValue).dividedBy(gross).times(100)
          : new Decimal(0);
  const errors = {
    quantity: !DEC.test(quantity) || Number(quantity) <= 0,
    price: !DEC.test(price),
    discount:
      (discountValue !== '' && !DEC.test(discountValue)) ||
      (discountType === 'percent' && Number(discountValue) > 100) ||
      (maxDiscount != null && discountPct.gt(maxDiscount)),
  };
  const valid = !errors.quantity && !errors.price && !errors.discount;

  const save = () => {
    update(line.id, {
      quantity,
      unitId,
      ...(unitId === line.unitId && { unitPrice: new Decimal(price).toFixed(4) }),
      discountType,
      discountValue,
      notes,
      serialNumbers: serials,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {line.item.name}
            {line.item.variantName && ` — ${line.item.variantName}`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-qty">{t('inventory.quantity')}</Label>
              <Input
                id="line-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.trim())}
                aria-invalid={errors.quantity}
                className="h-12 text-right text-lg tabular-nums"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-price">{t('purchase.unitPrice')}</Label>
              <Input
                id="line-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.trim())}
                readOnly={!canEditPrice || unitId !== line.unitId}
                aria-invalid={errors.price}
                className="h-12 text-right text-lg tabular-nums"
              />
            </div>
          </div>
          {line.item.units.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t('inventory.unit')}</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={unitId}
                onValueChange={(v) => v && setUnitId(v)}
              >
                {line.item.units.map((u) => (
                  <ToggleGroupItem key={u.unitId} value={u.unitId} className="h-11 px-4">
                    {u.code}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-discount">{t('sales.discount')}</Label>
            <div className="flex gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                value={discountType}
                onValueChange={(v) => v && setDiscountType(v as 'percent' | 'amount')}
              >
                <ToggleGroupItem value="percent" className="h-12 px-4">
                  %
                </ToggleGroupItem>
                <ToggleGroupItem value="amount" className="h-12 px-4">
                  {t('sales.fixed')}
                </ToggleGroupItem>
              </ToggleGroup>
              <Input
                id="line-discount"
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.trim())}
                placeholder="0"
                aria-invalid={errors.discount}
                className="h-12 flex-1 text-right text-lg tabular-nums"
              />
            </div>
            {maxDiscount != null && (
              <p className={errors.discount ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {t('pos.discountLimit', { percent: maxDiscount })}
              </p>
            )}
          </div>
          {line.item.trackSerial && (
            <div className="flex flex-col gap-1.5">
              <Label>{t('pos.serialNumbers')}</Label>
              <ChipsInput
                value={serials}
                onChange={setSerials}
                placeholder={t('inventory.serialPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('pos.serialHint', { count: Number(quantity) || 0 })}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-notes">{t('inventory.notes')}</Label>
            <Textarea id="line-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-12 text-destructive"
            onClick={() => {
              remove(line.id);
              onClose();
            }}
          >
            <Trash2 aria-hidden /> {t('common.remove')}
          </Button>
          <Button type="button" className="h-12 px-8" onClick={save} disabled={!valid}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
