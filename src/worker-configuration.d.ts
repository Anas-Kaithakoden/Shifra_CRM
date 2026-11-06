/**
 * Project-specific bindings available on `env` (including the test-only
 * migrations binding used by the Vitest setup file).
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ENVIRONMENT?: string;
    AUTH_DIAGNOSTICS?: string;
    APP_URL?: string;
    SESSION_TTL_HOURS?: string;
    SESSION_IDLE_MINUTES?: string;
    TEST_MIGRATIONS?: Array<{ name: string; queries: string[] }>;
  }
}
