import { z } from 'zod';
import { v } from '@/lib/form';
import type { Party } from '@/types';

export const NONE = '__none__';
export const ADDRESS_TYPES = ['billing', 'shipping', 'other'] as const;
const text = (max: number) => z.string().trim().max(max, 'validation.tooLong');

const address = z.object({
  type: z.enum(ADDRESS_TYPES),
  label: text(60),
  addressLine: v.required().max(500, 'validation.tooLong'),
  city: text(100),
  district: text(100),
  postalCode: text(20),
  country: text(60),
  phone: v.phone(),
  isDefault: z.boolean(),
});

export const partySchema = z.object({
  code: z
    .string()
    .trim()
    .max(30, 'validation.tooLong')
    .regex(/^[A-Za-z0-9._-]*$/, 'validation.code'),
  name: v.required().max(200, 'validation.tooLong'),
  contactPerson: text(150),
  phone: v.phone(),
  email: v.optionalEmail(),
  binNo: text(50),
  tinNo: text(50),
  groupId: z.string(),
  creditLimit: v.decimal({ scale: 4, allowZero: true }),
  paymentTermsDays: z.coerce
    .number()
    .int('validation.integer')
    .min(0, 'validation.nonNegative')
    .max(365, 'validation.tooLarge'),
  openingBalance: v.decimal({ scale: 4, allowZero: true }),
  openingBalanceType: z.enum(['debit', 'credit']),
  notes: text(5000),
  isActive: z.boolean(),
  alsoOtherRole: z.boolean(),
  addresses: z.array(address),
});
export type PartyValues = z.infer<typeof partySchema>;

const trim = (s: string | null | undefined) =>
  s == null ? '' : s.includes('.') ? s.replace(/\.?0+$/, '') : s;

export const emptyParty = (type: 'customer' | 'supplier'): PartyValues => ({
  code: '',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  binNo: '',
  tinNo: '',
  groupId: NONE,
  creditLimit: '0',
  paymentTermsDays: 0,
  openingBalance: '0',
  openingBalanceType: type === 'customer' ? 'debit' : 'credit',
  notes: '',
  isActive: true,
  alsoOtherRole: false,
  addresses: [],
});

export const toPartyValues = (p: Party): PartyValues => ({
  code: p.code,
  name: p.name,
  contactPerson: p.contactPerson ?? '',
  phone: p.phone ?? '',
  email: p.email ?? '',
  binNo: p.binNo ?? '',
  tinNo: p.tinNo ?? '',
  groupId: p.groupId ?? NONE,
  creditLimit: trim(p.creditLimit),
  paymentTermsDays: p.paymentTermsDays,
  openingBalance: trim(p.openingBalance),
  openingBalanceType: p.openingBalanceType,
  notes: p.notes ?? '',
  isActive: p.isActive,
  alsoOtherRole: p.alsoOtherRole,
  addresses: p.addresses.map((a) => ({
    type: a.type,
    label: a.label ?? '',
    addressLine: a.addressLine,
    city: a.city ?? '',
    district: a.district ?? '',
    postalCode: a.postalCode ?? '',
    country: a.country ?? '',
    phone: a.phone ?? '',
    isDefault: a.isDefault,
  })),
});

const orNull = (s: string) => (s === NONE || !s.trim() ? null : s.trim());

export const toPartyPayload = (values: PartyValues) => ({
  ...values,
  code: values.code.trim() || undefined,
  contactPerson: orNull(values.contactPerson),
  phone: orNull(values.phone),
  email: orNull(values.email),
  binNo: orNull(values.binNo),
  tinNo: orNull(values.tinNo),
  groupId: orNull(values.groupId),
  notes: orNull(values.notes),
  addresses: values.addresses.map((a) => ({
    ...a,
    label: orNull(a.label),
    city: orNull(a.city),
    district: orNull(a.district),
    postalCode: orNull(a.postalCode),
    country: a.country.trim() || undefined,
    phone: orNull(a.phone),
  })),
});
