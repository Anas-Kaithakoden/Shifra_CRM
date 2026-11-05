import { hashPassword } from "../src/server/auth/password";
import {
  assertUsersTableExists,
  runD1File,
  runD1Query,
  sqlJson,
  sqlString,
} from "./d1";

interface SeedUser {
  id: string;
  fullName: string;
  email: string;
  role: "owner" | "admin" | "employee";
  password: string;
}

const SEED_USERS: SeedUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Amina Yusuf",
    email: "owner@shifranuha.dev",
    role: "owner",
    password: "Owner#12345!",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    fullName: "Daniel Okafor",
    email: "admin@shifranuha.dev",
    role: "admin",
    password: "Admin#12345!",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Grace Bello",
    email: "employee@shifranuha.dev",
    role: "employee",
    password: "Employee#12345!",
  },
];

async function main(): Promise<void> {
  if (process.argv.includes("--remote")) {
    throw new Error(
      "The development seed is local-only. It refuses to write to a remote database.",
    );
  }

  assertUsersTableExists(true);

  const baseTime = Date.now();
  const userCreatedAt = new Date(baseTime - 10 * 60 * 1000).toISOString();

  const passwordHashes = await Promise.all(
    SEED_USERS.map((user) => hashPassword(user.password)),
  );

  const statements: string[] = [];

  SEED_USERS.forEach((user, index) => {
    statements.push(
      [
        "INSERT OR IGNORE INTO users (",
        "  id, full_name, email, password_hash, role, is_active,",
        "  must_change_password, created_at, updated_at, last_login_at",
        ") VALUES (",
        [
          sqlString(user.id),
          sqlString(user.fullName),
          sqlString(user.email),
          sqlString(passwordHashes[index] ?? ""),
          sqlString(user.role),
          "1",
          "0",
          sqlString(userCreatedAt),
          sqlString(userCreatedAt),
          "NULL",
        ].join(", "),
        ");",
      ].join("\n"),
    );
  });

  // Resolve the actual IDs after insert so audit rows remain valid even if a
  // seed user already existed with a different ID.
  const emailList = SEED_USERS.map((user) => sqlString(user.email)).join(", ");
  const existing = runD1Query<{ id: string; email: string; role: string }>(
    `SELECT id, email, role FROM users WHERE email IN (${emailList});`,
    { local: true },
  );
  const byEmail = new Map(existing.map((row) => [row.email, row]));

  const owner = byEmail.get("owner@shifranuha.dev");
  if (owner) {
    SEED_USERS.forEach((user, index) => {
      const row = byEmail.get(user.email);
      if (!row) {
        return;
      }
      const createdAt = new Date(
        baseTime - (5 - index) * 60 * 1000,
      ).toISOString();
      const auditId = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`;
      statements.push(
        [
          "INSERT OR IGNORE INTO audit_logs (",
          "  id, user_id, action, entity_type, entity_id, metadata, ip_address, created_at",
          ") VALUES (",
          [
            sqlString(auditId),
            sqlString(owner.id),
            "'user.created'",
            "'user'",
            sqlString(row.id),
            sqlJson({ email: row.email, role: row.role, seeded: true }),
            "NULL",
            sqlString(createdAt),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    });
  }

  const now = new Date().toISOString();
  const settings: Array<[string, string]> = [
    ["company_name", "Shifra Nuha Technologies"],
    ["company_email", ""],
    ["company_phone", ""],
    ["company_website", "https://shifranuhatech.com"],
    ["timezone", "UTC"],
    ["currency", "USD"],
  ];

  for (const [key, value] of settings) {
    statements.push(
      `INSERT OR IGNORE INTO app_settings (key, value, updated_at, updated_by) VALUES (${sqlString(
        key,
      )}, ${sqlString(value)}, ${sqlString(now)}, ${
        owner ? sqlString(owner.id) : "NULL"
      });`,
    );
  }

  runD1File(statements.join("\n"), { local: true });

  console.log("");
  console.log("Development data seeded into the LOCAL D1 database.");
  console.log("");
  console.log("  Role      Email                      Password");
  console.log("  --------  -------------------------  ----------------");
  for (const user of SEED_USERS) {
    console.log(
      `  ${user.role.padEnd(8)}  ${user.email.padEnd(25)}  ${user.password}`,
    );
  }
  console.log("");
  console.log("These credentials are for local development only.");
  console.log("Never use them in staging or production.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Development seed failed.",
  );
  process.exitCode = 1;
});
