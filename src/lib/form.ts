import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';

/**
 * Copy field-level errors from an API 422/409 response onto the form.
 * Returns true when at least one field error was applied (so callers can skip a toast).
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (!(error instanceof ApiError) || !error.errors?.length) return false;
  for (const e of error.errors) setError(e.field as Path<T>, { type: 'server', message: e.message });
  return true;
}

// Zod messages are i18n keys (translated by FormField).
export const v = {
  required: (s = z.string()) => s.trim().min(1, 'validation.required'),
  email: () => z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: () =>
    z
      .string()
      .min(8, 'validation.passwordMin')
      .max(72, 'validation.passwordMax')
      .regex(/[A-Za-z]/, 'validation.passwordLetter')
      .regex(/\d/, 'validation.passwordNumber'),
  phone: () =>
    z
      .string()
      .trim()
      .max(30, 'validation.phone')
      .regex(/^[0-9+\-\s()]*$/, 'validation.phone'),
  otp: () => z.string().regex(/^\d{6}$/, 'validation.otp'),
  code: (max = 30) =>
    z
      .string()
      .trim()
      .min(1, 'validation.required')
      .max(max, 'validation.tooLong')
      .regex(/^[A-Za-z0-9._-]+$/, 'validation.code'),
  optionalEmail: () =>
    z
      .string()
      .trim()
      .max(191, 'validation.tooLong')
      .refine((s) => !s || z.email().safeParse(s).success, 'validation.email'),
  /** Positive decimal typed as text (money, rates, factors). */
  decimal: ({
    scale = 6,
    allowZero = false,
    max,
  }: { scale?: number; allowZero?: boolean; max?: number } = {}) =>
    z
      .string()
      .trim()
      .regex(new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`), 'validation.decimal')
      .refine(
        (s) => (allowZero ? Number(s) >= 0 : Number(s) > 0),
        allowZero ? 'validation.nonNegative' : 'validation.positive',
      )
      .refine((s) => max === undefined || Number(s) <= max, 'validation.tooLarge'),
  /** Empty strings become null in API payloads. */
  nullIfEmpty: (s: string | null | undefined) => (s && s.trim() ? s.trim() : null),
};
