import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    options?: { details?: unknown; headers?: Record<string, string> },
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.headers = options?.headers;
  }
}

export const unauthenticated = () =>
  new AppError(401, "unauthenticated", "Authentication is required.");

export const forbidden = (message = "You do not have permission to perform this action.") =>
  new AppError(403, "forbidden", message);

export const notFound = (message = "The requested resource was not found.") =>
  new AppError(404, "not_found", message);

export const conflict = (
  code: string,
  message: string,
  details?: unknown,
) => new AppError(409, code, message, { details });

export const badRequest = (
  code: string,
  message: string,
  details?: unknown,
) => new AppError(400, code, message, { details });
