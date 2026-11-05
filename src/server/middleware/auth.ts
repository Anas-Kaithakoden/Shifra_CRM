import type { MiddlewareHandler } from "hono";
import type { Permission } from "../../shared/types/permissions";
import type { Role } from "../../shared/types/roles";
import { getSessionToken } from "../auth/cookies";
import { resolveSession } from "../auth/session";
import { getSessionIdleMinutes, type AppEnv } from "../config";
import { createDb } from "../db/client";
import { forbidden, unauthenticated } from "../lib/errors";
import { toAuthUserDto } from "../services/mappers";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getSessionToken(c);
  if (!token) {
    throw unauthenticated();
  }

  const db = createDb(c.env.DB);
  const resolved = await resolveSession(db, token, getSessionIdleMinutes(c.env));

  if (!resolved) {
    throw unauthenticated();
  }

  c.set("user", toAuthUserDto(resolved.user));
  c.set("session", {
    id: resolved.session.id,
    userId: resolved.session.userId,
    expiresAt: resolved.session.expiresAt,
  });

  await next();
};

export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      throw unauthenticated();
    }
    if (!roles.includes(user.role)) {
      throw forbidden();
    }
    await next();
  };
}

export function requirePermission(
  permission: Permission,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      throw unauthenticated();
    }
    if (!user.permissions.includes(permission)) {
      throw forbidden();
    }
    await next();
  };
}
