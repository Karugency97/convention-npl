import { clsx, type ClassValue } from 'clsx';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DossierStatus, PaiementStatus, ChequeStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMMM yyyy', { locale: fr });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "d MMMM yyyy 'à' HH:mm", { locale: fr });
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('33') && cleaned.length === 11) {
    const number = cleaned.slice(2);
    return `+33 ${number.slice(0, 1)} ${number.slice(1, 3)} ${number.slice(3, 5)} ${number.slice(5, 7)} ${number.slice(7, 9)}`;
  }
  return phone;
}

export const dossierStatusConfig: Record<
  DossierStatus,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: {
    label: 'Brouillon',
    color: 'var(--ink-500)',
    bgColor: 'var(--ink-100)',
  },
  SENT: {
    label: 'En attente de signature',
    color: 'var(--gold-600)',
    bgColor: 'var(--gold-300)',
  },
  SIGNED: {
    label: 'Signé',
    color: 'var(--emerald-600)',
    bgColor: '#d1fae5',
  },
  PAYMENT_PENDING: {
    label: 'Paiement en attente',
    color: 'var(--gold-600)',
    bgColor: 'var(--gold-300)',
  },
  PAID: {
    label: 'Payé',
    color: 'var(--emerald-700)',
    bgColor: '#a7f3d0',
  },
  CANCELLED: {
    label: 'Annulé',
    color: 'var(--ink-400)',
    bgColor: 'var(--ink-100)',
  },
};

export const paiementStatusConfig: Record<
  PaiementStatus,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: 'En attente',
    color: 'var(--gold-600)',
    bgColor: 'var(--gold-300)',
  },
  COMPLETED: {
    label: 'Complété',
    color: 'var(--emerald-600)',
    bgColor: '#d1fae5',
  },
  FAILED: {
    label: 'Échoué',
    color: 'var(--crimson-600)',
    bgColor: '#fee2e2',
  },
  REFUNDED: {
    label: 'Remboursé',
    color: 'var(--ink-500)',
    bgColor: 'var(--ink-100)',
  },
};

export const chequeStatusConfig: Record<
  ChequeStatus,
  { label: string; color: string; bgColor: string }
> = {
  ATTENDU: {
    label: 'Attendu',
    color: 'var(--gold-600)',
    bgColor: 'var(--gold-300)',
  },
  RECU: {
    label: 'Reçu',
    color: 'var(--azure-600)',
    bgColor: '#dbeafe',
  },
  ENCAISSE: {
    label: 'Encaissé',
    color: 'var(--emerald-600)',
    bgColor: '#d1fae5',
  },
  REJETE: {
    label: 'Rejeté',
    color: 'var(--crimson-600)',
    bgColor: '#fee2e2',
  },
};
