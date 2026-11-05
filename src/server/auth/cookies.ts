import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../../shared/constants/app";
import { isProduction, type Env } from "../config";

export interface AuthCookies {
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
}

function cookieOptions(env: Env, maxAgeSeconds: number) {
  return {
    secure: isProduction(env),
    sameSite: "Lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function setAuthCookies(
  c: Context,
  cookies: AuthCookies,
  env: Env,
  ttlHours: number,
): void {
  const maxAge = Math.max(60, Math.floor(ttlHours * 60 * 60));
  const options = cookieOptions(env, maxAge);

  setCookie(c, SESSION_COOKIE_NAME, cookies.sessionToken, {
    ...options,
    httpOnly: true,
    expires: new Date(cookies.expiresAt),
  });

  // The CSRF token is intentionally readable by the SPA (double-submit cookie)
  // but is never used as an authentication credential on its own.
  setCookie(c, CSRF_COOKIE_NAME, cookies.csrfToken, {
    ...options,
    httpOnly: false,
    expires: new Date(cookies.expiresAt),
  });
}

export function setCsrfCookie(
  c: Context,
  csrfToken: string,
  env: Env,
  ttlHours: number,
): void {
  const maxAge = Math.max(60, Math.floor(ttlHours * 60 * 60));
  setCookie(c, CSRF_COOKIE_NAME, csrfToken, {
    ...cookieOptions(env, maxAge),
    httpOnly: false,
  });
}

export function clearAuthCookies(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  deleteCookie(c, CSRF_COOKIE_NAME, { path: "/" });
}

export function getSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function getCsrfCookie(c: Context): string | undefined {
  return getCookie(c, CSRF_COOKIE_NAME);
}
