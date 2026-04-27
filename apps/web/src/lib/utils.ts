import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-BR', options ?? { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function formatCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function maskCNPJ(value: string): string {
  const clean = value.replace(/\D/g, '').substring(0, 14);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return clean.replace(/(\d{2})(\d+)/, '$1.$2');
  if (clean.length <= 8) return clean.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (clean.length <= 12) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
