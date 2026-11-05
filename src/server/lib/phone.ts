const PHONE_ALLOWED = /^[+()\d\s.\-]+$/;

export interface NormalizedPhone {
  /** The trimmed value entered by the employee, preserved for display. */
  display: string;
  /** Digits only, used for duplicate detection, search and wa.me links. */
  normalized: string;
  /** Quick syntax check; Zod performs the authoritative validation. */
  valid: boolean;
}

export function normalizePhone(value: string): NormalizedPhone {
  const display = value.trim().replace(/\s+/g, " ");
  const normalized = display.replace(/\D/g, "");
  const valid =
    PHONE_ALLOWED.test(display) &&
    normalized.length >= 7 &&
    normalized.length <= 15;

  return { display, normalized, valid };
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPossiblePhoneMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }
  const a = digitsOnly(left);
  const b = digitsOnly(right);
  return a.length >= 7 && a === b;
}
