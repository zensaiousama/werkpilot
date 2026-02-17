// Form validation utilities

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Swiss phone format
  return /^(\+41|0)\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(phone.replace(/\s/g, ''));
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateFitnessCheckForm(data: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isNotEmpty(data.firmenname || '')) {
    errors.firmenname = 'Bitte geben Sie Ihren Firmennamen ein';
  }
  if (!isNotEmpty(data.branche || '')) {
    errors.branche = 'Bitte wählen Sie eine Branche';
  }
  if (!isNotEmpty(data.kanton || '')) {
    errors.kanton = 'Bitte wählen Sie einen Kanton';
  }
  if (!isNotEmpty(data.name || '')) {
    errors.name = 'Bitte geben Sie Ihren Namen ein';
  }
  if (!isValidEmail(data.email || '')) {
    errors.email = 'Bitte geben Sie eine gültige Email-Adresse ein';
  }
  if (data.telefon && !isValidPhone(data.telefon)) {
    errors.telefon = 'Bitte geben Sie eine gültige Telefonnummer ein';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
