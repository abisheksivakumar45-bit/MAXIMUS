/**
 * Client-side validation for the authentication forms.
 *
 * The backend enforces the same rules and is the source of truth; these
 * checks exist only to give immediate, accessible feedback. Messages are
 * written to match the backend's wording so users see one consistent story.
 */

export const DISPLAY_NAME_MAX_LENGTH = 120;
export const PASSWORD_MIN_LENGTH = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Display name is required.';
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Email is required.';
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Enter a valid email address.';
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(value)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must contain at least one number.';
  }
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) {
    return 'Confirm your password.';
  }
  if (password !== confirmation) {
    return 'Passwords do not match.';
  }
  return null;
}
