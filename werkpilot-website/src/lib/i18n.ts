// Internationalization utilities for future multi-language support

export type Locale = 'de-CH' | 'fr-CH' | 'it-CH' | 'en';

export const DEFAULT_LOCALE: Locale = 'de-CH';

export const LOCALE_NAMES: Record<Locale, string> = {
  'de-CH': 'Deutsch',
  'fr-CH': 'Français',
  'it-CH': 'Italiano',
  'en': 'English',
};

// Detect user's preferred locale
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const languages = navigator.languages || [navigator.language];

  for (const lang of languages) {
    const lower = lang.toLowerCase();
    if (lower.startsWith('fr')) return 'fr-CH';
    if (lower.startsWith('it')) return 'it-CH';
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('de')) return 'de-CH';
  }

  return DEFAULT_LOCALE;
}

// Number formatting
export function formatCurrency(amount: number, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(num);
}

export function formatDate(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatRelativeTime(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diff = date.getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);

  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(days, 'day');
}
