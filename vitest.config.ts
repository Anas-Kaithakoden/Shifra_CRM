import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.resolve(import.meta.dirname, "migrations"),
  );

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            // Test-only binding consumed by tests/setup.ts.
            TEST_MIGRATIONS: migrations,
            // Exercise the production cookie policy (Secure cookies).
            ENVIRONMENT: "production",
            APP_URL: "https://crm.shifranuhatech.com",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./tests/setup.ts"],
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  };
});
