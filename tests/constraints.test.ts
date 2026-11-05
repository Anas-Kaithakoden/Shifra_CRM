import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createSessionForUser, createUser } from "./helpers";

async function insertRawUser(values: {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
}): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, full_name, email, password_hash, role)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      values.id ?? crypto.randomUUID(),
      values.fullName ?? "Raw User",
      values.email ?? `raw.${crypto.randomUUID()}@example.com`,
      "test-hash",
      values.role ?? "employee",
    )
    .run();
}

describe("database constraints", () => {
  it("enforces unique email addresses", async () => {
    const user = await createUser({ email: "unique@example.com" });

    await expect(
      insertRawUser({ email: user.email }),
    ).rejects.toThrow();
  });

  it("enforces the role allow-list", async () => {
    await expect(insertRawUser({ role: "superadmin" })).rejects.toThrow();
  });

  it("requires lowercase email addresses", async () => {
    await expect(
      insertRawUser({ email: "UPPERCASE@example.com" }),
    ).rejects.toThrow();
  });

  it("allows only one owner account", async () => {
    await createUser({ role: "owner" });

    await expect(insertRawUser({ role: "owner" })).rejects.toThrow();
  });

  it("limits full names to 120 characters", async () => {
    await expect(
      insertRawUser({ fullName: "x".repeat(121) }),
    ).rejects.toThrow();
  });

  it("rejects invalid audit metadata JSON", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO audit_logs (id, action, metadata) VALUES (?, ?, ?)`,
      )
        .bind(crypto.randomUUID(), "test.invalid_metadata", "not-json")
        .run(),
    ).rejects.toThrow();
  });

  it("cascades session deletion when a user is removed", async () => {
    const user = await createUser();
    await createSessionForUser(user.id);

    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();

    const sessions = await env.DB.prepare(
      "SELECT count(*) AS count FROM sessions WHERE user_id = ?",
    )
      .bind(user.id)
      .first<{ count: number }>();
    expect(Number(sessions?.count ?? 0)).toBe(0);
  });
});
