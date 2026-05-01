const PHONE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function isValidPassword(value: string): boolean {
  return PASSWORD_REGEX.test(value);
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export function getPasswordStrength(value: string): PasswordStrength {
  if (value.length < 6) return 'weak';
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const score = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (value.length >= 10 && score >= 3) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
}

export const STORY_CONTENT_MIN = 100;
export const STORY_CONTENT_MAX = 800;
export const STORY_TITLE_MAX = 30;

export function isValidStoryContent(value: string): boolean {
  const len = value.length;
  return len >= STORY_CONTENT_MIN && len <= STORY_CONTENT_MAX;
}
