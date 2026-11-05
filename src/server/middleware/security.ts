import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../config";
import { AppError } from "../lib/errors";
import { isUnsafeMethod } from "../lib/request";

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  c.header("Cache-Control", "no-store");
};

/**
 * Origin-based CSRF defence for state-changing requests. This is layered on top
 * of the double-submit token check used by authenticated mutations.
 */
export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isUnsafeMethod(c.req.method)) {
    await next();
    return;
  }

  const origin = c.req.header("Origin");
  const allowedOrigins = new Set<string>([new URL(c.req.url).origin]);

  if (c.env.APP_URL) {
    try {
      allowedOrigins.add(new URL(c.env.APP_URL).origin);
    } catch {
      // Ignore malformed configuration rather than widening the allow-list.
    }
  }

  if (!origin || !allowedOrigins.has(origin)) {
    throw new AppError(
      403,
      "invalid_origin",
      "This request did not originate from the CRM.",
    );
  }

  await next();
};
