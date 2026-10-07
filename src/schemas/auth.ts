import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, { message: 'Enter an email or phone number.' }),
  password: z.string().min(1, { message: 'Enter a password.' }),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, { message: 'Display name must be at least 2 characters.' }),
  email: z.string().trim().min(1, { message: 'Enter an email or phone number.' }),
  password: z.string().min(1, { message: 'Enter a password.' }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, { message: 'Enter an email or phone number.' }),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required.' }),
  password: z.string().min(1, { message: 'Enter a password.' }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
