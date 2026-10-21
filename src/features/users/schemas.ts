import { z } from 'zod';
import { v } from '@/lib/form';

/** Create requires a password; edit treats an empty password as "unchanged". */
export function userFormSchema(isEdit: boolean) {
  return z
    .object({
      name: v.required().min(2, 'validation.required').max(150, 'validation.tooLong'),
      email: v.email(),
      phone: v.phone(),
      password: isEdit ? z.union([z.literal(''), v.password()]) : v.password(),
      language: z.enum(['en', 'bn']),
      active: z.boolean(),
      roleIds: z.array(z.string()).min(1, 'validation.selectRole'),
      branchIds: z.array(z.string()).min(1, 'validation.selectBranch'),
      defaultBranchId: z.string().nullable(),
    })
    .refine((d) => !d.defaultBranchId || d.branchIds.includes(d.defaultBranchId), {
      path: ['defaultBranchId'],
      message: 'validation.defaultBranch',
    });
}

export type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;
