/**
 * Normalize user input to E.164 for Supabase phone OTP.
 * Default country code India (+91) when 10 digits are entered.
 */
export function toE164Phone(input: string, defaultCountryCode = '91'): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) {
    return digits.length >= 10 ? `+${digits}` : null;
  }

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}
