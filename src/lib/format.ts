import { useSettingsStore } from '@/stores/settings-store';
import type { DateFormat } from '@/types';

/**
 * The only place numbers, money and dates are formatted. Components should use
 * these helpers (or the useFormat hook) — never call Intl / toFixed directly.
 *
 * Money and quantities arrive from the API as DECIMAL strings. Formatting is
 * display-only; do arithmetic on the server.
 */

type Numeric = number | string | null | undefined;

const LOCALE_MAP: Record<string, string> = { en: 'en-IN', bn: 'bn-BD' };

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveLocale(locale?: string) {
  const lang = locale ?? useSettingsStore.getState().language;
  return LOCALE_MAP[lang] ?? lang;
}

export interface FormatOptions {
  locale?: string;
  fallback?: string;
}

export function formatNumber(value: Numeric, opts: FormatOptions & { decimals?: number } = {}) {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '—';
  return new Intl.NumberFormat(resolveLocale(opts.locale), {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 2,
  }).format(n);
}

/** Quantities: no forced decimals, up to the company's quantity precision. */
export function formatQuantity(value: Numeric, opts: FormatOptions & { decimals?: number } = {}) {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '—';
  const decimals = opts.decimals ?? useSettingsStore.getState().quantityDecimals;
  return new Intl.NumberFormat(resolveLocale(opts.locale), { maximumFractionDigits: decimals }).format(n);
}

/** Money in the company's base currency and amount precision unless overridden. */
export function formatCurrency(
  value: Numeric,
  opts: FormatOptions & { currency?: string; decimals?: number } = {},
) {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '—';
  const state = useSettingsStore.getState();
  const currency = opts.currency ?? state.currency;
  const decimals = opts.decimals ?? state.amountDecimals;
  return new Intl.NumberFormat(resolveLocale(opts.locale), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Short number for chart axes: 12K, 3.4L (Indian / Bangla grouping follows the locale). */
export function formatCompact(value: Numeric, opts: FormatOptions = {}) {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '—';
  return new Intl.NumberFormat(resolveLocale(opts.locale), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatPercent(value: Numeric, opts: FormatOptions & { decimals?: number } = {}) {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '—';
  return new Intl.NumberFormat(resolveLocale(opts.locale), {
    style: 'percent',
    maximumFractionDigits: opts.decimals ?? 1,
  }).format(n / 100);
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date-only strings ("2026-10-20") are calendar dates — never shift them across timezones. */
const isDateOnly = (v: DateInput) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Date in the company's date format (Settings → Preferences) and timezone.
 * Pass Intl options to override the pattern (e.g. { month: 'long', year: 'numeric' }).
 */
export function formatDate(
  value: DateInput,
  opts: FormatOptions & Intl.DateTimeFormatOptions & { pattern?: DateFormat } = {},
) {
  const { locale, fallback, pattern, ...intl } = opts;
  const d = toDate(isDateOnly(value) ? `${value}T00:00:00Z` : value);
  if (!d) return fallback ?? '—';
  const state = useSettingsStore.getState();
  const timeZone = isDateOnly(value) ? 'UTC' : state.timezone;
  const loc = resolveLocale(locale);

  if (Object.keys(intl).length) return new Intl.DateTimeFormat(loc, { timeZone, ...intl }).format(d);

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(loc, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const monthName = new Intl.DateTimeFormat(loc, { timeZone, month: 'short' }).format(d);
  return (pattern ?? state.dateFormat)
    .replace('YYYY', parts.year)
    .replace('MMM', monthName)
    .replace('MM', parts.month)
    .replace('DD', parts.day);
}

export function formatTime(value: DateInput, opts: FormatOptions = {}) {
  const d = toDate(value);
  if (!d) return opts.fallback ?? '—';
  const state = useSettingsStore.getState();
  return new Intl.DateTimeFormat(resolveLocale(opts.locale), {
    timeZone: state.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: state.timeFormat === '12h',
  }).format(d);
}

export function formatDateTime(value: DateInput, opts: FormatOptions = {}) {
  if (!toDate(value)) return opts.fallback ?? '—';
  return `${formatDate(value, opts)}, ${formatTime(value, opts)}`;
}

/** File sizes: 1536 → "1.5 KB". */
export function formatBytes(value: Numeric, opts: FormatOptions = {}) {
  const n = toNumber(value);
  if (n === null) return opts.fallback ?? '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = n;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${formatNumber(size, { ...opts, decimals: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

export function formatRelativeTime(value: DateInput, opts: FormatOptions = {}) {
  const d = toDate(value);
  if (!d) return opts.fallback ?? '—';
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(resolveLocale(opts.locale), { numeric: 'auto' });
  for (const [unit, sec] of units) {
    if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit);
  }
  return rtf.format(diffSec, 'second');
}
