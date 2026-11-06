import { Hono, type Context } from "hono";
import type { LoginResponse, MeResponse } from "../../shared/types/api";
import {
  clearAuthCookies,
  getCsrfCookie,
  getSessionToken,
  setAuthCookies,
  setCsrfCookie,
} from "../auth/cookies";
import { deleteSessionById, findSessionWithUser } from "../db/queries/sessions.queries";
import { createDb } from "../db/client";
import type { AppEnv } from "../config";
import { getSessionTtlHours } from "../config";
import { randomHex, sha256Hex } from "../lib/encoding";
import { unauthenticated } from "../lib/errors";
import { getClientIp } from "../lib/request";
import { ok } from "../lib/response";
import { parseJson } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import {
  changePasswordSchema,
  loginSchema,
  updateProfileSchema,
} from "../schemas/auth.schema";
import {
  changePassword,
  login,
  recordLogout,
  updateOwnProfile,
} from "../services/auth.service";
import { toAuthUserDto } from "../services/mappers";

export const authRoutes = new Hono<AppEnv>();

function ensureCsrfToken(
  c: Context,
  env: AppEnv["Bindings"],
): string {
  const existing = getCsrfCookie(c);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) {
    return existing;
  }

  const token = randomHex(32);
  setCsrfCookie(c, token, env, getSessionTtlHours(env));
  return token;
}

authRoutes.post("/login", async (c) => {
  const input = await parseJson(c, loginSchema);
  const db = createDb(c.env.DB);
  const ipAddress = getClientIp(c);
  const ttlHours = getSessionTtlHours(c.env);

  const result = await login(
    db,
    input,
    ipAddress,
    ttlHours,
    c.env.AUTH_DIAGNOSTICS === "true",
  );

  // Session fixation defence: never carry a pre-authentication session into
  // the authenticated session.
  const existingToken = getSessionToken(c);
  if (existingToken) {
    const existing = await findSessionWithUser(db, await sha256Hex(existingToken));
    if (existing) {
      await deleteSessionById(db, existing.session.id);
    }
  }

  setAuthCookies(
    c,
    {
      sessionToken: result.token,
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt,
    },
    c.env,
    ttlHours,
  );

  const body: LoginResponse = {
    user: toAuthUserDto(result.user),
    csrfToken: result.csrfToken,
  };

  return ok(c, body);
});

authRoutes.get("/me", requireAuth, async (c) => {
  const csrfToken = ensureCsrfToken(c, c.env);
  const body: MeResponse = {
    user: c.get("user"),
    csrfToken,
  };
  return ok(c, body);
});

authRoutes.post("/logout", requireAuth, requireCsrf, async (c) => {
  const session = c.get("session");
  const user = c.get("user");
  const db = createDb(c.env.DB);

  await deleteSessionById(db, session.id);
  await recordLogout(db, user.id, getClientIp(c));
  clearAuthCookies(c);

  return ok(c, { success: true });
});

authRoutes.post(
  "/change-password",
  requireAuth,
  requireCsrf,
  async (c) => {
    const input = await parseJson(c, changePasswordSchema);
    const db = createDb(c.env.DB);
    const user = c.get("user");
    const ttlHours = getSessionTtlHours(c.env);

    const result = await changePassword(
      db,
      user.id,
      input,
      getClientIp(c),
      ttlHours,
    );

    setAuthCookies(
      c,
      {
        sessionToken: result.token,
        csrfToken: result.csrfToken,
        expiresAt: result.expiresAt,
      },
      c.env,
      ttlHours,
    );

    const body: LoginResponse = {
      user: toAuthUserDto(result.user),
      csrfToken: result.csrfToken,
    };

    return ok(c, body);
  },
);

authRoutes.patch("/profile", requireAuth, requireCsrf, async (c) => {
  const input = await parseJson(c, updateProfileSchema);
  const db = createDb(c.env.DB);
  const user = c.get("user");

  if (!user) {
    throw unauthenticated();
  }

  const updated = await updateOwnProfile(
    db,
    user.id,
    input.fullName,
    getClientIp(c),
  );

  return ok(c, { user: toAuthUserDto(updated) });
});
