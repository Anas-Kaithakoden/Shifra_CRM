import {
  base64ToBytes,
  bytesToBase64,
  timingSafeEqualBytes,
} from "../lib/encoding";

const ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 600_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    KEY_BITS,
  );

  return new Uint8Array(bits);
}

/**
 * Hash a password using PBKDF2-HMAC-SHA256 (Web Crypto).
 *
 * Argon2id is not natively available in the Workers runtime. PBKDF2 with
 * 600,000 iterations follows the current OWASP recommendation for
 * PBKDF2-HMAC-SHA256. The iteration count is stored in the hash so it can be
 * upgraded later without breaking existing accounts.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);

  return [
    ALGORITHM,
    String(ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 4) {
      return false;
    }

    const [algorithm, iterationsRaw, saltRaw, hashRaw] = parts;
    if (algorithm !== ALGORITHM) {
      return false;
    }

    const iterations = Number.parseInt(iterationsRaw ?? "", 10);
    if (!Number.isInteger(iterations) || iterations < 100_000) {
      return false;
    }

    const salt = base64ToBytes(saltRaw ?? "");
    const expected = base64ToBytes(hashRaw ?? "");
    if (salt.length < 8 || expected.length !== KEY_BITS / 8) {
      return false;
    }

    const actual = await derive(password, salt, iterations);
    return timingSafeEqualBytes(actual, expected);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * A valid, expensive hash used to equalise login timing when an email does not
 * exist. The value is random and is never associated with a real account.
 */
export function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      `dummy-${crypto.randomUUID()}-${crypto.randomUUID()}`,
    );
  }
  return dummyHashPromise;
}
