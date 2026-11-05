import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../src/shared/constants/app";
import type { MeResponse } from "../src/shared/types/api";
import { sha256Hex } from "../src/server/lib/encoding";
import {
  NEW_PASSWORD,
  TEST_PASSWORD,
  apiRequest,
  cookieHeaderFrom,
  createSessionForUser,
  createUser,
  expectError,
  login,
  parseData,
  sessionCookie,
} from "./helpers";

describe("authentication", () => {
  it("logs in with valid credentials and stores only a hash of the session token", async () => {
    const user = await createUser({ role: "admin", email: "admin@example.com" });

    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: TEST_PASSWORD },
    });

    expect(response.status).toBe(200);
    const data = await parseData<{
      user: { id: string; email: string; permissions: string[] };
      csrfToken: string;
    }>(response);

    expect(data.user.id).toBe(user.id);
    expect(data.user.email).toBe(user.email);
    expect(data.user.permissions).toContain("users:read");
    expect(data.csrfToken).toMatch(/^[a-f0-9]{64}$/);

    const cookies = cookieHeaderFrom(response);
    expect(cookies.csrfToken).toBe(data.csrfToken);

    const sessionCookieHeader = cookies.setCookies.find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    const csrfCookieHeader = cookies.setCookies.find((cookie) =>
      cookie.startsWith(`${CSRF_COOKIE_NAME}=`),
    );

    expect(sessionCookieHeader).toContain("HttpOnly");
    expect(sessionCookieHeader).toContain("SameSite=Lax");
    expect(sessionCookieHeader).toContain("Secure");
    expect(csrfCookieHeader).not.toContain("HttpOnly");

    const row = await env.DB.prepare(
      "SELECT token_hash FROM sessions WHERE user_id = ?",
    )
      .bind(user.id)
      .first<{ token_hash: string }>();

    expect(row?.token_hash).toBe(await sha256Hex(cookies.sessionToken));
    expect(row?.token_hash).not.toBe(cookies.sessionToken);
  });

  it("returns the same generic error for unknown, wrong-password and inactive accounts", async () => {
    const user = await createUser();
    const inactive = await createUser({ isActive: false });

    const unknownResponse = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: "missing@example.com", password: TEST_PASSWORD },
    });
    const wrongResponse = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: "WrongPassword#123" },
    });
    const inactiveResponse = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: inactive.email, password: TEST_PASSWORD },
    });

    const unknown = await expectError(unknownResponse, 401, "invalid_credentials");
    const wrong = await expectError(wrongResponse, 401, "invalid_credentials");
    const inactiveAccount = await expectError(
      inactiveResponse,
      401,
      "invalid_credentials",
    );

    expect(unknown.error.message).toBe("Invalid email or password.");
    expect(wrong.error.message).toBe(unknown.error.message);
    expect(inactiveAccount.error.message).toBe(unknown.error.message);
  });

  it("rejects state-changing requests without a trusted Origin", async () => {
    const user = await createUser();

    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: TEST_PASSWORD },
      origin: null,
    });

    await expectError(response, 403, "invalid_origin");
  });

  it("requires authentication for /me and returns the CSRF token when authenticated", async () => {
    const user = await createUser({ role: "owner" });

    const unauthorized = await apiRequest("/api/auth/me");
    await expectError(unauthorized, 401, "unauthenticated");

    const auth = await login(user.email);
    const response = await apiRequest("/api/auth/me", { auth });

    expect(response.status).toBe(200);
    const data = await parseData<MeResponse>(response);
    expect(data.user.id).toBe(user.id);
    expect(data.user.permissions).toContain("audit:read");
    expect(data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("logs out, invalidates the session and records an audit entry", async () => {
    const user = await createUser();
    const auth = await login(user.email);

    const logout = await apiRequest("/api/auth/logout", {
      method: "POST",
      auth,
    });
    expect(logout.status).toBe(200);

    const me = await apiRequest("/api/auth/me", { auth });
    await expectError(me, 401, "unauthenticated");

    const count = await env.DB.prepare(
      "SELECT count(*) AS count FROM sessions WHERE user_id = ?",
    )
      .bind(user.id)
      .first<{ count: number }>();
    expect(Number(count?.count ?? 0)).toBe(0);

    const audit = await env.DB.prepare(
      "SELECT action FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(user.id)
      .first<{ action: string }>();
    expect(audit?.action).toBe("auth.logout");
  });

  it("rejects logout without a valid CSRF token and keeps the session usable", async () => {
    const user = await createUser();
    const auth = await login(user.email);

    const response = await apiRequest("/api/auth/logout", {
      method: "POST",
      auth,
      includeCsrf: false,
    });
    await expectError(response, 403, "csrf_failed");

    const me = await apiRequest("/api/auth/me", { auth });
    expect(me.status).toBe(200);
  });

  it("rejects an expired session and deletes it", async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const response = await apiRequest("/api/auth/me", {
      auth: { cookie: sessionCookie(token), csrfToken: "unused" },
    });
    await expectError(response, 401, "unauthenticated");

    const row = await env.DB.prepare(
      "SELECT count(*) AS count FROM sessions WHERE user_id = ?",
    )
      .bind(user.id)
      .first<{ count: number }>();
    expect(Number(row?.count ?? 0)).toBe(0);
  });

  it("rejects a session that exceeded the idle timeout", async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id, {
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      lastActivityAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    });

    const response = await apiRequest("/api/auth/me", {
      auth: { cookie: sessionCookie(token), csrfToken: "unused" },
    });
    await expectError(response, 401, "unauthenticated");
  });

  it("prevents session fixation by replacing an existing pre-login session", async () => {
    const user = await createUser();
    const first = await login(user.email);

    const secondResponse = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: TEST_PASSWORD },
      headers: { Cookie: first.cookie },
    });
    expect(secondResponse.status).toBe(200);
    const secondCookies = cookieHeaderFrom(secondResponse);

    const oldSession = await apiRequest("/api/auth/me", { auth: first });
    await expectError(oldSession, 401, "unauthenticated");

    const newSession = await apiRequest("/api/auth/me", {
      auth: {
        cookie: secondCookies.cookie,
        csrfToken: secondCookies.csrfToken,
      },
    });
    expect(newSession.status).toBe(200);
  });

  it("changes the password, clears the flag and invalidates every other session", async () => {
    const user = await createUser({ mustChangePassword: true });
    const auth = await login(user.email);

    const response = await apiRequest("/api/auth/change-password", {
      method: "POST",
      auth,
      body: {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
    });

    expect(response.status).toBe(200);
    const data = await parseData<{
      user: { mustChangePassword: boolean };
      csrfToken: string;
    }>(response);
    expect(data.user.mustChangePassword).toBe(false);

    const oldSession = await apiRequest("/api/auth/me", { auth });
    await expectError(oldSession, 401, "unauthenticated");

    const newCookies = cookieHeaderFrom(response);
    const newSession = await apiRequest("/api/auth/me", {
      auth: { cookie: newCookies.cookie, csrfToken: newCookies.csrfToken },
    });
    expect(newSession.status).toBe(200);

    const oldPasswordLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: TEST_PASSWORD },
    });
    await expectError(oldPasswordLogin, 401, "invalid_credentials");

    const newPasswordLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: NEW_PASSWORD },
    });
    expect(newPasswordLogin.status).toBe(200);
  });

  it("rejects reusing the current password as the new password", async () => {
    const user = await createUser();
    const auth = await login(user.email);

    const response = await apiRequest("/api/auth/change-password", {
      method: "POST",
      auth,
      body: {
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_PASSWORD,
      },
    });

    const error = await expectError(response, 400, "validation_error");
    expect(JSON.stringify(error.error.details)).toContain(
      "different from the current password",
    );
  });

  it("rate limits repeated failed logins for the same email", async () => {
    const user = await createUser();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password: "WrongPassword#123" },
      });
      await expectError(response, 401, "invalid_credentials");
    }

    const blocked = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: user.email, password: "WrongPassword#123" },
    });
    await expectError(blocked, 429, "too_many_attempts");
    expect(blocked.headers.get("Retry-After")).toBe("900");
  });
});
