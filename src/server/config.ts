import type { AuthUserDto } from "../shared/types/api";

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  APP_URL?: string;
  SESSION_TTL_HOURS?: string;
  SESSION_IDLE_MINUTES?: string;
  TEST_MIGRATIONS?: Array<{ name: string; queries: string[] }>;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_REMINDERS_ENABLED?: string;
}

export interface SessionContext {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface AppVariables {
  user: AuthUserDto;
  session: SessionContext;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

const DEFAULT_TTL_HOURS = 168;
const DEFAULT_IDLE_MINUTES = 480;

function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function isProduction(env: Env): boolean {
  return env.ENVIRONMENT === "production";
}

export function getSessionTtlHours(env: Env): number {
  return parseInteger(env.SESSION_TTL_HOURS, DEFAULT_TTL_HOURS, 1, 720);
}

export function getSessionIdleMinutes(env: Env): number {
  return parseInteger(env.SESSION_IDLE_MINUTES, DEFAULT_IDLE_MINUTES, 5, 10080);
}

export function getEnvironmentLabel(env: Env): string {
  return env.ENVIRONMENT ?? "development";
}
