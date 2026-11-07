import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import type { TelegramStatusDto } from "../../shared/types/tasks";
import { CUSTOMER_SERVICE_CATEGORY_LABELS } from "../../shared/constants/customers";
import type { Env } from "../config";
import type { AppDatabase } from "../db/client";
import { customers, customerServices, leadFollowUps, leads, tasks, users, type CustomerRow, type LeadFollowUpRow, type TaskRow } from "../db/schema";
import { getCrmDayBounds, nowIso } from "../lib/time";

export function remindersEnabled(env: Env): boolean {
  if (env.TELEGRAM_REMINDERS_ENABLED === "false") return false;
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

export function maskChatId(chatId: string | undefined): string | null {
  if (!chatId) return null;
  const str = String(chatId);
  if (str.length <= 4) return "****";
  const start = str.slice(0, 3);
  const end = str.slice(-2);
  return `${start}****${end}`;
}

export async function sendTelegramMessage(
  env: Env,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!remindersEnabled(env)) {
    return { ok: false, error: "Telegram reminders disabled or not configured." };
  }
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function sendTestNotification(
  env: Env,
  senderName: string,
): Promise<{ ok: boolean; error?: string }> {
  const message = [
    "🧪 <b>Shifra Nuha CRM — Test Notification</b>",
    "",
    "This is an administrative test notification from Shifra Nuha CRM.",
    "Telegram reminders and webhook routing are operational.",
    "",
    `👤 <b>Initiated by:</b> ${escapeHtml(senderName)}`,
    `🕒 <b>Timestamp (UTC):</b> ${escapeHtml(nowIso())}`,
  ].join("\n");

  return sendTelegramMessage(env, message);
}

export async function getTelegramStatus(
  db: AppDatabase,
  env: Env,
): Promise<TelegramStatusDto> {
  const configured = remindersEnabled(env);
  const chatIdMasked = maskChatId(env.TELEGRAM_CHAT_ID);

  const [taskStats, followUpStats] = await Promise.all([
    db
      .select({
        lastSuccessAt: sql<string | null>`max(case when ${tasks.reminderStatus} = 'sent' then ${tasks.reminderSentAt} else null end)`,
        failedCount: sql<number>`sum(case when ${tasks.reminderStatus} = 'failed' then 1 else 0 end)`,
      })
      .from(tasks)
      .get(),
    db
      .select({
        lastSuccessAt: sql<string | null>`max(case when ${leadFollowUps.reminderStatus} = 'sent' then ${leadFollowUps.reminderSentAt} else null end)`,
        failedCount: sql<number>`sum(case when ${leadFollowUps.reminderStatus} = 'failed' then 1 else 0 end)`,
      })
      .from(leadFollowUps)
      .get(),
  ]);

  const lastSuccessCandidates = [
    taskStats?.lastSuccessAt,
    followUpStats?.lastSuccessAt,
  ].filter((value): value is string => Boolean(value));
  const lastSuccessAt =
    lastSuccessCandidates.length > 0
      ? lastSuccessCandidates.sort().at(-1) ?? null
      : null;
  const failedCount =
    Number(taskStats?.failedCount ?? 0) +
    Number(followUpStats?.failedCount ?? 0);

  if (!configured) {
    return {
      configured: false,
      status: "not_configured",
      lastSuccessAt,
      failedCount,
      chatIdMasked: null,
    };
  }

  // Verify Telegram connectivity via getMe API call
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { username?: string };
    };

    if (res.ok && data.ok) {
      return {
        configured: true,
        status: "configured",
        lastSuccessAt,
        failedCount,
        chatIdMasked,
        botUsername: data.result?.username ? `@${data.result.username}` : null,
      };
    }

    return {
      configured: true,
      status: "error",
      lastSuccessAt,
      failedCount,
      chatIdMasked,
      error: data.description ?? `Telegram API error (${res.status})`,
    };
  } catch (error) {
    return {
      configured: true,
      status: "error",
      lastSuccessAt,
      failedCount,
      chatIdMasked,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatTaskReminderMessage(task: TaskRow): string {
  const lines = [
    "🔔 <b>Shifra Nuha CRM Reminder</b>",
    "",
    `📋 <b>Task:</b> ${escapeHtml(task.title)}`,
    `🔢 <b>Number:</b> ${escapeHtml(task.taskNumber)}`,
    `⚡ <b>Priority:</b> ${escapeHtml(task.priority.toUpperCase())}`,
    `📁 <b>Type:</b> ${escapeHtml(task.taskType)}`,
    `⏰ <b>Due:</b> ${escapeHtml(task.dueAt ?? "Not set")}`,
  ];

  if (task.description) {
    lines.push("", `📝 <b>Details:</b> ${escapeHtml(task.description)}`);
  }

  return lines.join("\n");
}

export async function processPendingReminders(
  db: AppDatabase,
  env: Env,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!remindersEnabled(env)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const now = nowIso();
  const nowMs = Date.now();

  const candidates = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.reminderEnabled, true),
        inArray(tasks.reminderStatus, ["pending", "failed"]),
        isNull(tasks.reminderSentAt),
        sql`${tasks.dueAt} is not null`,
      ),
    )
    .all();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const t of candidates) {
    // If task has completed or cancelled, skip sending reminder
    if (t.status === "completed" || t.status === "cancelled") {
      await db
        .update(tasks)
        .set({
          reminderStatus: "skipped",
          updatedAt: now,
        })
        .where(eq(tasks.id, t.id));
      skipped += 1;
      continue;
    }

    // Calculate reminder due time: dueAt - reminderMinutesBefore
    const dueMs = new Date(t.dueAt!).getTime();
    const minutesBefore = t.reminderMinutesBefore ?? 0;
    const reminderAtMs = dueMs - minutesBefore * 60 * 1000;

    if (nowMs < reminderAtMs) {
      // Not due yet
      continue;
    }

    // Backoff logic: if previous attempt failed, wait at least 5 minutes before retrying
    if (t.reminderStatus === "failed" && t.reminderAttemptedAt) {
      const lastAttemptMs = new Date(t.reminderAttemptedAt).getTime();
      const backoffMs = 5 * 60 * 1000;
      if (nowMs - lastAttemptMs < backoffMs) {
        // In backoff window, skip for now
        continue;
      }
    }

    const message = formatTaskReminderMessage(t);
    const result = await sendTelegramMessage(env, message);

    if (result.ok) {
      await db
        .update(tasks)
        .set({
          reminderStatus: "sent",
          reminderSentAt: now,
          reminderAttemptedAt: now,
          reminderError: null,
          updatedAt: now,
        })
        .where(eq(tasks.id, t.id));
      sent += 1;
    } else {
      await db
        .update(tasks)
        .set({
          reminderStatus: "failed",
          reminderAttemptedAt: now,
          reminderError: result.error ?? "Failed to send message",
          updatedAt: now,
        })
        .where(eq(tasks.id, t.id));
      failed += 1;
    }
  }

  return { sent, failed, skipped };
}

const LEAD_FOLLOW_UP_RETRY_BACKOFF_MS = 5 * 60 * 1000;

export function formatLeadFollowUpReminderMessage(
  followUp: Pick<
    LeadFollowUpRow,
    "title" | "scheduledAt" | "notes" | "reminderMinutesBefore"
  >,
  lead: { id: string; name: string; leadNumber: string; phone: string },
  assignedToName: string | null,
  appUrl?: string,
): string {
  const lines = [
    "🔔 <b>Shifra Nuha CRM — Follow-up Reminder</b>",
    "",
    `📋 <b>Follow-up:</b> ${escapeHtml(followUp.title)}`,
    `🏢 <b>Lead:</b> ${escapeHtml(lead.name)} (${escapeHtml(lead.leadNumber)})`,
    `📞 <b>Phone:</b> ${escapeHtml(lead.phone)}`,
    `⏰ <b>Scheduled:</b> ${escapeHtml(followUp.scheduledAt)}`,
    `⏱ <b>Reminder:</b> ${followUp.reminderMinutesBefore} minutes before`,
  ];

  if (assignedToName) {
    lines.push(`👤 <b>Owner:</b> ${escapeHtml(assignedToName)}`);
  }

  if (followUp.notes) {
    lines.push("", `📝 <b>Notes:</b> ${escapeHtml(followUp.notes)}`);
  }

  if (appUrl) {
    lines.push(
      "",
      `🔗 <a href="${escapeHtml(`${appUrl}/leads/${lead.id}`)}">Open lead in CRM</a>`,
    );
  }

  return lines.join("\n");
}

/**
 * Sends one Telegram reminder per pending lead follow-up at
 * `scheduled_at - reminder_minutes_before`. Delivery is idempotent (the sent
 * timestamp suppresses repeat sends) and failed attempts retry after a short
 * backoff. Completed or cancelled follow-ups are marked skipped.
 */
export async function processLeadFollowUpReminders(
  db: AppDatabase,
  env: Env,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!remindersEnabled(env)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const now = nowIso();
  const nowMs = Date.now();

  const candidates = await db
    .select({
      followUp: leadFollowUps,
      lead: {
        id: leads.id,
        name: leads.name,
        leadNumber: leads.leadNumber,
        phone: leads.phone,
      },
      assignedUserName: users.fullName,
    })
    .from(leadFollowUps)
    .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
    .leftJoin(users, eq(leadFollowUps.assignedTo, users.id))
    .where(
      and(
        eq(leadFollowUps.reminderEnabled, true),
        inArray(leadFollowUps.reminderStatus, ["pending", "failed"]),
        isNull(leadFollowUps.reminderSentAt),
        isNull(leads.deletedAt),
      ),
    )
    .all();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates) {
    const followUp = row.followUp;

    // Completed or cancelled follow-ups no longer need a reminder.
    if (followUp.status === "completed" || followUp.status === "cancelled") {
      await db
        .update(leadFollowUps)
        .set({ reminderStatus: "skipped", updatedAt: now })
        .where(eq(leadFollowUps.id, followUp.id));
      skipped += 1;
      continue;
    }

    const dueMs = new Date(followUp.scheduledAt).getTime();
    const reminderAtMs =
      dueMs - (followUp.reminderMinutesBefore ?? 0) * 60 * 1000;

    if (nowMs < reminderAtMs) {
      // Not due yet.
      continue;
    }

    if (followUp.reminderStatus === "failed" && followUp.reminderAttemptedAt) {
      const lastAttemptMs = new Date(followUp.reminderAttemptedAt).getTime();
      if (nowMs - lastAttemptMs < LEAD_FOLLOW_UP_RETRY_BACKOFF_MS) {
        continue;
      }
    }

    const message = formatLeadFollowUpReminderMessage(
      followUp,
      row.lead,
      row.assignedUserName ?? null,
      env.APP_URL,
    );
    const result = await sendTelegramMessage(env, message);

    if (result.ok) {
      await db
        .update(leadFollowUps)
        .set({
          reminderStatus: "sent",
          reminderSentAt: now,
          reminderAttemptedAt: now,
          reminderError: null,
          updatedAt: now,
        })
        .where(eq(leadFollowUps.id, followUp.id));
      sent += 1;
    } else {
      await db
        .update(leadFollowUps)
        .set({
          reminderStatus: "failed",
          reminderAttemptedAt: now,
          reminderError: result.error ?? "Failed to send message",
          updatedAt: now,
        })
        .where(eq(leadFollowUps.id, followUp.id));
      failed += 1;
    }
  }

  return { sent, failed, skipped };
}

const RENEWAL_REMINDER_WINDOW_DAYS = 7;
const RENEWAL_REMINDER_RETRY_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Returns the inclusive date-only window (CRM timezone) in which a renewal
 * reminder should be delivered: today through seven days from today.
 */
export function getRenewalReminderWindow(now = new Date()): {
  startKey: string;
  endKey: string;
} {
  const { dateKey } = getCrmDayBounds(now);
  const end = new Date(`${dateKey}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + RENEWAL_REMINDER_WINDOW_DAYS);
  return { startKey: dateKey, endKey: end.toISOString().slice(0, 10) };
}

function daysUntil(dateKey: string, todayKey: string): number {
  const target = Date.parse(`${dateKey}T00:00:00.000Z`);
  const today = Date.parse(`${todayKey}T00:00:00.000Z`);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export function formatRenewalReminderMessage(
  customer: CustomerRow,
  todayKey: string,
  appUrl?: string,
): string {
  const category = customer.serviceCategory
    ? CUSTOMER_SERVICE_CATEGORY_LABELS[customer.serviceCategory]
    : "Not set";
  const days = customer.renewalOn
    ? daysUntil(customer.renewalOn, todayKey)
    : 0;

  const lines = [
    "🔁 <b>Shifra Nuha CRM — Renewal Reminder</b>",
    "",
    `🏢 <b>Customer:</b> ${escapeHtml(customer.businessName ?? customer.name)}`,
    `🔢 <b>Customer no.:</b> ${escapeHtml(customer.customerNumber)}`,
    `🧩 <b>Service:</b> ${escapeHtml(customer.serviceName ?? "Not set")}`,
    `🗂 <b>Category:</b> ${escapeHtml(category)}`,
    `📅 <b>Renewal date:</b> ${escapeHtml(customer.renewalOn ?? "")}`,
    `⏳ <b>Days remaining:</b> ${days}`,
    `📞 <b>Phone:</b> ${escapeHtml(customer.phone)}`,
  ];

  if (customer.email) {
    lines.push(`✉️ <b>Email:</b> ${escapeHtml(customer.email)}`);
  }

  if (appUrl) {
    lines.push(
      "",
      `🔗 <a href="${escapeHtml(`${appUrl}/customers/${customer.id}`)}">Open customer in CRM</a>`,
    );
  }

  return lines.join("\n");
}

/**
 * Sends one Telegram reminder per customer renewal date, no later than seven
 * days before the renewal. A successful send is recorded in
 * `renewal_reminder_for` so the sweep is idempotent; changing the renewal date
 * automatically re-arms the reminder.
 */
export async function processCustomerRenewalReminders(
  db: AppDatabase,
  env: Env,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!remindersEnabled(env)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const now = nowIso();
  const nowMs = Date.now();
  const { startKey, endKey } = getRenewalReminderWindow();

  const candidates = await db
    .select()
    .from(customerServices)
    .innerJoin(customers, eq(customerServices.customerId, customers.id))
    .where(
      and(
        isNotNull(customerServices.renewalOn),
        gte(customerServices.renewalOn, startKey),
        lte(customerServices.renewalOn, endKey),
        ne(customers.status, "archived"),
        sql`(${customerServices.renewalReminderFor} is null or ${customerServices.renewalReminderFor} != ${customerServices.renewalOn})`,
      ),
    )
    .all();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates) {
    const service = row.customer_services;
    const customer = row.customers;
    const merged = {
      ...customer,
      serviceName: service.serviceName,
      serviceCategory: service.serviceCategory,
      renewalOn: service.renewalOn,
      renewalReminderFor: service.renewalReminderFor,
      renewalReminderSentAt: service.renewalReminderSentAt,
      renewalReminderAttemptedAt: service.renewalReminderAttemptedAt,
      renewalReminderError: service.renewalReminderError,
    };
    // Retry failed sends after a short backoff instead of hammering Telegram
    // every minute. Successful sends are excluded by the query above.
    if (merged.renewalReminderError && merged.renewalReminderAttemptedAt) {
      const lastAttemptMs = Date.parse(merged.renewalReminderAttemptedAt);
      if (
        Number.isFinite(lastAttemptMs) &&
        nowMs - lastAttemptMs < RENEWAL_REMINDER_RETRY_BACKOFF_MS
      ) {
        skipped += 1;
        continue;
      }
    }

    const message = formatRenewalReminderMessage(
      merged as CustomerRow,
      startKey,
      env.APP_URL,
    );
    const result = await sendTelegramMessage(env, message);

    if (result.ok) {
      await db
        .update(customerServices)
        .set({
          renewalReminderFor: service.renewalOn,
          renewalReminderSentAt: now,
          renewalReminderAttemptedAt: now,
          renewalReminderError: null,
          updatedAt: now,
        })
        .where(eq(customerServices.id, service.id));
      sent += 1;
    } else {
      await db
        .update(customerServices)
        .set({
          renewalReminderAttemptedAt: now,
          renewalReminderError: result.error ?? "Failed to send message",
          updatedAt: now,
        })
        .where(eq(customerServices.id, service.id));
      failed += 1;
    }
  }

  return { sent, failed, skipped };
}

