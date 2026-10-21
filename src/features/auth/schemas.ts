import { z } from 'zod';
import { v } from '@/lib/form';

export const loginSchema = z.object({
  email: v.email(),
  password: z.string().min(1, 'validation.required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: v.email() });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** New password + confirmation (reset and change-password forms). */
export const newPasswordSchema = z
  .object({ password: v.password(), confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: v.password(),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const profileSchema = z.object({
  name: v.required().max(150, 'validation.tooLong'),
  phone: v.phone(),
  language: z.enum(['en', 'bn']),
});
export type ProfileValues = z.infer<typeof profileSchema>;
