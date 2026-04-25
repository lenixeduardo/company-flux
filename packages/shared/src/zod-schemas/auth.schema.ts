import { z } from 'zod';
import { TaxRegime } from '../constants/tax-regimes.js';

/**
 * Validates a Brazilian CNPJ number.
 * Accepts formatted (XX.XXX.XXX/XXXX-XX) or raw (14 digits) input.
 */
function validateCnpj(cnpj: string): boolean {
  const raw = cnpj.replace(/[^\d]/g, '');

  if (raw.length !== 14) return false;

  // Reject known invalid sequences
  if (/^(\d)\1+$/.test(raw)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split('')
      .reduce((acc, digit, i) => acc + parseInt(digit, 10) * (weights[i] ?? 0), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digit1 = calcDigit(raw.slice(0, 12), weights1);
  const digit2 = calcDigit(raw.slice(0, 13), weights2);

  return parseInt(raw[12] ?? '', 10) === digit1 && parseInt(raw[13] ?? '', 10) === digit2;
}

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  companyName: z.string().min(1, 'Company name is required').max(200),
  cnpj: z
    .string()
    .min(1, 'CNPJ is required')
    .refine(validateCnpj, { message: 'Invalid CNPJ' }),
  taxRegime: z.nativeEnum(TaxRegime).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
