import { describe, expect, it } from "vitest";
import type { Paginated } from "../src/shared/types/api";
import type {
  LeadActivityDto,
  LeadDashboardStatsDto,
  LeadDto,
  LeadFollowUpDto,
} from "../src/shared/types/leads";
import type { AuthSession } from "./helpers";
import {
  apiRequest,
  createUser,
  expectError,
  login,
  parseData,
} from "./helpers";

let sequence = 0;

function uniqueContact(): { phone: string; email: string } {
  sequence += 1;
  const suffix = String(Date.now()).slice(-6) + String(sequence).padStart(3, "0");
  return {
    phone: `+1 555 ${suffix.slice(-3)} ${suffix.slice(0, 3)}${suffix.slice(3, 6)}`,
    email: `followup.${suffix}@example.com`,
  };
}

async function createLead(
  auth: AuthSession,
  overrides: Record<string, unknown> = {},
): Promise<LeadDto> {
  const contact = uniqueContact();
  const response = await apiRequest("/api/leads", {
    method: "POST",
    auth,
    body: {
      name: "Follow-up Lead",
      phone: contact.phone,
      email: contact.email,
      source: "Website",
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  return (await parseData<{ lead: LeadDto }>(response)).lead;
}

async function createFollowUp(
  auth: AuthSession,
  leadId: string,
  overrides: Record<string, unknown> = {},
): Promise<LeadFollowUpDto> {
  const response = await apiRequest(`/api/leads/${leadId}/follow-ups`, {
    method: "POST",
    auth,
    body: {
      title: "Call the lead",
      scheduledAt: new Date().toISOString(),
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  return (await parseData<{ followUp: LeadFollowUpDto }>(response)).followUp;
}

async function getLead(auth: AuthSession, id: string): Promise<LeadDto> {
  const response = await apiRequest(`/api/leads/${id}`, { auth });
  expect(response.status).toBe(200);
  return (await parseData<{ lead: LeadDto }>(response)).lead;
}

async function listFollowUps(
  auth: AuthSession,
  query = "",
): Promise<Paginated<LeadFollowUpDto>> {
  const response = await apiRequest(`/api/follow-ups${query}`, { auth });
  expect(response.status).toBe(200);
  return parseData<Paginated<LeadFollowUpDto>>(response);
}

function futureWithinToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "01";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  const dayEnd = new Date(`${dateKey}T23:59:59.999+05:30`).getTime();
  const target = Math.min(Date.now() + 60 * 60 * 1000, dayEnd - 60_000);
  return new Date(target).toISOString();
}

async function getCounts(
  auth: AuthSession,
): Promise<{ today: number; upcoming: number; overdue: number; completed: number }> {
  const response = await apiRequest("/api/follow-ups/counts", { auth });
  expect(response.status).toBe(200);
  return (
    await parseData<{
      counts: {
        today: number;
        upcoming: number;
        overdue: number;
        completed: number;
      };
    }>(response)
  ).counts;
}

describe("follow-up lifecycle", () => {
  it("schedules a follow-up, syncs the lead and appears in today's list", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });
    const auth = await login(employee.email);
    const ownerAuth = await login(owner.email);
    const lead = await createLead(auth, { name: "Scheduled lead" });

    const scheduledAt = new Date().toISOString();
    const followUp = await createFollowUp(auth, lead.id, {
      title: "Discuss requirements",
      notes: "Bring the service catalogue.",
      scheduledAt,
    });

    expect(followUp.status).toBe("pending");
    expect(followUp.leadId).toBe(lead.id);
    expect(followUp.leadName).toBe("Scheduled lead");
    expect(followUp.assignedTo).toBe(employee.id);

    const refreshed = await getLead(auth, lead.id);
    expect(refreshed.nextFollowUpAt).toBe(followUp.scheduledAt);

    const today = await listFollowUps(auth, "?scope=today");
    expect(today.items.map((row) => row.id)).toContain(followUp.id);

    const counts = await getCounts(auth);
    expect(counts.today).toBe(1);

    const activitiesResponse = await apiRequest(
      `/api/leads/${lead.id}/activities?pageSize=50`,
      { auth },
    );
    const activities = await parseData<Paginated<LeadActivityDto>>(
      activitiesResponse,
    );
    expect(
      activities.items.some(
        (activity) => activity.activityType === "follow_up_scheduled",
      ),
    ).toBe(true);

    const auditResponse = await apiRequest("/api/audit-logs?pageSize=50", {
      auth: ownerAuth,
    });
    expect(await auditResponse.text()).toContain("lead.follow_up_scheduled");
  });

  it("reschedules, completes and keeps the audit trail", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Reschedule lead" });
    const followUp = await createFollowUp(auth, lead.id, {
      title: "Initial call",
    });

    const nextWeek = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const rescheduleResponse = await apiRequest(
      `/api/follow-ups/${followUp.id}/reschedule`,
      {
        method: "POST",
        auth,
        body: { scheduledAt: nextWeek },
      },
    );
    expect(rescheduleResponse.status).toBe(200);
    const rescheduled = await parseData<{ followUp: LeadFollowUpDto }>(
      rescheduleResponse,
    );
    expect(rescheduled.followUp.scheduledAt).toBe(nextWeek);

    const refreshed = await getLead(auth, lead.id);
    expect(refreshed.nextFollowUpAt).toBe(nextWeek);

    const today = await listFollowUps(auth, "?scope=today");
    expect(today.items.map((row) => row.id)).not.toContain(followUp.id);
    const upcoming = await listFollowUps(auth, "?scope=upcoming");
    expect(upcoming.items.map((row) => row.id)).toContain(followUp.id);

    const completeResponse = await apiRequest(
      `/api/follow-ups/${followUp.id}/complete`,
      {
        method: "POST",
        auth,
        body: { completedNote: "Requirements captured." },
      },
    );
    expect(completeResponse.status).toBe(200);
    const completed = await parseData<{ followUp: LeadFollowUpDto }>(
      completeResponse,
    );
    expect(completed.followUp.status).toBe("completed");
    expect(completed.followUp.completedAt).not.toBeNull();

    const afterComplete = await getLead(auth, lead.id);
    expect(afterComplete.nextFollowUpAt).toBeNull();

    const completedList = await listFollowUps(auth, "?scope=completed");
    expect(completedList.items.map((row) => row.id)).toContain(followUp.id);

    const counts = await getCounts(auth);
    expect(counts.completed).toBe(1);
    expect(counts.upcoming).toBe(0);

    const repeatComplete = await apiRequest(
      `/api/follow-ups/${followUp.id}/complete`,
      { method: "POST", auth, body: {} },
    );
    await expectError(repeatComplete, 409, "follow_up_not_pending");

    const activitiesResponse = await apiRequest(
      `/api/leads/${lead.id}/activities?pageSize=100`,
      { auth },
    );
    const activities = await parseData<Paginated<LeadActivityDto>>(
      activitiesResponse,
    );
    const types = activities.items.map((activity) => activity.activityType);
    expect(types).toEqual(
      expect.arrayContaining(["follow_up_rescheduled", "follow_up_completed"]),
    );
  });

  it("tracks overdue follow-ups separately and supports cancellation", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Overdue lead" });

    const overdueAt = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const overdue = await createFollowUp(auth, lead.id, {
      title: "Missing follow-up",
      scheduledAt: overdueAt,
    });

    const overdueList = await listFollowUps(auth, "?scope=overdue");
    expect(overdueList.items.map((row) => row.id)).toContain(overdue.id);

    const counts = await getCounts(auth);
    expect(counts.overdue).toBe(1);

    const cancelResponse = await apiRequest(
      `/api/follow-ups/${overdue.id}/cancel`,
      {
        method: "POST",
        auth,
        body: { reason: "Lead went silent" },
      },
    );
    expect(cancelResponse.status).toBe(200);
    const cancelled = await parseData<{ followUp: LeadFollowUpDto }>(
      cancelResponse,
    );
    expect(cancelled.followUp.status).toBe("cancelled");

    const afterCancel = await getLead(auth, lead.id);
    expect(afterCancel.nextFollowUpAt).toBeNull();
    expect((await getCounts(auth)).overdue).toBe(0);
    expect(
      (await listFollowUps(auth, "?scope=cancelled")).items.map(
        (row) => row.id,
      ),
    ).toContain(overdue.id);
  });

  it("exposes upcoming and overdue counts on the dashboard", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Dashboard lead" });

    await createFollowUp(auth, lead.id, {
      title: "Due today",
      scheduledAt: futureWithinToday(),
    });
    await createFollowUp(auth, lead.id, {
      title: "Overdue",
      scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const response = await apiRequest("/api/dashboard/lead-stats", { auth });
    const stats = await parseData<LeadDashboardStatsDto>(response);
    expect(stats.counts.dueTodayFollowUps).toBe(1);
    expect(stats.counts.overdueFollowUps).toBe(1);
    expect(stats.followUps.dueToday.length).toBe(1);
    expect(stats.followUps.overdue.length).toBe(1);
  });

  it("updates follow-up details and validates the new schedule", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Update lead" });
    const followUp = await createFollowUp(auth, lead.id);

    const updateResponse = await apiRequest(`/api/follow-ups/${followUp.id}`, {
      method: "PATCH",
      auth,
      body: { title: "Updated title", notes: "Updated notes" },
    });
    expect(updateResponse.status).toBe(200);
    const updated = await parseData<{ followUp: LeadFollowUpDto }>(
      updateResponse,
    );
    expect(updated.followUp.title).toBe("Updated title");
    expect(updated.followUp.notes).toBe("Updated notes");

    const invalidSchedule = await apiRequest(
      `/api/follow-ups/${followUp.id}/reschedule`,
      {
        method: "POST",
        auth,
        body: { scheduledAt: "not-a-date" },
      },
    );
    await expectError(invalidSchedule, 400, "validation_error");

    const byLead = await listFollowUps(auth, `?leadId=${lead.id}`);
    expect(byLead.items).toHaveLength(1);
    expect(byLead.items[0]?.id).toBe(followUp.id);

    const auditResponse = await apiRequest("/api/audit-logs?pageSize=50", {
      auth,
    });
    expect(await auditResponse.text()).toContain("lead.follow_up_updated");
  });
});

describe("follow-up RBAC", () => {
  it("prevents employees from viewing or managing another employee's follow-ups", async () => {
    const owner = await createUser({ role: "owner" });
    const employeeA = await createUser({ role: "employee" });
    const employeeB = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const employeeBAuth = await login(employeeB.email);

    const lead = await createLead(ownerAuth, {
      name: "Owned by A",
      assignedTo: employeeA.id,
    });
    const followUp = await createFollowUp(ownerAuth, lead.id, {
      scheduledAt: new Date().toISOString(),
    });

    const visibleToB = await listFollowUps(employeeBAuth);
    expect(visibleToB.items.map((row) => row.id)).not.toContain(followUp.id);

    const completeForbidden = await apiRequest(
      `/api/follow-ups/${followUp.id}/complete`,
      { method: "POST", auth: employeeBAuth, body: {} },
    );
    await expectError(completeForbidden, 403, "forbidden");

    const createForbidden = await apiRequest(
      `/api/leads/${lead.id}/follow-ups`,
      {
        method: "POST",
        auth: employeeBAuth,
        body: {
          title: "Should fail",
          scheduledAt: new Date().toISOString(),
        },
      },
    );
    await expectError(createForbidden, 403, "forbidden");
  });

  it("lets the lead owner manage their own follow-ups", async () => {
    const employee = await createUser({ role: "employee" });
    const auth = await login(employee.email);
    const lead = await createLead(auth, { name: "Employee lead" });
    const followUp = await createFollowUp(auth, lead.id);

    const complete = await apiRequest(`/api/follow-ups/${followUp.id}/complete`, {
      method: "POST",
      auth,
      body: { completedNote: "Done" },
    });
    expect(complete.status).toBe(200);

    const counts = await getCounts(auth);
    expect(counts.completed).toBe(1);
    expect(counts.today).toBe(0);
  });
});
