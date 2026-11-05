import { env, SELF } from "cloudflare:test";
import type {
  ApiErrorBody,
  ApiSuccess,
  AuthUserDto,
  LoginResponse,
} from "../src/shared/types/api";
import type { Role } from "../src/shared/types/roles";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
} from "../src/shared/constants/app";
import { hashPassword } from "../src/server/auth/password";
import { randomHex, sha256Hex } from "../src/server/lib/encoding";

export const BASE_URL = "https://example.com";
export const TEST_ORIGIN = BASE_URL;
export const TEST_PASSWORD = "Password#12345!";
export const NEW_PASSWORD = "NewPassword#12345!";

const passwordHashes = new Map<string, Promise<string>>();

function passwordHashFor(password: string): Promise<string> {
  let cached = passwordHashes.get(password);
  if (!cached) {
    cached = hashPassword(password);
    passwordHashes.set(password, cached);
  }
  return cached;
}

export interface TestUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
}

let userSequence = 0;

export async function createUser(options: {
  role?: Role;
  email?: string;
  fullName?: string;
  password?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
} = {}): Promise<TestUser> {
  userSequence += 1;
  const role = options.role ?? "employee";
  const password = options.password ?? TEST_PASSWORD;
  const email =
    options.email?.toLowerCase() ??
    `${role}.${userSequence}.${crypto.randomUUID().slice(0, 8)}@example.com`;
  const fullName =
    options.fullName ??
    `${role.charAt(0).toUpperCase()}${role.slice(1)} User ${userSequence}`;
  const id = crypto.randomUUID();
  const isActive = options.isActive ?? true;
  const mustChangePassword = options.mustChangePassword ?? false;

  await env.DB.prepare(
    `INSERT INTO users (id, full_name, email, password_hash, role, is_active, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      fullName,
      email,
      await passwordHashFor(password),
      role,
      isActive ? 1 : 0,
      mustChangePassword ? 1 : 0,
    )
    .run();

  return { id, fullName, email, password, role, isActive, mustChangePassword };
}

export interface AuthSession {
  cookie: string;
  csrfToken: string;
  sessionToken: string;
  user: AuthUserDto;
}

function readCookie(setCookies: string[], name: string): string | undefined {
  for (const header of setCookies) {
    const pair = header.split(";")[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = pair.slice(0, separator).trim();
    if (key === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return undefined;
}

export function cookieHeaderFrom(response: Response): {
  sessionToken: string;
  csrfToken: string;
  cookie: string;
  setCookies: string[];
} {
  const setCookies = response.headers.getSetCookie();
  const sessionToken = readCookie(setCookies, SESSION_COOKIE_NAME);
  const csrfToken = readCookie(setCookies, CSRF_COOKIE_NAME);

  if (!sessionToken || !csrfToken) {
    throw new Error("Login response did not set both auth cookies.");
  }

  return {
    sessionToken,
    csrfToken,
    cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
    setCookies,
  };
}

export async function login(
  email: string,
  password: string = TEST_PASSWORD,
): Promise<AuthSession> {
  const response = await SELF.fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      `Test login failed (${response.status}): ${await response.text()}`,
    );
  }

  const body = (await response.json()) as ApiSuccess<LoginResponse>;
  const cookies = cookieHeaderFrom(response);

  return {
    cookie: cookies.cookie,
    csrfToken: cookies.csrfToken,
    sessionToken: cookies.sessionToken,
    user: body.data.user,
  };
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: Pick<AuthSession, "cookie" | "csrfToken">;
  origin?: string | null;
  includeCsrf?: boolean;
  headers?: Record<string, string>;
}

export async function apiRequest(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);

  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? TEST_ORIGIN);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    headers.set("Cookie", options.auth.cookie);
    if (options.includeCsrf !== false && method !== "GET") {
      headers.set(CSRF_HEADER_NAME, options.auth.csrfToken);
    }
  }

  return SELF.fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function parseData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiSuccess<T>;
  return body.data;
}

export async function expectError(
  response: Response,
  status: number,
  code: string,
): Promise<ApiErrorBody> {
  const body = (await response.json()) as ApiErrorBody;
  if (response.status !== status || body.error.code !== code) {
    throw new Error(
      `Expected ${status} ${code}, received ${response.status} ${body.error.code}: ${body.error.message}`,
    );
  }
  return body;
}

export async function createSessionForUser(
  userId: string,
  options: { expiresAt?: string; lastActivityAt?: string } = {},
): Promise<string> {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      now,
      options.lastActivityAt ?? now,
    )
    .run();

  return token;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}`;
}
