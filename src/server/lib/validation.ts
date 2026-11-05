import type { Context } from "hono";
import { z } from "zod";
import { badRequest } from "./errors";

function formatIssues(error: z.ZodError): Array<{
  path: string;
  message: string;
}> {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "_root",
    message: issue.message,
  }));
}

export async function parseJson<T>(
  c: Context,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("invalid_json", "Request body must be valid JSON.");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest(
      "validation_error",
      "Please correct the highlighted fields.",
      formatIssues(result.error),
    );
  }

  return result.data;
}

export function parseQuery<T>(
  c: Context,
  schema: z.ZodType<T>,
): T {
  const params = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    throw badRequest(
      "validation_error",
      "Invalid query parameters.",
      formatIssues(result.error),
    );
  }

  return result.data;
}

export function parseParams<T>(
  c: Context,
  schema: z.ZodType<T>,
): T {
  const result = schema.safeParse(c.req.param());
  if (!result.success) {
    throw badRequest(
      "validation_error",
      "Invalid route parameters.",
      formatIssues(result.error),
    );
  }

  return result.data;
}
