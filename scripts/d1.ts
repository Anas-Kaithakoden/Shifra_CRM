import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER_ENTRY = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);

export const DATABASE_NAME = "shifra-nuha-crm";

interface D1ExecuteResult {
  results?: Array<Record<string, unknown>>;
  success?: boolean;
  error?: string;
}

function wranglerCommand(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [WRANGLER_ENTRY, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      WRANGLER_SEND_METRICS: "false",
    },
  });
}

function parseJsonOutput(stdout: string): D1ExecuteResult[] {
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error(`Unexpected Wrangler output:\n${stdout}`);
  }

  return JSON.parse(stdout.slice(start)) as D1ExecuteResult[];
}

export function runD1Query<T extends Record<string, unknown>>(
  sql: string,
  options: { local: boolean },
): T[] {
  const args = [
    "d1",
    "execute",
    DATABASE_NAME,
    options.local ? "--local" : "--remote",
    "--command",
    sql,
    "--json",
  ];

  const result = wranglerCommand(args);
  if (result.status !== 0) {
    throw new Error(
      `Wrangler D1 query failed:\n${result.stderr || result.stdout || "Unknown error"}`,
    );
  }

  const parsed = parseJsonOutput(String(result.stdout));
  const first = parsed[0];
  if (!first || first.success === false) {
    throw new Error(first?.error ?? "Wrangler D1 query failed.");
  }

  return (first.results ?? []) as T[];
}

export function runD1File(
  sql: string,
  options: { local: boolean },
): void {
  const tempFile = path.join(tmpdir(), `shifra-crm-${randomUUID()}.sql`);
  writeFileSync(tempFile, sql, { encoding: "utf8" });

  try {
    const args = [
      "d1",
      "execute",
      DATABASE_NAME,
      options.local ? "--local" : "--remote",
      "--file",
      tempFile,
    ];

    const result = wranglerCommand(args);
    if (result.status !== 0) {
      throw new Error(
        `Wrangler D1 execution failed:\n${result.stderr || result.stdout || "Unknown error"}`,
      );
    }
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // Best-effort cleanup; the OS temp directory is safe either way.
    }
  }
}

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
}

export function assertUsersTableExists(local: boolean): void {
  const rows = runD1Query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1;",
    { local },
  );

  if (rows.length === 0) {
    throw new Error(
      [
        "The users table does not exist in the target database.",
        "Run the migrations first:",
        local
          ? "  npm run db:migrate:local"
          : "  npm run db:migrate:remote",
      ].join("\n"),
    );
  }
}

export function findExistingOwner(local: boolean): {
  id: string;
  email: string;
} | null {
  const rows = runD1Query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE role = 'owner' LIMIT 1;",
    { local },
  );
  return rows[0] ?? null;
}
