import { describe, expect, it, vi, afterEach } from "vitest";
import { env } from "cloudflare:test";
import type { TaskDto, TelegramStatusDto } from "../src/shared/types/tasks";
import type { CustomerDetailDto } from "../src/shared/types/customers";
import { createDb } from "../src/server/db/client";
import { customers, leadFollowUps, tasks } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import {
  getRenewalReminderWindow,
  getTelegramStatus,
  maskChatId,
  processCustomerRenewalReminders,
  processLeadFollowUpReminders,
  processPendingReminders,
  remindersEnabled,
  sendTelegramMessage,
} from "../src/server/services/telegram";
import {
  apiRequest,
  createUser,
  login,
  parseData,
} from "./helpers";

describe("Telegram Reminders & Notification Service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("masks chat ID properly to protect sensitive IDs", () => {
    expect(maskChatId(undefined)).toBeNull();
    expect(maskChatId("")).toBeNull();
    expect(maskChatId("123")).toBe("****");
    expect(maskChatId("-1001234567890")).toBe("-10****90");
    expect(maskChatId("9876543210")).toBe("987****10");
  });

  it("checks remindersEnabled based on environment variables", () => {
    expect(remindersEnabled({ DB: env.DB })).toBe(false);

    expect(
      remindersEnabled({
        DB: env.DB,
        TELEGRAM_BOT_TOKEN: "token123",
      }),
    ).toBe(false);

    expect(
      remindersEnabled({
        DB: env.DB,
        TELEGRAM_BOT_TOKEN: "token123",
        TELEGRAM_CHAT_ID: "-100123",
        TELEGRAM_REMINDERS_ENABLED: "false",
      }),
    ).toBe(false);

    expect(
      remindersEnabled({
        DB: env.DB,
        TELEGRAM_BOT_TOKEN: "token123",
        TELEGRAM_CHAT_ID: "-100123",
        TELEGRAM_REMINDERS_ENABLED: "true",
      }),
    ).toBe(true);
  });

  it("sends message successfully when Telegram API returns ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 12345 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = mockFetch;

    const testEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "test_bot_token",
      TELEGRAM_CHAT_ID: "-100999888",
      TELEGRAM_REMINDERS_ENABLED: "true",
    };

    const res = await sendTelegramMessage(testEnv, "Hello World");
    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest_bot_token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "-100999888",
          text: "Hello World",
          parse_mode: "HTML",
        }),
      }),
    );
  });

  it("handles Telegram API errors and network failures gracefully", async () => {
    // 1. API error (e.g. invalid chat ID or unauthorized token)
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, description: "Bad Request: chat not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const testEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "bad_token",
      TELEGRAM_CHAT_ID: "bad_chat",
      TELEGRAM_REMINDERS_ENABLED: "true",
    };

    const apiErrRes = await sendTelegramMessage(testEnv, "Test message");
    expect(apiErrRes.ok).toBe(false);
    expect(apiErrRes.error).toContain("chat not found");

    // 2. Network throw
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
    const netErrRes = await sendTelegramMessage(testEnv, "Test message");
    expect(netErrRes.ok).toBe(false);
    expect(netErrRes.error).toBe("Network timeout");
  });

  it("returns Telegram status and masks chat id without exposing token", async () => {
    const db = createDb(env.DB);

    // Unconfigured env
    const unconfigStatus = await getTelegramStatus(db, { DB: env.DB });
    expect(unconfigStatus.configured).toBe(false);
    expect(unconfigStatus.status).toBe("not_configured");
    expect(unconfigStatus.chatIdMasked).toBeNull();

    // Configured env with mocked getMe
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, result: { id: 12345, username: "shifra_crm_bot" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const configEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "secret_token_123",
      TELEGRAM_CHAT_ID: "-100987654321",
      TELEGRAM_REMINDERS_ENABLED: "true",
    };

    const status = await getTelegramStatus(db, configEnv);
    expect(status.configured).toBe(true);
    expect(status.status).toBe("configured");
    expect(status.botUsername).toBe("@shifra_crm_bot");
    expect(status.chatIdMasked).toBe("-10****21");
    // Ensure secret token is nowhere in the returned object!
    expect(JSON.stringify(status)).not.toContain("secret_token_123");
  });

  it("handles notification status endpoint and test notification route", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const empAuth = await login(employee.email);

    // GET /api/notifications/telegram/status
    const statusRes = await apiRequest("/api/notifications/telegram/status", {
      auth: ownerAuth,
    });
    expect(statusRes.status).toBe(200);
    const { status } = await parseData<{ status: TelegramStatusDto }>(statusRes);
    expect(status).toBeDefined();

    // POST /api/notifications/telegram/test by employee (should be rejected by permissions)
    const empTestRes = await apiRequest("/api/notifications/telegram/test", {
      method: "POST",
      auth: empAuth,
    });
    expect(empTestRes.status).toBe(403);
  });

  it("processPendingReminders: correctly handles due calculation, already-sent, skip completed/cancelled, and backoff", async () => {
    const db = createDb(env.DB);
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const testEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "mock_token",
      TELEGRAM_CHAT_ID: "-100123456",
      TELEGRAM_REMINDERS_ENABLED: "true",
    };

    const now = Date.now();

    // 1. Task due in 10 minutes, with reminder 15 minutes before -> (due - 15m) was 5 minutes ago -> DUE NOW!
    const dueIn10m = new Date(now + 10 * 60 * 1000).toISOString();
    const t1Res = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: "Immediate Reminder Task",
        dueAt: dueIn10m,
        reminderEnabled: true,
        reminderMinutesBefore: 15,
      },
    });
    const { task: t1 } = await parseData<{ task: TaskDto }>(t1Res);

    // 2. Task due in 2 hours, reminder 15 minutes before -> NOT DUE YET
    const dueIn2h = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const t2Res = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: "Future Reminder Task",
        dueAt: dueIn2h,
        reminderEnabled: true,
        reminderMinutesBefore: 15,
      },
    });
    const { task: t2 } = await parseData<{ task: TaskDto }>(t2Res);

    // 3. Task due in past, but COMPLETED -> should be SKIPPED
    const t3Res = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: "Completed Task With Reminder",
        dueAt: dueIn10m,
        reminderEnabled: true,
        reminderMinutesBefore: 15,
      },
    });
    const { task: t3 } = await parseData<{ task: TaskDto }>(t3Res);
    await apiRequest(`/api/tasks/${t3.id}/complete`, { method: "POST", auth });

    // Mock Telegram fetch to succeed
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Run sweep
    const sweep1 = await processPendingReminders(db, testEnv);
    expect(sweep1.sent).toBe(1); // t1 sent
    expect(sweep1.skipped).toBe(1); // t3 skipped

    // Verify t1 is now marked sent
    const t1Row = await db.select().from(tasks).where(eq(tasks.id, t1.id)).get();
    expect(t1Row?.reminderStatus).toBe("sent");
    expect(t1Row?.reminderSentAt).toBeDefined();

    // Verify t2 is still pending
    const t2Row = await db.select().from(tasks).where(eq(tasks.id, t2.id)).get();
    expect(t2Row?.reminderStatus).toBe("pending");
    expect(t2Row?.reminderSentAt).toBeNull();

    // Verify t3 is marked skipped
    const t3Row = await db.select().from(tasks).where(eq(tasks.id, t3.id)).get();
    expect(t3Row?.reminderStatus).toBe("skipped");

    // Idempotency: Running sweep again should send 0 new reminders
    const sweep2 = await processPendingReminders(db, testEnv);
    expect(sweep2.sent).toBe(0);
  });

  it("processPendingReminders: handles failure and respects 5-minute backoff window", async () => {
    const db = createDb(env.DB);
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const testEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "mock_token",
      TELEGRAM_CHAT_ID: "-100123456",
      TELEGRAM_REMINDERS_ENABLED: "true",
    };

    const dueIn5m = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const taskRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: "Failing Reminder Task",
        dueAt: dueIn5m,
        reminderEnabled: true,
        reminderMinutesBefore: 10, // Due 5m ago
      },
    });
    const { task } = await parseData<{ task: TaskDto }>(taskRes);

    // Mock Telegram fetch to fail with 500 error
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const sweepFail = await processPendingReminders(db, testEnv);
    expect(sweepFail.failed).toBe(1);

    const failedRow = await db.select().from(tasks).where(eq(tasks.id, task.id)).get();
    expect(failedRow?.reminderStatus).toBe("failed");
    expect(failedRow?.reminderAttemptedAt).toBeDefined();
    expect(failedRow?.reminderError).toContain("Internal Server Error");

    // Immediate second sweep within backoff: should skip task because attempted < 5m ago
    const sweepBackoff = await processPendingReminders(db, testEnv);
    expect(sweepBackoff.failed).toBe(0);
    expect(sweepBackoff.sent).toBe(0);
  });

  it("processCustomerRenewalReminders: reminds within one week, once per renewal date, and re-arms on change", async () => {
    const db = createDb(env.DB);
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const testEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "mock_token",
      TELEGRAM_CHAT_ID: "-100123456",
      TELEGRAM_REMINDERS_ENABLED: "true",
      APP_URL: "https://crm.example.com",
    };

    const { startKey } = getRenewalReminderWindow();
    const addDays = (days: number) => {
      const date = new Date(`${startKey}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const renewalDate = addDays(5);
    const suffix = String(Date.now()).slice(-6);

    const createCustomer = async (
      name: string,
      phoneSuffix: string,
      renewalOn: string,
      serviceName: string,
    ): Promise<CustomerDetailDto> => {
      const response = await apiRequest("/api/customers", {
        method: "POST",
        auth,
        body: {
          name,
          phone: `+1 555 ${phoneSuffix} ${suffix}`,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}.${suffix}@example.com`,
          serviceName,
          serviceCategory: "digital_solutions",
          renewalOn,
        },
      });
      expect(response.status).toBe(201);
      const body = await parseData<{ customer: CustomerDetailDto }>(response);
      return body.customer;
    };

    const due = await createCustomer(
      "Renewal Due",
      "111",
      renewalDate,
      "SEO retainer",
    );
    const far = await createCustomer(
      "Renewal Far",
      "222",
      addDays(30),
      "Logo design",
    );
    const archived = await createCustomer(
      "Renewal Archived",
      "333",
      addDays(3),
      "Hosting",
    );
    await apiRequest(`/api/customers/${archived.id}/archive`, {
      method: "POST",
      auth,
    });

    const sentMessages: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        text?: string;
      };
      sentMessages.push(payload.text ?? "");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const sweep1 = await processCustomerRenewalReminders(db, testEnv);
    expect(sweep1.sent).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toContain("SEO retainer");
    expect(sentMessages[0]).toContain("Digital Solutions");
    expect(sentMessages[0]).toContain("Open customer in CRM");

    const dueRow = await db
      .select()
      .from(customers)
      .where(eq(customers.id, due.id))
      .get();
    expect(dueRow?.renewalReminderFor).toBe(renewalDate);
    expect(dueRow?.renewalReminderSentAt).toBeTruthy();

    // Idempotent: running again does not resend for the same renewal date.
    const sweep2 = await processCustomerRenewalReminders(db, testEnv);
    expect(sweep2.sent).toBe(0);
    expect(sentMessages).toHaveLength(1);

    const farRow = await db
      .select()
      .from(customers)
      .where(eq(customers.id, far.id))
      .get();
    expect(farRow?.renewalReminderSentAt).toBeNull();

    const archivedRow = await db
      .select()
      .from(customers)
      .where(eq(customers.id, archived.id))
      .get();
    expect(archivedRow?.renewalReminderSentAt).toBeNull();

    // Changing the renewal date re-arms the reminder.
    const newRenewalDate = addDays(6);
    const updateResponse = await apiRequest(`/api/customers/${due.id}`, {
      method: "PATCH",
      auth,
      body: { renewalOn: newRenewalDate },
    });
    expect(updateResponse.status).toBe(200);

    const sweep3 = await processCustomerRenewalReminders(db, testEnv);
    expect(sweep3.sent).toBe(1);
    expect(sentMessages).toHaveLength(2);
  });

  it("processLeadFollowUpReminders: sends one reminder per due follow-up, skips cancelled, and is idempotent", async () => {
    const db = createDb(env.DB);
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const testEnv = {
      DB: env.DB,
      TELEGRAM_BOT_TOKEN: "mock_token",
      TELEGRAM_CHAT_ID: "-100123456",
      TELEGRAM_REMINDERS_ENABLED: "true",
      APP_URL: "https://crm.example.com",
    };

    const suffix = String(Date.now()).slice(-6);
    const leadRes = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Reminder Lead",
        phone: `+1 555 777 ${suffix}`,
        email: `reminder.${suffix}@example.com`,
        source: "Website",
      },
    });
    expect(leadRes.status).toBe(201);
    const { lead } = await parseData<{ lead: { id: string } }>(leadRes);

    const createFollowUp = async (
      title: string,
      scheduledAt: string,
    ): Promise<{ id: string }> => {
      const response = await apiRequest(`/api/leads/${lead.id}/follow-ups`, {
        method: "POST",
        auth,
        body: {
          title,
          scheduledAt,
          reminderEnabled: true,
          reminderMinutesBefore: 15,
        },
      });
      expect(response.status).toBe(201);
      return (await parseData<{ followUp: { id: string } }>(response)).followUp;
    };

    // Reminder time (scheduled minus 15m) is already in the past.
    const dueNow = await createFollowUp(
      "Call back about proposal",
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    );
    // Reminder is not due for another ~2 hours.
    const future = await createFollowUp(
      "Future follow-up",
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    );
    const cancelled = await createFollowUp(
      "Cancelled follow-up",
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    );
    await apiRequest(`/api/follow-ups/${cancelled.id}/cancel`, {
      method: "POST",
      auth,
      body: {},
    });

    const sentMessages: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        text?: string;
      };
      sentMessages.push(payload.text ?? "");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const sweep1 = await processLeadFollowUpReminders(db, testEnv);
    expect(sweep1.sent).toBe(1);
    expect(sweep1.skipped).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toContain("Call back about proposal");
    expect(sentMessages[0]).toContain("Reminder Lead");
    expect(sentMessages[0]).toContain("Open lead in CRM");

    const dueRow = await db
      .select()
      .from(leadFollowUps)
      .where(eq(leadFollowUps.id, dueNow.id))
      .get();
    expect(dueRow?.reminderStatus).toBe("sent");
    expect(dueRow?.reminderSentAt).toBeTruthy();

    const futureRow = await db
      .select()
      .from(leadFollowUps)
      .where(eq(leadFollowUps.id, future.id))
      .get();
    expect(futureRow?.reminderStatus).toBe("pending");
    expect(futureRow?.reminderSentAt).toBeNull();

    const cancelledRow = await db
      .select()
      .from(leadFollowUps)
      .where(eq(leadFollowUps.id, cancelled.id))
      .get();
    expect(cancelledRow?.reminderStatus).toBe("skipped");

    // Idempotent: a second sweep sends nothing new.
    const sweep2 = await processLeadFollowUpReminders(db, testEnv);
    expect(sweep2.sent).toBe(0);
    expect(sentMessages).toHaveLength(1);
  });
});
