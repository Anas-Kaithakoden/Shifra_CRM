import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Paginated } from "../src/shared/types/api";
import type {
  DuplicateLeadDto,
  LeadActivityDto,
  LeadDashboardStatsDto,
  LeadDto,
  LeadListItemDto,
  LeadPipelineDto,
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
    email: `lead.${suffix}@example.com`,
  };
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

async function createLead(
  auth: AuthSession,
  overrides: Record<string, unknown> = {},
): Promise<LeadDto> {
  const contact = uniqueContact();
  const response = await apiRequest("/api/leads", {
    method: "POST",
    auth,
    body: {
      name: "Test Lead",
      phone: contact.phone,
      email: contact.email,
      source: "Website",
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  const body = await parseData<{ lead: LeadDto }>(response);
  return body.lead;
}

async function listLeads(
  auth: AuthSession,
  query = "",
): Promise<Paginated<LeadListItemDto>> {
  const response = await apiRequest(`/api/leads${query}`, { auth });
  expect(response.status).toBe(200);
  return parseData<Paginated<LeadListItemDto>>(response);
}

describe("lead creation and validation", () => {
  it("creates a lead with normalized contact details and an audit trail", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const lead = await createLead(auth, {
      name: "  Aisha Khan  ",
      phone: "+44 (20) 7946 0958",
      email: "Aisha.Khan@Example.COM",
      businessName: "  Khan Textiles ",
      location: "London",
      serviceInterest: "Website Design & Development",
      source: "Referral",
      estimatedValue: 125000,
      priority: "high",
      description: "  Looking for a full website rebuild. ",
    });

    expect(lead.name).toBe("Aisha Khan");
    expect(lead.phone).toBe("+44 (20) 7946 0958");
    expect(lead.email).toBe("aisha.khan@example.com");
    expect(lead.businessName).toBe("Khan Textiles");
    expect(lead.description).toBe("Looking for a full website rebuild.");
    expect(lead.serviceCategory).toBe("Digital Solutions");
    expect(lead.pipelineStage).toBe("new");
    expect(lead.contactStatus).toBe("not_contacted");
    expect(lead.assignedTo).toBeNull();
    expect(lead.createdBy).toBe(owner.id);
    expect(lead.leadNumber).toMatch(/^LD-\d{8}-[A-F0-9]{6}$/);

    const activitiesResponse = await apiRequest(
      `/api/leads/${lead.id}/activities`,
      { auth },
    );
    expect(activitiesResponse.status).toBe(200);
    const activities = await parseData<Paginated<LeadActivityDto>>(
      activitiesResponse,
    );
    expect(activities.items[0]?.activityType).toBe("lead_created");

    const auditResponse = await apiRequest("/api/audit-logs?pageSize=50", {
      auth,
    });
    expect(auditResponse.status).toBe(200);
    expect(await auditResponse.text()).toContain("lead.created");
  });

  it("rejects invalid or missing fields", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const missingName = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: { phone: "+1 555 0100 200", source: "Website" },
    });
    await expectError(missingName, 400, "validation_error");

    const badPhone = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: { name: "Bad Phone", phone: "abcdefgh", source: "Website" },
    });
    await expectError(badPhone, 400, "validation_error");

    const badEmail = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Bad Email",
        phone: "+1 555 0100 300",
        email: "not-an-email",
        source: "Website",
      },
    });
    await expectError(badEmail, 400, "validation_error");

    const badSource = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Bad Source",
        phone: "+1 555 0100 400",
        source: "Carrier Pigeon",
      },
    });
    await expectError(badSource, 400, "validation_error");
  });

  it("detects duplicates by normalized phone or email and allows an explicit override", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const original = await createLead(auth, {
      name: "Original Lead",
      phone: "+1 (555) 777-8888",
      email: "original@example.com",
    });

    const duplicate = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Duplicate Lead",
        phone: "+15557778888",
        source: "Website",
      },
    });
    const duplicateBody = await expectError(
      duplicate,
      409,
      "possible_duplicate",
    );
    const details = duplicateBody.error.details as {
      duplicates: DuplicateLeadDto[];
    };
    expect(details.duplicates).toHaveLength(1);
    expect(details.duplicates[0]?.id).toBe(original.id);

    const emailDuplicate = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Email Duplicate",
        phone: "+1 555 999 0000",
        email: "ORIGINAL@example.com",
        source: "Website",
      },
    });
    await expectError(emailDuplicate, 409, "possible_duplicate");

    const allowed = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Allowed Duplicate",
        phone: "+15557778888",
        source: "Website",
        allowDuplicate: true,
      },
    });
    expect(allowed.status).toBe(201);

    const checkResponse = await apiRequest(
      `/api/leads/check-duplicate?phone=${encodeURIComponent("+1 555 777 8888")}`,
      { auth },
    );
    expect(checkResponse.status).toBe(200);
    const check = await parseData<{ duplicates: DuplicateLeadDto[] }>(
      checkResponse,
    );
    expect(check.duplicates.length).toBeGreaterThanOrEqual(2);
    expect(check.duplicates.every((row) => row.canView)).toBe(true);
  });
});

describe("lead assignment and RBAC", () => {
  it("auto-assigns employee-created leads and blocks reassignment", async () => {
    const employee = await createUser({ role: "employee" });
    const other = await createUser({ role: "employee" });
    const auth = await login(employee.email);

    const lead = await createLead(auth);
    expect(lead.assignedTo).toBe(employee.id);
    expect(lead.assignedToName).toBe(employee.fullName);

    const assignAttempt = await apiRequest(`/api/leads/${lead.id}/assign`, {
      method: "POST",
      auth,
      body: { assignedTo: other.id },
    });
    await expectError(assignAttempt, 403, "forbidden");

    const createForOther = await apiRequest("/api/leads", {
      method: "POST",
      auth,
      body: {
        name: "Someone Else",
        phone: "+1 555 123 9999",
        source: "Website",
        assignedTo: other.id,
      },
    });
    await expectError(createForOther, 403, "forbidden");
  });

  it("restricts employee visibility to assigned or created leads", async () => {
    const owner = await createUser({ role: "owner" });
    const employeeA = await createUser({ role: "employee" });
    const employeeB = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const employeeAAuth = await login(employeeA.email);
    const employeeBAuth = await login(employeeB.email);

    const leadForA = await createLead(ownerAuth, {
      name: "Owned by A",
      assignedTo: employeeA.id,
    });
    const leadForB = await createLead(ownerAuth, {
      name: "Owned by B",
      assignedTo: employeeB.id,
    });
    const unassigned = await createLead(ownerAuth, { name: "Unassigned" });

    const visibleToB = await listLeads(employeeBAuth);
    expect(visibleToB.items.map((lead) => lead.id)).toContain(leadForB.id);
    expect(visibleToB.items.map((lead) => lead.id)).not.toContain(leadForA.id);
    expect(visibleToB.items.map((lead) => lead.id)).not.toContain(unassigned.id);

    const viewForbidden = await apiRequest(`/api/leads/${leadForA.id}`, {
      auth: employeeBAuth,
    });
    await expectError(viewForbidden, 403, "forbidden");

    const editForbidden = await apiRequest(`/api/leads/${leadForA.id}`, {
      method: "PATCH",
      auth: employeeBAuth,
      body: { name: "Hijacked" },
    });
    await expectError(editForbidden, 403, "forbidden");

    const editAllowed = await apiRequest(`/api/leads/${leadForA.id}`, {
      method: "PATCH",
      auth: employeeAAuth,
      body: { name: "Owned by A (updated)" },
    });
    expect(editAllowed.status).toBe(200);
    const updated = await parseData<{ lead: LeadDto }>(editAllowed);
    expect(updated.lead.name).toBe("Owned by A (updated)");

    const myLeads = await listLeads(employeeAAuth, "?quickFilter=my_leads");
    expect(myLeads.items.map((lead) => lead.id)).toEqual([leadForA.id]);
  });

  it("lets admins assign leads team-wide", async () => {
    const admin = await createUser({ role: "admin" });
    const employee = await createUser({ role: "employee" });
    const auth = await login(admin.email);

    const lead = await createLead(auth, { name: "Unassigned lead" });
    expect(lead.assignedTo).toBeNull();

    const assignResponse = await apiRequest(`/api/leads/${lead.id}/assign`, {
      method: "POST",
      auth,
      body: { assignedTo: employee.id },
    });
    expect(assignResponse.status).toBe(200);
    const assigned = await parseData<{ lead: LeadDto }>(assignResponse);
    expect(assigned.lead.assignedTo).toBe(employee.id);
    expect(assigned.lead.assignedToName).toBe(employee.fullName);
  });
});

describe("lead listing, search, filters and pagination", () => {
  it("paginates without overlap and supports filters and search", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const leads = [];
    for (let index = 0; index < 5; index += 1) {
      leads.push(
        await createLead(auth, {
          name: `Alpha Lead ${index}`,
          source: index % 2 === 0 ? "Website" : "Referral",
          priority: index === 0 ? "high" : "medium",
          location: index === 0 ? "Mumbai" : undefined,
        }),
      );
    }

    const firstPage = await listLeads(auth, "?page=1&pageSize=2");
    const secondPage = await listLeads(auth, "?page=2&pageSize=2");

    expect(firstPage.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(2);
    const firstIds = new Set(firstPage.items.map((lead) => lead.id));
    expect(secondPage.items.some((lead) => firstIds.has(lead.id))).toBe(false);

    const websiteLeads = await listLeads(auth, "?source=Website");
    expect(websiteLeads.items).toHaveLength(3);
    expect(websiteLeads.items.every((lead) => lead.source === "Website")).toBe(
      true,
    );

    const highPriority = await listLeads(auth, "?priority=high");
    expect(highPriority.items).toHaveLength(1);
    expect(highPriority.items[0]?.location).toBe("Mumbai");

    const searchResults = await listLeads(auth, "?search=Alpha");
    expect(searchResults.items).toHaveLength(5);

    const sortedAsc = await listLeads(auth, "?sortBy=created_at&sortDir=asc");
    const ascendingDates = sortedAsc.items.map((lead) =>
      Date.parse(lead.createdAt),
    );
    expect([...ascendingDates].sort((a, b) => a - b)).toEqual(ascendingDates);

    const sortedDesc = await listLeads(auth, "?sortBy=created_at&sortDir=desc");
    const descendingDates = sortedDesc.items.map((lead) =>
      Date.parse(lead.createdAt),
    );
    expect([...descendingDates].sort((a, b) => b - a)).toEqual(descendingDates);
    expect(new Set(sortedDesc.items.map((lead) => lead.id)).size).toBe(5);
  });

  it("supports quick filters for stage, contact status and follow-up windows", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const newLead = await createLead(auth, { name: "Fresh enquiry" });
    const contacted = await createLead(auth, { name: "Contacted enquiry" });
    await apiRequest(`/api/leads/${contacted.id}/activities`, {
      method: "POST",
      auth,
      body: {
        activityType: "call",
        title: "Called the lead",
        contacted: true,
      },
    });

    const today = futureWithinToday();
    const overdue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const dueTodayLead = await createLead(auth, {
      name: "Due today",
      nextFollowUpAt: today,
    });
    const overdueLead = await createLead(auth, {
      name: "Overdue lead",
      nextFollowUpAt: overdue,
    });

    const newResults = await listLeads(auth, "?quickFilter=new");
    expect(newResults.items.map((lead) => lead.id)).toEqual(
      expect.arrayContaining([newLead.id, contacted.id, dueTodayLead.id]),
    );

    const contactedResults = await listLeads(auth, "?quickFilter=contacted");
    expect(contactedResults.items.map((lead) => lead.id)).toContain(
      contacted.id,
    );

    const dueResults = await listLeads(auth, "?quickFilter=follow_up_due");
    expect(dueResults.items.map((lead) => lead.id)).toContain(dueTodayLead.id);

    const overdueResults = await listLeads(auth, "?quickFilter=overdue");
    expect(overdueResults.items.map((lead) => lead.id)).toContain(
      overdueLead.id,
    );
    expect(overdueResults.items.map((lead) => lead.id)).not.toContain(
      dueTodayLead.id,
    );
  });

  it("hides archived leads unless explicitly requested", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Archive me" });

    const archiveResponse = await apiRequest(`/api/leads/${lead.id}`, {
      method: "DELETE",
      auth,
    });
    expect(archiveResponse.status).toBe(200);

    const visible = await listLeads(auth);
    expect(visible.items.map((row) => row.id)).not.toContain(lead.id);

    const archived = await listLeads(auth, "?includeArchived=true");
    expect(archived.items.map((row) => row.id)).toContain(lead.id);

    const detail = await apiRequest(`/api/leads/${lead.id}`, { auth });
    await expectError(detail, 404, "not_found");
  });

  it("permanently deletes a lead and keeps an audit record", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const employeeAuth = await login(employee.email);
    const lead = await createLead(ownerAuth, { name: "Permanent delete lead" });

    const denied = await apiRequest(`/api/leads/${lead.id}/permanent`, {
      method: "DELETE",
      auth: employeeAuth,
    });
    await expectError(denied, 403, "forbidden");

    const deleted = await apiRequest(`/api/leads/${lead.id}/permanent`, {
      method: "DELETE",
      auth: ownerAuth,
    });
    expect(deleted.status).toBe(200);
    expect(await parseData<{ deleted: boolean }>(deleted)).toEqual({
      deleted: true,
    });

    const detail = await apiRequest(`/api/leads/${lead.id}`, {
      auth: ownerAuth,
    });
    await expectError(detail, 404, "not_found");

    const remainingActivities = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM lead_activities WHERE lead_id = ?",
    )
      .bind(lead.id)
      .first<{ count: number }>();
    expect(remainingActivities?.count).toBe(0);

    const audit = await env.DB.prepare(
      "SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'lead.deleted' LIMIT 1",
    )
      .bind(lead.id)
      .first<{ action: string }>();
    expect(audit?.action).toBe("lead.deleted");
  });
});

describe("lead pipeline and interactions", () => {
  it("validates stage transitions, loss reasons, won/lost and reopening", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Pipeline lead" });

    const sameStage = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "new" },
    });
    await expectError(sameStage, 400, "same_stage");

    const qualified = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "qualified", reason: "Budget confirmed" },
    });
    expect(qualified.status).toBe(200);
    expect((await parseData<{ lead: LeadDto }>(qualified)).lead.pipelineStage).toBe(
      "qualified",
    );

    const lostWithoutReason = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "lost" },
    });
    await expectError(lostWithoutReason, 400, "lost_reason_required");

    const lost = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "lost", lostReason: "Chose a competitor" },
    });
    expect(lost.status).toBe(200);
    const lostLead = (await parseData<{ lead: LeadDto }>(lost)).lead;
    expect(lostLead.pipelineStage).toBe("lost");
    expect(lostLead.lostReason).toBe("Chose a competitor");

    const wonFromLost = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "won" },
    });
    await expectError(wonFromLost, 400, "invalid_transition");

    const reopened = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "contacted" },
    });
    expect(reopened.status).toBe(200);
    const reopenedLead = (await parseData<{ lead: LeadDto }>(reopened)).lead;
    expect(reopenedLead.pipelineStage).toBe("contacted");
    expect(reopenedLead.lostReason).toBeNull();

    const won = await apiRequest(`/api/leads/${lead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "won" },
    });
    expect(won.status).toBe(200);
    const wonLead = (await parseData<{ lead: LeadDto }>(won)).lead;
    expect(wonLead.pipelineStage).toBe("won");
    expect(wonLead.convertedAt).not.toBeNull();
    expect(wonLead.contactStatus).toBe("contacted");

    const activitiesResponse = await apiRequest(
      `/api/leads/${lead.id}/activities?pageSize=100`,
      { auth },
    );
    const activities = await parseData<Paginated<LeadActivityDto>>(
      activitiesResponse,
    );
    const types = activities.items.map((activity) => activity.activityType);
    expect(types).toEqual(
      expect.arrayContaining([
        "stage_changed",
        "lead_lost",
        "lead_reopened",
        "lead_won",
      ]),
    );
  });

  it("updates contact status from interactions and records the timeline", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, { name: "Interaction lead" });

    const attemptedResponse = await apiRequest(
      `/api/leads/${lead.id}/activities`,
      {
        method: "POST",
        auth,
        body: {
          activityType: "call",
          title: "No answer",
        },
      },
    );
    expect(attemptedResponse.status).toBe(201);
    const attempted = await parseData<{
      activity: LeadActivityDto;
      lead: LeadDto;
    }>(attemptedResponse);
    expect(attempted.lead.contactStatus).toBe("attempted");
    expect(attempted.lead.lastContactedAt).toBeNull();

    const contactedResponse = await apiRequest(
      `/api/leads/${lead.id}/activities`,
      {
        method: "POST",
        auth,
        body: {
          activityType: "whatsapp",
          title: "Shared the proposal",
          contacted: true,
          description: "Sent pricing and timeline.",
        },
      },
    );
    expect(contactedResponse.status).toBe(201);
    const contacted = await parseData<{
      activity: LeadActivityDto;
      lead: LeadDto;
    }>(contactedResponse);
    expect(contacted.lead.contactStatus).toBe("contacted");
    expect(contacted.lead.lastContactedAt).not.toBeNull();

    const activitiesResponse = await apiRequest(
      `/api/leads/${lead.id}/activities?pageSize=100`,
      { auth },
    );
    const activities = await parseData<Paginated<LeadActivityDto>>(
      activitiesResponse,
    );
    expect(activities.items[0]?.activityType).toBe("whatsapp");
    expect(activities.items[0]?.title).toBe("Shared the proposal");
    expect(
      activities.items.some((activity) => activity.activityType === "call"),
    ).toBe(true);
  });

  it("returns pipeline columns with counts that respect employee scope", async () => {
    const owner = await createUser({ role: "owner" });
    const employeeA = await createUser({ role: "employee" });
    const employeeB = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const employeeAuth = await login(employeeB.email);

    await createLead(ownerAuth, {
      name: "Qualified for A",
      assignedTo: employeeA.id,
    }).then((lead) =>
      apiRequest(`/api/leads/${lead.id}/stage`, {
        method: "POST",
        auth: ownerAuth,
        body: { stage: "qualified" },
      }),
    );
    await createLead(ownerAuth, {
      name: "New for B",
      assignedTo: employeeB.id,
    });

    const ownerPipelineResponse = await apiRequest("/api/leads/pipeline", {
      auth: ownerAuth,
    });
    expect(ownerPipelineResponse.status).toBe(200);
    const ownerPipeline = await parseData<{ pipeline: LeadPipelineDto }>(
      ownerPipelineResponse,
    );
    expect(ownerPipeline.pipeline.total).toBe(2);
    const qualifiedColumn = ownerPipeline.pipeline.columns.find(
      (column) => column.stage === "qualified",
    );
    expect(qualifiedColumn?.count).toBe(1);

    const employeePipelineResponse = await apiRequest("/api/leads/pipeline", {
      auth: employeeAuth,
    });
    const employeePipeline = await parseData<{ pipeline: LeadPipelineDto }>(
      employeePipelineResponse,
    );
    expect(employeePipeline.pipeline.total).toBe(1);
    const newColumn = employeePipeline.pipeline.columns.find(
      (column) => column.stage === "new",
    );
    expect(newColumn?.count).toBe(1);
  });
});

describe("lead dashboard statistics", () => {
  it("returns real lead counts, pipeline, sources and follow-ups for the organization", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const wonLead = await createLead(auth, {
      name: "Won lead",
      source: "Referral",
      estimatedValue: 500000,
    });
    await apiRequest(`/api/leads/${wonLead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "won" },
    });

    const openLead = await createLead(auth, {
      name: "Open lead",
      source: "Website",
    });
    await apiRequest(`/api/leads/${openLead.id}/follow-ups`, {
      method: "POST",
      auth,
      body: {
        title: "Call back",
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    const lostLead = await createLead(auth, {
      name: "Lost lead",
      source: "Website",
    });
    await apiRequest(`/api/leads/${lostLead.id}/stage`, {
      method: "POST",
      auth,
      body: { stage: "lost", lostReason: "No budget" },
    });

    const response = await apiRequest("/api/dashboard/lead-stats", { auth });
    expect(response.status).toBe(200);
    const stats = await parseData<LeadDashboardStatsDto>(response);

    expect(stats.scope).toBe("organization");
    expect(stats.counts.total).toBe(3);
    expect(stats.counts.won).toBe(1);
    expect(stats.counts.lost).toBe(1);
    expect(stats.counts.new).toBe(1);
    expect(stats.recentLeads).toHaveLength(3);
    expect(stats.pipeline.find((row) => row.stage === "won")?.count).toBe(1);
    expect(
      stats.sources.find((row) => row.source === "Website")?.count,
    ).toBe(2);
    expect(stats.conversion).toMatchObject({
      won: 1,
      lost: 1,
      open: 1,
      conversionRate: 50,
      wonValue: 500000,
    });

    const dashboardResponse = await apiRequest("/api/dashboard/stats", { auth });
    expect(dashboardResponse.status).toBe(200);
    const dashboard = await parseData<{ leadStats: LeadDashboardStatsDto }>(
      dashboardResponse,
    );
    expect(dashboard.leadStats.counts.total).toBe(3);
  });

  it("scopes lead statistics to an employee's own records", async () => {
    const owner = await createUser({ role: "owner" });
    const employeeA = await createUser({ role: "employee" });
    const employeeB = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const employeeAuth = await login(employeeB.email);

    await createLead(ownerAuth, {
      name: "Lead for A",
      assignedTo: employeeA.id,
    });
    await createLead(ownerAuth, {
      name: "Lead for B",
      assignedTo: employeeB.id,
    });
    await createLead(ownerAuth, { name: "Unassigned" });

    const response = await apiRequest("/api/dashboard/lead-stats", {
      auth: employeeAuth,
    });
    const stats = await parseData<LeadDashboardStatsDto>(response);
    expect(stats.scope).toBe("personal");
    expect(stats.counts.total).toBe(1);
    expect(stats.recentLeads[0]?.assignedTo).toBe(employeeB.id);
  });
});
