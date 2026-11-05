export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

/**
 * Shared, pure password policy used by both the API and the UI.
 * The server remains the source of truth; the client mirrors it for feedback.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Include a lowercase letter.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Include an uppercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Include a number.");
  }

  return { valid: errors.length === 0, errors };
}
