import { useWatch, type Control } from 'react-hook-form';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useSalesCalculate } from '../api/sales-api';
import { calculateBody, type SalesLinesForm } from '../schemas';

/** Live server totals (line + document discounts, tax, rounding) for a sales form, debounced. */
export function useSalesTotals(control: Control<SalesLinesForm>, enabled = true) {
  const items = useWatch({ control, name: 'items' }) ?? [];
  const discountType = useWatch({ control, name: 'discountType' }) ?? 'percent';
  const discountValue = useWatch({ control, name: 'discountValue' }) ?? '';
  const valid = /^\d*(\.\d{1,4})?$/.test(discountValue);
  const body = calculateBody(items, discountType, valid ? discountValue : '0');
  const debounced = useDebouncedValue(JSON.stringify(body), 300);
  return useSalesCalculate(enabled ? (JSON.parse(debounced) as typeof body) : null);
}
