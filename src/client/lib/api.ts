import { CSRF_HEADER_NAME } from "../../shared/constants/app";
import type { ApiErrorBody, ApiSuccess } from "../../shared/types/api";

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    csrfToken
  ) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await response.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errorBody = parsed as ApiErrorBody | null;
    const error = new ApiError(
      response.status,
      errorBody?.error?.code ?? "request_failed",
      errorBody?.error?.message ?? "The request could not be completed.",
      errorBody?.error?.details,
    );

    if (response.status === 401 && path !== "/auth/login") {
      window.dispatchEvent(new Event("crm:unauthorized"));
    }

    throw error;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("data" in parsed)
  ) {
    throw new ApiError(
      500,
      "invalid_response",
      "The server returned an unexpected response.",
    );
  }

  return (parsed as ApiSuccess<T>).data;
}
