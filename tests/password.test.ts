import { describe, expect, it } from "vitest";
import {
  PASSWORD_HASH_ITERATIONS,
  hashPassword,
  verifyPassword,
} from "../src/server/auth/password";
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordPolicy,
} from "../src/shared/constants/password";

describe("password hashing", () => {
  it("produces a versioned PBKDF2 hash and verifies the password", async () => {
    const hash = await hashPassword("CorrectHorse#123");
    const parts = hash.split("$");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2_sha256");
    expect(Number(parts[1])).toBe(PASSWORD_HASH_ITERATIONS);
    // Cloudflare Workers rejects PBKDF2 above 100,000 iterations in production.
    expect(PASSWORD_HASH_ITERATIONS).toBeLessThanOrEqual(100_000);
    expect(await verifyPassword("CorrectHorse#123", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("CorrectHorse#123");
    expect(await verifyPassword("correcthorse#123", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("uses a unique salt for every hash", async () => {
    const [first, second] = await Promise.all([
      hashPassword("SamePassword#123"),
      hashPassword("SamePassword#123"),
    ]);

    expect(first).not.toBe(second);
    expect(await verifyPassword("SamePassword#123", first)).toBe(true);
    expect(await verifyPassword("SamePassword#123", second)).toBe(true);
  });

  it("rejects malformed and unsafe hashes", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(
      await verifyPassword(
        "anything",
        "pbkdf2_sha256$1000$c2FsdA==$aGFzaA==",
      ),
    ).toBe(false);
    expect(
      await verifyPassword(
        "anything",
        "argon2id$600000$c2FsdA==$aGFzaA==",
      ),
    ).toBe(false);
  });
});

describe("shared password policy", () => {
  it("requires length, mixed case and a number", () => {
    expect(checkPasswordPolicy("short").valid).toBe(false);
    expect(checkPasswordPolicy("alllowercase123").valid).toBe(false);
    expect(checkPasswordPolicy("ALLUPPERCASE123").valid).toBe(false);
    expect(checkPasswordPolicy("NoNumbersHere").valid).toBe(false);
    expect(
      checkPasswordPolicy(`Abcdefghij1${"x".repeat(PASSWORD_MIN_LENGTH)}`)
        .valid,
    ).toBe(true);
  });
});
