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

  seedTasksLocal(byEmail);

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

function seedTasksLocal(byEmail: Map<string, { id: string; email: string; role: string }>): void {
  try {
    const hasTasks = runD1Query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks' LIMIT 1;",
      { local: true },
    );
    if (hasTasks.length === 0) return;
  } catch {
    return;
  }

  const owner = byEmail.get("owner@shifranuha.dev");
  const admin = byEmail.get("admin@shifranuha.dev");
  const employee = byEmail.get("employee@shifranuha.dev");
  if (!owner) return;

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const day = 24 * 60 * 60 * 1000;

  const demo = [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001",
      num: "SN-TASK-9001",
      title: "Demo: overdue internal follow-up",
      description: "Seeded overdue task for dashboard/reminder testing.",
      task_type: "follow_up",
      status: "pending",
      priority: "high",
      assigned_to: owner.id,
      created_by: owner.id,
      due_at: iso(now - 2 * day),
      completed_at: null,
      cancelled_at: null,
      reminder_enabled: 1,
      reminder_minutes_before: 30,
      reminder_status: "pending",
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_end_at: null,
      recurrence_group_id: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002",
      num: "SN-TASK-9002",
      title: "Demo: due today review",
      description: "Seeded task due today.",
      task_type: "review",
      status: "pending",
      priority: "medium",
      assigned_to: admin?.id ?? owner.id,
      created_by: owner.id,
      due_at: iso(now + 2 * 60 * 60 * 1000),
      completed_at: null,
      cancelled_at: null,
      reminder_enabled: 1,
      reminder_minutes_before: 15,
      reminder_status: "pending",
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_end_at: null,
      recurrence_group_id: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003",
      num: "SN-TASK-9003",
      title: "Demo: upcoming call",
      description: "Seeded upcoming task.",
      task_type: "call",
      status: "in_progress",
      priority: "low",
      assigned_to: employee?.id ?? owner.id,
      created_by: admin?.id ?? owner.id,
      due_at: iso(now + 3 * day),
      completed_at: null,
      cancelled_at: null,
      reminder_enabled: 0,
      reminder_minutes_before: null,
      reminder_status: "skipped",
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_end_at: null,
      recurrence_group_id: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0004",
      num: "SN-TASK-9004",
      title: "Demo: completed follow-up",
      description: "Seeded completed task.",
      task_type: "follow_up",
      status: "completed",
      priority: "urgent",
      assigned_to: owner.id,
      created_by: owner.id,
      due_at: iso(now - 1 * day),
      completed_at: iso(now - 12 * 60 * 60 * 1000),
      cancelled_at: null,
      reminder_enabled: 1,
      reminder_minutes_before: 10,
      reminder_status: "sent",
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_end_at: null,
      recurrence_group_id: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0005",
      num: "SN-TASK-9005",
      title: "Demo: recurring daily check-in",
      description: "Seeded recurring task with recurrence group.",
      task_type: "internal",
      status: "pending",
      priority: "medium",
      assigned_to: owner.id,
      created_by: owner.id,
      due_at: iso(now + 1 * day),
      completed_at: null,
      cancelled_at: null,
      reminder_enabled: 1,
      reminder_minutes_before: 60,
      reminder_status: "pending",
      recurrence_type: "daily",
      recurrence_interval: 1,
      recurrence_end_at: iso(now + 30 * day),
      recurrence_group_id: "cccccccc-cccc-4ccc-8ccc-cccccccc0001",
    },
  ] as const;

  const statements: string[] = [];
  for (const t of demo) {
    statements.push(
      [
        "INSERT OR IGNORE INTO tasks (",
        "id, task_number, title, description, task_type, status, priority, assigned_to, created_by, lead_id, customer_id, project_id,",
        "due_at, completed_at, cancelled_at, reminder_enabled, reminder_minutes_before, reminder_sent_at, reminder_attempted_at, reminder_status, reminder_error,",
        "recurrence_type, recurrence_interval, recurrence_end_at, recurrence_group_id, created_at, updated_at",
        ") VALUES (",
        [
          sqlString(t.id), sqlString(t.num), sqlString(t.title), sqlString(t.description), sqlString(t.task_type), sqlString(t.status), sqlString(t.priority),
          sqlString(t.assigned_to), sqlString(t.created_by), "NULL", "NULL", "NULL",
          sqlString(t.due_at), t.completed_at ? sqlString(t.completed_at) : "NULL", t.cancelled_at ? sqlString(t.cancelled_at) : "NULL",
          String(t.reminder_enabled), t.reminder_minutes_before == null ? "NULL" : String(t.reminder_minutes_before), t.status === "completed" ? sqlString(t.completed_at!) : "NULL", "NULL", sqlString(t.reminder_status), "NULL",
          t.recurrence_type ? sqlString(t.recurrence_type) : "NULL", t.recurrence_interval == null ? "NULL" : String(t.recurrence_interval), t.recurrence_end_at ? sqlString(t.recurrence_end_at) : "NULL", t.recurrence_group_id ? sqlString(t.recurrence_group_id) : "NULL",
          sqlString(iso(now - 60 * 60 * 1000)), sqlString(iso(now - 30 * 60 * 1000)),
        ].join(", "),
        ");",
      ].join("\n"),
    );
    statements.push(
      `INSERT OR IGNORE INTO task_activities (id, task_id, user_id, activity_type, title, description, metadata, created_at) VALUES (${sqlString(`dddddddd-dddd-4ddd-8ddd-dddddddd${t.num.slice(-4)}`)}, ${sqlString(t.id)}, ${sqlString(t.created_by)}, 'created', 'Task created', ${sqlString(`Seeded demo task ${t.num}`)}, ${sqlJson({ seeded: true, taskNumber: t.num })}, ${sqlString(iso(now - 60 * 60 * 1000))});`,
    );
  }

  statements.push(
    "INSERT INTO task_number_sequence (id, next_value) VALUES (1, 9100) ON CONFLICT(id) DO UPDATE SET next_value = CASE WHEN excluded.next_value > task_number_sequence.next_value THEN excluded.next_value ELSE task_number_sequence.next_value END;",
  );

  runD1File(statements.join("\n"), { local: true });
  console.log("  Demo tasks seeded (SN-TASK-9001..9005): overdue, today, upcoming, completed, recurring.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Development seed failed.",
  );
  process.exitCode = 1;
});
