import type { Context } from "hono";

export function getClientIp(c: Context): string | null {
  const cfIp = c.req.header("CF-Connecting-IP");
  if (cfIp) {
    return cfIp.trim();
  }

  const forwarded = c.req.header("X-Forwarded-For");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    return first || null;
  }

  return null;
}

export function isUnsafeMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}
