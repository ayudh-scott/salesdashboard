import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(d);
}

/**
 * Format number in Indian numbering system (lakhs and crores)
 * Examples: 1000 -> ₹1,000 | 100000 -> ₹1,00,000 | 10000000 -> ₹1,00,00,000
 */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Format number in Indian numbering system with compact notation for large numbers
 * Examples: 1000 -> ₹1,000 | 100000 -> ₹1 Lakh | 10000000 -> ₹1 Crore
 */
export function formatINRCompact(amount: number): string {
  if (amount >= 10000000) {
    // Crores
    const crores = amount / 10000000;
    return `₹${crores.toFixed(crores % 1 === 0 ? 0 : 1)} Cr`;
  } else if (amount >= 100000) {
    // Lakhs
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(lakhs % 1 === 0 ? 0 : 1)} L`;
  } else if (amount >= 1000) {
    // Thousands
    const thousands = amount / 1000;
    return `₹${thousands.toFixed(thousands % 1 === 0 ? 0 : 1)} K`;
  }
  return formatINR(amount);
}

