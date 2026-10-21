import Decimal from 'decimal.js';
import type { PosBootstrap, TaxGroupRates } from '../types';

/**
 * Cart totals computed on the device, so the POS stays instant and works offline. This mirrors the
 * server exactly (sales.common.js priceSalesDocument + taxes/tax.calculator.js + roundTotal): line
 * discount → document discount spread by value → tax (inclusive / exclusive, compound) → rounding.
 * The server recomputes everything when the sale is saved; the two must agree.
 */

const D = (v: Decimal.Value | null | undefined) => new Decimal(v ?? 0);

export interface PricingLine {
  quantity: string;
  unitPrice: string;
  discountType: 'percent' | 'amount';
  discountValue: string;
  taxGroupId: string | null;
  priceIncludesTax: boolean;
}

export interface PricedLine {
  gross: string;
  discountAmount: string;
  documentDiscount: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
}

export interface CartTotals {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  roundOff: string;
  total: string;
  taxes: { name: string; amount: string }[];
}

type Settings = Pick<PosBootstrap['settings'], 'rounding' | 'amountDecimals'>;

function calculateTax(amount: Decimal, inclusive: boolean, decimals: number, group: TaxGroupRates) {
  const ordered = [...group.rates].sort((a, b) => a.sequence - b.sequence);
  const round = (d: Decimal) => d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const taxesFor = (net: Decimal) => {
    let running = net;
    return ordered.map((r) => {
      const taxable = r.isCompound ? running : net;
      const tax = taxable.times(r.rate).dividedBy(100);
      running = running.plus(tax);
      return tax;
    });
  };
  const net = inclusive
    ? amount.dividedBy(taxesFor(new Decimal(1)).reduce((s, t) => s.plus(t), new Decimal(1)))
    : amount;
  const taxes = taxesFor(net).map((t, i) => ({ name: ordered[i].name, amount: round(t) }));
  const totalTax = taxes.reduce((s, t) => s.plus(t.amount), new Decimal(0));
  const netAmount = inclusive ? amount.minus(totalTax) : round(net);
  return {
    taxes,
    totalTax,
    netAmount: round(netAmount),
    total: round(inclusive ? amount : netAmount.plus(totalTax)),
  };
}

function roundTotal(amount: Decimal, { roundTo, roundingMode }: Settings['rounding']) {
  if (roundTo === 'none') return amount;
  const step = D(roundTo);
  const mode =
    roundingMode === 'up'
      ? Decimal.ROUND_CEIL
      : roundingMode === 'down'
        ? Decimal.ROUND_FLOOR
        : Decimal.ROUND_HALF_UP;
  return amount.dividedBy(step).toDecimalPlaces(0, mode).times(step);
}

export function priceCart(
  lines: PricingLine[],
  header: { discountType: 'percent' | 'amount'; discountValue: string },
  settings: Settings,
  taxGroups: TaxGroupRates[],
): { lines: PricedLine[]; totals: CartTotals } {
  const decimals = settings.amountDecimals;
  const round = (d: Decimal) => d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const groupOf = new Map(taxGroups.map((g) => [g.id, g]));
  const staged = lines.map((l) => {
    const gross = round(D(l.quantity || 0).times(l.unitPrice || 0));
    const value = D(l.discountValue || 0);
    const discount =
      l.discountType === 'percent'
        ? round(gross.times(value).dividedBy(100))
        : Decimal.min(round(value), gross);
    return { line: l, gross, discount, net: gross.minus(discount) };
  });
  const netSum = staged.reduce((s, x) => s.plus(x.net), D(0));
  const docValue = D(header.discountValue || 0);
  const docDiscount =
    header.discountType === 'percent'
      ? round(netSum.times(docValue).dividedBy(100))
      : Decimal.min(round(docValue), netSum);

  let given = D(0);
  const taxSummary = new Map<string, Decimal>();
  const priced = staged.map((x, i) => {
    const share =
      i === staged.length - 1
        ? docDiscount.minus(given)
        : netSum.gt(0)
          ? round(docDiscount.times(x.net).dividedBy(netSum))
          : D(0);
    given = given.plus(share);
    const taxable = x.net.minus(share);
    const group = x.line.taxGroupId ? groupOf.get(x.line.taxGroupId) : undefined;
    const tax = group
      ? calculateTax(taxable, x.line.priceIncludesTax, decimals, group)
      : { taxes: [], totalTax: D(0), netAmount: taxable, total: taxable };
    for (const t of tax.taxes) taxSummary.set(t.name, (taxSummary.get(t.name) ?? D(0)).plus(t.amount));
    return {
      gross: x.gross.toFixed(decimals),
      discountAmount: x.discount.toFixed(decimals),
      documentDiscount: share.toFixed(decimals),
      taxAmount: tax.totalTax.toFixed(decimals),
      lineSubtotal: tax.netAmount.toFixed(decimals),
      lineTotal: tax.total.toFixed(decimals),
    };
  });
  const beforeRounding = priced.reduce((s, l) => s.plus(l.lineTotal), D(0));
  const total = roundTotal(beforeRounding, settings.rounding);
  return {
    lines: priced,
    totals: {
      subtotal: staged.reduce((s, x) => s.plus(x.gross), D(0)).toFixed(decimals),
      discountTotal: staged
        .reduce((s, x) => s.plus(x.discount), D(0))
        .plus(docDiscount)
        .toFixed(decimals),
      taxTotal: priced.reduce((s, l) => s.plus(l.taxAmount), D(0)).toFixed(decimals),
      roundOff: total.minus(beforeRounding).toFixed(decimals),
      total: total.toFixed(decimals),
      taxes: [...taxSummary.entries()].map(([name, amount]) => ({ name, amount: amount.toFixed(decimals) })),
    },
  };
}

/** Sum / compare helpers for payment amounts (no float maths). */
export const money = {
  sum: (values: (string | number)[]) => values.reduce<Decimal>((s, v) => s.plus(v || 0), D(0)),
  D,
};
