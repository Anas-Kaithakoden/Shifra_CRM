import type { MiddlewareHandler } from "hono";
import { CSRF_HEADER_NAME } from "../../shared/constants/app";
import { getCsrfCookie } from "../auth/cookies";
import type { AppEnv } from "../config";
import { timingSafeEqualStrings } from "../lib/encoding";
import { AppError } from "../lib/errors";
import { isUnsafeMethod } from "../lib/request";

export const requireCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isUnsafeMethod(c.req.method)) {
    await next();
    return;
  }

  const cookieToken = getCsrfCookie(c);
  const headerToken = c.req.header(CSRF_HEADER_NAME);

  if (
    !cookieToken ||
    !headerToken ||
    !timingSafeEqualStrings(cookieToken, headerToken)
  ) {
    throw new AppError(
      403,
      "csrf_failed",
      "Your session security token is missing or invalid. Refresh the page and try again.",
    );
  }

  await next();
};
