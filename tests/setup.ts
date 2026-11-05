import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

beforeAll(async () => {
  if (!env.TEST_MIGRATIONS) {
    throw new Error("TEST_MIGRATIONS binding is missing.");
  }
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM task_activities"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM customer_activities"),
    env.DB.prepare("DELETE FROM customer_contacts"),
    env.DB.prepare("DELETE FROM lead_activities"),
    env.DB.prepare("DELETE FROM lead_follow_ups"),
    env.DB.prepare("DELETE FROM leads"),
    env.DB.prepare("DELETE FROM customers"),
    env.DB.prepare("DELETE FROM audit_logs"),
    env.DB.prepare("DELETE FROM login_attempts"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM app_settings"),
    env.DB.prepare("DELETE FROM users"),
  ]);
});
