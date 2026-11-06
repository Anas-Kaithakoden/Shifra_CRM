import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getCrmDayBounds } from "../src/server/lib/time";
import type { Paginated } from "../src/shared/types/api";
import type {
  ConvertLeadResultDto,
  CustomerActivityDto,
  CustomerDashboardStatsDto,
  CustomerDetailDto,
  CustomerListItemDto,
  CustomerRenewalListDto,
  DuplicateCustomerDto,
} from "../src/shared/types/customers";
import type { LeadDto } from "../src/shared/types/leads";
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
    email: `customer.${suffix}@example.com`,
  };
}

async function createCustomer(
  auth: AuthSession,
  overrides: Record<string, unknown> = {},
): Promise<CustomerDetailDto> {
  const contact = uniqueContact();
  const response = await apiRequest("/api/customers", {
    method: "POST",
    auth,
    body: {
      name: "Test Customer",
      phone: contact.phone,
      email: contact.email,
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  const body = await parseData<{ customer: CustomerDetailDto }>(response);
  return body.customer;
}

async function getCustomer(
  auth: AuthSession,
  id: string,
): Promise<CustomerDetailDto> {
  const response = await apiRequest(`/api/customers/${id}`, { auth });
  expect(response.status).toBe(200);
  const body = await parseData<{ customer: CustomerDetailDto }>(response);
  return body.customer;
}

async function listCustomers(
  auth: AuthSession,
  query = "",
): Promise<Paginated<CustomerListItemDto>> {
  const response = await apiRequest(`/api/customers${query}`, { auth });
  expect(response.status).toBe(200);
  return parseData<Paginated<CustomerListItemDto>>(response);
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
      name: "Conversion Lead",
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

async function winLead(auth: AuthSession, leadId: string): Promise<LeadDto> {
  const response = await apiRequest(`/api/leads/${leadId}/stage`, {
    method: "POST",
    auth,
    body: { stage: "won" },
  });
  expect(response.status).toBe(200);
  const body = await parseData<{ lead: LeadDto }>(response);
  return body.lead;
}

function numericCustomerNumber(value: string): number {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : Number.NaN;
}

describe("customer CRUD and lifecycle", () => {
  it("creates sequential customer numbers with a primary contact and complete history", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const first = await createCustomer(auth, {
      type: "business",
      name: "Ayesha Khan",
      businessName: "Khan Textiles",
      city: "Mumbai",
      state: "Maharashtra",
      notes: "Prefers WhatsApp.",
    });

    expect(first.customerNumber).toMatch(/^SN-CUS-\d{4,}$/);
    expect(first.type).toBe("business");
    expect(first.businessName).toBe("Khan Textiles");
    expect(first.status).toBe("active");
    expect(first.assignedTo).toBeNull();
    expect(first.createdBy).toBe(owner.id);
    expect(first.contacts).toHaveLength(1);
    expect(first.primaryContact).toMatchObject({
      fullName: "Ayesha Khan",
      isPrimary: true,
    });
    expect(first.stats.contactCount).toBe(1);

    const second = await createCustomer(auth, {
      type: "individual",
      name: "Rohan Mehta",
    });
    expect(numericCustomerNumber(second.customerNumber)).toBe(
      numericCustomerNumber(first.customerNumber) + 1,
    );

    const activitiesResponse = await apiRequest(
      `/api/customers/${first.id}/activities?pageSize=100`,
      { auth },
    );
    expect(activitiesResponse.status).toBe(200);
    const activities = await parseData<Paginated<CustomerActivityDto>>(
      activitiesResponse,
    );
    expect(activities.items.map((row) => row.activityType)).toEqual(
      expect.arrayContaining(["customer_created", "contact_added"]),
    );

    const updatedResponse = await apiRequest(`/api/customers/${first.id}`, {
      method: "PATCH",
      auth,
      body: {
        name: "Ayesha Khan",
        city: "Pune",
        email: "ayesha.updated@example.com",
        status: "inactive",
      },
    });
    expect(updatedResponse.status).toBe(200);
    const updated = await parseData<{ customer: CustomerDetailDto }>(
      updatedResponse,
    );
    expect(updated.customer.city).toBe("Pune");
    expect(updated.customer.email).toBe("ayesha.updated@example.com");
    expect(updated.customer.status).toBe("inactive");

    const archivedResponse = await apiRequest(
      `/api/customers/${first.id}/archive`,
      { method: "POST", auth },
    );
    expect(archivedResponse.status).toBe(200);
    const archived = await parseData<{ customer: CustomerDetailDto }>(
      archivedResponse,
    );
    expect(archived.customer.status).toBe("archived");
    expect(archived.customer.archivedAt).not.toBeNull();

    const defaultList = await listCustomers(auth, "?pageSize=100");
    expect(defaultList.items.some((row) => row.id === first.id)).toBe(false);

    const archivedList = await listCustomers(
      auth,
      "?pageSize=100&includeArchived=true",
    );
    expect(
      archivedList.items.find((row) => row.id === first.id)?.status,
    ).toBe("archived");

    const restoredResponse = await apiRequest(
      `/api/customers/${first.id}/restore`,
      { method: "POST", auth },
    );
    expect(restoredResponse.status).toBe(200);
    const restored = await parseData<{ customer: CustomerDetailDto }>(
      restoredResponse,
    );
    expect(restored.customer.status).toBe("inactive");
    expect(restored.customer.archivedAt).toBeNull();
    expect(restored.customer.contacts).toHaveLength(1);

    const finalActivitiesResponse = await apiRequest(
      `/api/customers/${first.id}/activities?pageSize=100`,
      { auth },
    );
    const finalActivities = await parseData<Paginated<CustomerActivityDto>>(
      finalActivitiesResponse,
    );
    expect(finalActivities.items.map((row) => row.activityType)).toEqual(
      expect.arrayContaining([
        "customer_updated",
        "status_changed",
        "customer_archived",
        "customer_restored",
      ]),
    );

    const auditResponse = await apiRequest("/api/audit-logs?pageSize=100", {
      auth,
    });
    expect(auditResponse.status).toBe(200);
    const auditText = await auditResponse.text();
    expect(auditText).toContain("customer.created");
    expect(auditText).toContain("customer.archived");
    expect(auditText).toContain("customer.restored");
  });

  it("stores service cost, profit, delivery and renewal dates", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const created = await createCustomer(auth, {
      serviceName: "Website maintenance",
      serviceCategory: "digital_solutions",
      totalCost: 125000,
      profit: 32500,
      serviceDeliveredOn: "2026-02-10",
      renewalOn: "2027-02-10",
    });

    expect(created.serviceName).toBe("Website maintenance");
    expect(created.serviceCategory).toBe("digital_solutions");
    expect(created.totalCost).toBe(125000);
    expect(created.profit).toBe(32500);
    expect(created.serviceDeliveredOn).toBe("2026-02-10");
    expect(created.renewalOn).toBe("2027-02-10");

    const listed = await listCustomers(auth, "?pageSize=100");
    expect(listed.items.find((row) => row.id === created.id)).toMatchObject({
      serviceName: "Website maintenance",
      serviceCategory: "digital_solutions",
      totalCost: 125000,
      profit: 32500,
      serviceDeliveredOn: "2026-02-10",
      renewalOn: "2027-02-10",
    });

    const updateResponse = await apiRequest(`/api/customers/${created.id}`, {
      method: "PATCH",
      auth,
      body: { totalCost: 130000, profit: -5000, renewalOn: null },
    });
    expect(updateResponse.status).toBe(200);
    const updated = await parseData<{ customer: CustomerDetailDto }>(
      updateResponse,
    );
    expect(updated.customer.totalCost).toBe(130000);
    expect(updated.customer.profit).toBe(-5000);
    expect(updated.customer.serviceDeliveredOn).toBe("2026-02-10");
    expect(updated.customer.renewalOn).toBeNull();

    const invalidDate = await apiRequest(`/api/customers/${created.id}`, {
      method: "PATCH",
      auth,
      body: { renewalOn: "10-02-2027" },
    });
    await expectError(invalidDate, 400, "validation_error");
  });

  it("detects normalized duplicates and requires an explicit override", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const original = await createCustomer(auth, {
      name: "Acme Contact",
      businessName: "Acme Solutions",
      phone: "+1 (555) 222-3344",
      email: "hello@acme.example",
    });

    const phoneDuplicate = await apiRequest("/api/customers", {
      method: "POST",
      auth,
      body: {
        name: "Phone Duplicate",
        phone: "+15552223344",
      },
    });
    const phoneBody = await expectError(
      phoneDuplicate,
      409,
      "possible_duplicate",
    );
    const phoneDetails = phoneBody.error.details as {
      duplicates: DuplicateCustomerDto[];
      canOverride: boolean;
    };
    expect(phoneDetails.canOverride).toBe(true);
    expect(phoneDetails.duplicates).toHaveLength(1);
    expect(phoneDetails.duplicates[0]?.id).toBe(original.id);
    expect(phoneDetails.duplicates[0]?.matchedOn).toContain("phone");

    const emailDuplicate = await apiRequest("/api/customers", {
      method: "POST",
      auth,
      body: {
        name: "Email Duplicate",
        phone: "+1 555 444 5566",
        email: "HELLO@ACME.EXAMPLE",
      },
    });
    const emailBody = await expectError(
      emailDuplicate,
      409,
      "possible_duplicate",
    );
    const emailDetails = emailBody.error.details as {
      duplicates: DuplicateCustomerDto[];
    };
    expect(emailDetails.duplicates[0]?.matchedOn).toContain("email");

    const businessDuplicate = await apiRequest("/api/customers", {
      method: "POST",
      auth,
      body: {
        type: "business",
        name: "Other Contact",
        businessName: "  acme   solutions! ",
        phone: "+1 555 444 7788",
      },
    });
    const businessBody = await expectError(
      businessDuplicate,
      409,
      "possible_duplicate",
    );
    const businessDetails = businessBody.error.details as {
      duplicates: DuplicateCustomerDto[];
    };
    expect(businessDetails.duplicates[0]?.matchedOn).toContain("business_name");

    const override = await apiRequest("/api/customers", {
      method: "POST",
      auth,
      body: {
        name: "Separate Customer",
        phone: "+15552223344",
        allowDuplicate: true,
      },
    });
    expect(override.status).toBe(201);

    const checkResponse = await apiRequest(
      `/api/customers/duplicates?phone=${encodeURIComponent("+1 555 222 3344")}`,
      { auth },
    );
    expect(checkResponse.status).toBe(200);
    const check = await parseData<{ duplicates: DuplicateCustomerDto[] }>(
      checkResponse,
    );
    expect(check.duplicates.length).toBeGreaterThanOrEqual(2);
    expect(check.duplicates.every((row) => row.canView)).toBe(true);

    const other = await createCustomer(auth, { name: "Another Customer" });
    const updateDuplicate = await apiRequest(`/api/customers/${original.id}`, {
      method: "PATCH",
      auth,
      body: { phone: other.phone },
    });
    await expectError(updateDuplicate, 409, "possible_duplicate");

    const updateAllowed = await apiRequest(`/api/customers/${original.id}`, {
      method: "PATCH",
      auth,
      body: { phone: other.phone, allowDuplicate: true },
    });
    expect(updateAllowed.status).toBe(200);
  });

  it("enforces the single-primary-contact invariant at the service and database layers", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const customer = await createCustomer(auth, {
      type: "business",
      name: "Primary Contact",
      businessName: "Primary Test Co",
    });
    const originalPrimary = customer.primaryContact;
    expect(originalPrimary).not.toBeNull();

    const addResponse = await apiRequest(
      `/api/customers/${customer.id}/contacts`,
      {
        method: "POST",
        auth,
        body: {
          fullName: "Second Contact",
          jobTitle: "Finance",
          phone: "+1 555 909 1111",
          isPrimary: true,
        },
      },
    );
    expect(addResponse.status).toBe(201);
    const added = await parseData<{ contact: { id: string } }>(addResponse);

    let detail = await getCustomer(auth, customer.id);
    expect(detail.contacts).toHaveLength(2);
    expect(detail.contacts.filter((contact) => contact.isPrimary)).toHaveLength(
      1,
    );
    expect(detail.primaryContact?.id).toBe(added.contact.id);
    expect(
      detail.contacts.find((contact) => contact.id === originalPrimary?.id)
        ?.isPrimary,
    ).toBe(false);

    const demoteResponse = await apiRequest(
      `/api/customers/${customer.id}/contacts/${added.contact.id}`,
      {
        method: "PATCH",
        auth,
        body: { isPrimary: false },
      },
    );
    expect(demoteResponse.status).toBe(200);
    detail = await getCustomer(auth, customer.id);
    expect(detail.contacts.filter((contact) => contact.isPrimary)).toHaveLength(
      1,
    );
    expect(detail.primaryContact?.id).toBe(originalPrimary?.id);

    const invalidContact = await apiRequest(
      `/api/customers/${customer.id}/contacts`,
      {
        method: "POST",
        auth,
        body: { fullName: "No Contact Details" },
      },
    );
    await expectError(invalidContact, 400, "validation_error");

    await expect(
      env.DB.prepare(
        `INSERT INTO customer_contacts (id, customer_id, full_name, is_primary)
         VALUES (?, ?, ?, 1)`,
      )
        .bind(crypto.randomUUID(), customer.id, "Conflicting Primary")
        .run(),
    ).rejects.toThrow();

    const removeResponse = await apiRequest(
      `/api/customers/${customer.id}/contacts/${detail.primaryContact?.id}`,
      { method: "DELETE", auth },
    );
    expect(removeResponse.status).toBe(200);
    detail = await getCustomer(auth, customer.id);
    expect(detail.contacts).toHaveLength(1);
    expect(detail.contacts[0]?.isPrimary).toBe(true);

    const activitiesResponse = await apiRequest(
      `/api/customers/${customer.id}/activities?pageSize=100`,
      { auth },
    );
    const activities = await parseData<Paginated<CustomerActivityDto>>(
      activitiesResponse,
    );
    expect(activities.items.map((row) => row.activityType)).toEqual(
      expect.arrayContaining([
        "contact_added",
        "primary_contact_changed",
        "contact_removed",
      ]),
    );
  });

  it("adds multiple customer services and returns them in customer details", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const customer = await createCustomer(auth, { name: "Multi-service Customer" });

    const firstResponse = await apiRequest(
      `/api/customers/${customer.id}/services`,
      {
        method: "POST",
        auth,
        body: {
          serviceName: "Website maintenance",
          serviceCategory: "digital_solutions",
          totalCost: 12000.5,
          profit: 2500,
          serviceDeliveredOn: "2026-01-15",
          renewalOn: "2027-01-15",
        },
      },
    );
    expect(firstResponse.status).toBe(201);
    const first = await parseData<{ service: { id: string } }>(firstResponse);

    const secondResponse = await apiRequest(
      `/api/customers/${customer.id}/services`,
      {
        method: "POST",
        auth,
        body: { serviceName: "Logo design" },
      },
    );
    expect(secondResponse.status).toBe(201);

    const detail = await getCustomer(auth, customer.id);
    expect(detail.services).toHaveLength(2);
    expect(detail.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.service.id,
          serviceName: "Website maintenance",
          serviceCategory: "digital_solutions",
          totalCost: 12000.5,
          profit: 2500,
          serviceDeliveredOn: "2026-01-15",
          renewalOn: "2027-01-15",
        }),
        expect.objectContaining({ serviceName: "Logo design" }),
      ]),
    );
  });

  it("lists renewal reminder statuses for all accessible customer services", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const customer = await createCustomer(auth, { name: "Renewal Status Customer" });
    const { dateKey } = getCrmDayBounds();
    const addDays = (days: number) => {
      const date = new Date(`${dateKey}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const sentAt = new Date().toISOString();
    const services = [
      { serviceName: "Sent reminder", renewalOn: addDays(3) },
      { serviceName: "Failed reminder", renewalOn: addDays(-2) },
      { serviceName: "Pending reminder", renewalOn: addDays(15) },
    ];
    const serviceIds: string[] = [];

    for (const service of services) {
      const response = await apiRequest(
        `/api/customers/${customer.id}/services`,
        { method: "POST", auth, body: service },
      );
      expect(response.status).toBe(201);
      const body = await parseData<{ service: { id: string } }>(response);
      serviceIds.push(body.service.id);
    }

    await env.DB.prepare(
      `UPDATE customer_services
       SET renewal_reminder_for = ?, renewal_reminder_sent_at = ?
       WHERE id = ?`,
    )
      .bind(services[0]?.renewalOn, sentAt, serviceIds[0])
      .run();
    await env.DB.prepare(
      `UPDATE customer_services
       SET renewal_reminder_error = ?, renewal_reminder_attempted_at = ?
       WHERE id = ?`,
    )
      .bind("Telegram unavailable", sentAt, serviceIds[1])
      .run();

    const response = await apiRequest(
      "/api/customers/renewals?filter=all&pageSize=100",
      { auth },
    );
    expect(response.status).toBe(200);
    const result = await parseData<CustomerRenewalListDto>(response);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceName: "Sent reminder",
          reminderStatus: "sent",
          status: "due_soon",
        }),
        expect.objectContaining({
          serviceName: "Failed reminder",
          reminderStatus: "failed",
          status: "overdue",
        }),
        expect.objectContaining({
          serviceName: "Pending reminder",
          reminderStatus: "pending",
          status: "upcoming",
        }),
      ]),
    );

    const overdueResponse = await apiRequest(
      "/api/customers/renewals?filter=overdue",
      { auth },
    );
    expect(overdueResponse.status).toBe(200);
    const overdue = await parseData<CustomerRenewalListDto>(overdueResponse);
    expect(overdue.items.map((item) => item.serviceName)).toContain(
      "Failed reminder",
    );
    expect(overdue.items.map((item) => item.serviceName)).not.toContain(
      "Sent reminder",
    );
  });
});

describe("customer access control", () => {
  it("limits employees to assigned or created customers and blocks protected actions", async () => {
    const owner = await createUser({ role: "owner" });
    const employeeA = await createUser({ role: "employee" });
    const employeeB = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const authA = await login(employeeA.email);

    const forA = await createCustomer(ownerAuth, {
      name: "Customer For A",
      assignedTo: employeeA.id,
    });
    const forB = await createCustomer(ownerAuth, {
      name: "Customer For B",
      assignedTo: employeeB.id,
    });
    await createCustomer(ownerAuth, { name: "Unassigned Customer" });

    const listA = await listCustomers(authA, "?pageSize=100");
    expect(listA.items.map((row) => row.id)).toContain(forA.id);
    expect(listA.items.map((row) => row.id)).not.toContain(forB.id);

    const getOther = await apiRequest(`/api/customers/${forB.id}`, {
      auth: authA,
    });
    await expectError(getOther, 403, "forbidden");

    const updateOther = await apiRequest(`/api/customers/${forB.id}`, {
      method: "PATCH",
      auth: authA,
      body: { name: "Not Allowed" },
    });
    await expectError(updateOther, 403, "forbidden");

    const activitiesOther = await apiRequest(
      `/api/customers/${forB.id}/activities`,
      { auth: authA },
    );
    await expectError(activitiesOther, 403, "forbidden");

    const assignOwn = await apiRequest(`/api/customers/${forA.id}`, {
      method: "PATCH",
      auth: authA,
      body: { assignedTo: employeeB.id },
    });
    await expectError(assignOwn, 403, "forbidden");

    const archiveOwn = await apiRequest(`/api/customers/${forA.id}/archive`, {
      method: "POST",
      auth: authA,
    });
    await expectError(archiveOwn, 403, "forbidden");

    const createdByA = await createCustomer(authA, {
      name: "Created By A",
    });
    expect(createdByA.assignedTo).toBe(employeeA.id);
    expect(createdByA.createdBy).toBe(employeeA.id);

    const duplicateCheck = await apiRequest(
      `/api/customers/duplicates?phone=${encodeURIComponent(forB.phone)}`,
      { auth: authA },
    );
    expect(duplicateCheck.status).toBe(200);
    const duplicates = await parseData<{ duplicates: DuplicateCustomerDto[] }>(
      duplicateCheck,
    );
    expect(duplicates.duplicates[0]?.id).toBe(forB.id);
    expect(duplicates.duplicates[0]?.canView).toBe(false);
    expect(duplicates.duplicates[0]?.name).toBe("Restricted customer");
    expect(duplicates.duplicates[0]?.phone).not.toBe(forB.phone);
    expect(duplicates.duplicates[0]?.email).toBeNull();
  });
});

describe("customer notes and activity history", () => {
  it("appends notes and interactions without overwriting prior history", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const customer = await createCustomer(auth, { name: "History Customer" });

    const firstNote = await apiRequest(`/api/customers/${customer.id}/notes`, {
      method: "POST",
      auth,
      body: { note: "  First note  " },
    });
    expect(firstNote.status).toBe(201);
    const firstNoteBody = await parseData<{ note: CustomerActivityDto }>(
      firstNote,
    );
    expect(firstNoteBody.note.activityType).toBe("note_added");
    expect(firstNoteBody.note.description).toBe("First note");

    const call = await apiRequest(
      `/api/customers/${customer.id}/activities`,
      {
        method: "POST",
        auth,
        body: {
          activityType: "call",
          title: "Called about renewal",
          description: "Discussed the annual plan.",
        },
      },
    );
    expect(call.status).toBe(201);
    expect(
      (await parseData<{ activity: CustomerActivityDto }>(call)).activity
        .activityType,
    ).toBe("call");

    const secondNote = await apiRequest(
      `/api/customers/${customer.id}/notes`,
      {
        method: "POST",
        auth,
        body: { note: "Second note" },
      },
    );
    expect(secondNote.status).toBe(201);

    const historyResponse = await apiRequest(
      `/api/customers/${customer.id}/activities?pageSize=100`,
      { auth },
    );
    const history = await parseData<Paginated<CustomerActivityDto>>(
      historyResponse,
    );
    expect(
      history.items.filter((row) => row.activityType === "note_added"),
    ).toHaveLength(2);
    expect(history.items.some((row) => row.activityType === "call")).toBe(true);
    expect(
      new Set(history.items.map((row) => row.id)).size,
    ).toBe(history.items.length);

    const filteredResponse = await apiRequest(
      `/api/customers/${customer.id}/activities?pageSize=100&activityType=note_added`,
      { auth },
    );
    const filtered = await parseData<Paginated<CustomerActivityDto>>(
      filteredResponse,
    );
    expect(filtered.items).toHaveLength(2);
    expect(filtered.items.every((row) => row.activityType === "note_added")).toBe(
      true,
    );

    const futureActivity = await apiRequest(
      `/api/customers/${customer.id}/activities`,
      {
        method: "POST",
        auth,
        body: {
          activityType: "meeting",
          title: "Future meeting",
          occurredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    );
    await expectError(futureActivity, 400, "invalid_occurred_at");
  });
});

describe("lead conversion", () => {
  it("requires eligibility and confirmation, then converts idempotently", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const lead = await createLead(auth, {
      name: "Nadia Sheikh",
      businessName: "Sheikh Interiors",
      serviceInterest: "Website Design & Development",
      estimatedValue: 250000,
    });

    const beforeWon = await apiRequest(
      `/api/leads/${lead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: { mode: "create", confirmCreate: true },
      },
    );
    await expectError(beforeWon, 409, "lead_not_eligible");

    await winLead(auth, lead.id);

    const noConfirmation = await apiRequest(
      `/api/leads/${lead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: { mode: "create" },
      },
    );
    await expectError(noConfirmation, 400, "confirmation_required");

    const conversion = await apiRequest(
      `/api/leads/${lead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: {
          mode: "create",
          confirmCreate: true,
          customer: {
            type: "business",
            name: "Nadia Sheikh",
            businessName: "Sheikh Interiors",
            city: "Hyderabad",
            notes: "Review the prefilled conversion details.",
          },
        },
      },
    );
    expect(conversion.status).toBe(201);
    const result = await parseData<ConvertLeadResultDto>(conversion);
    expect(result.alreadyLinked).toBe(false);
    expect(result.customer.type).toBe("business");
    expect(result.customer.businessName).toBe("Sheikh Interiors");
    expect(result.customer.name).toBe("Nadia Sheikh");
    expect(result.customer.primaryContact?.isPrimary).toBe(true);
    expect(result.customer.phone).toBe(lead.phone);
    expect(result.customer.leads).toHaveLength(1);
    expect(result.customer.leads[0]?.id).toBe(lead.id);
    expect(result.customer.stats.wonLeadCount).toBe(1);

    const leadResponse = await apiRequest(`/api/leads/${lead.id}`, { auth });
    const convertedLead = await parseData<{ lead: LeadDto }>(leadResponse);
    expect(convertedLead.lead.customerId).toBe(result.customer.id);
    expect(convertedLead.lead.convertedToCustomerAt).not.toBeNull();

    const repeated = await apiRequest(
      `/api/leads/${lead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: { mode: "create", confirmCreate: true },
      },
    );
    expect(repeated.status).toBe(200);
    const repeatedResult = await parseData<ConvertLeadResultDto>(repeated);
    expect(repeatedResult.alreadyLinked).toBe(true);
    expect(repeatedResult.customer.id).toBe(result.customer.id);

    const customerList = await listCustomers(auth, "?pageSize=100");
    expect(
      customerList.items.filter(
        (row) => row.phone === lead.phone,
      ),
    ).toHaveLength(1);
  });

  it("links an existing customer and detects conversion duplicates", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);
    const existing = await createCustomer(auth, {
      name: "Existing Contact",
      businessName: "Existing Business",
    });

    const lead = await createLead(auth, {
      name: "Link Me",
      businessName: "A Different Business",
      phone: "+1 555 777 1212",
      email: "link.me@example.com",
    });
    await winLead(auth, lead.id);

    const linkResponse = await apiRequest(
      `/api/leads/${lead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: { mode: "link", customerId: existing.id },
      },
    );
    expect(linkResponse.status).toBe(201);
    const linked = await parseData<ConvertLeadResultDto>(linkResponse);
    expect(linked.customer.id).toBe(existing.id);
    expect(linked.customer.stats.wonLeadCount).toBe(1);

    const repeatLink = await apiRequest(
      `/api/leads/${lead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: { mode: "link", customerId: existing.id },
      },
    );
    expect(repeatLink.status).toBe(200);
    expect(
      (await parseData<ConvertLeadResultDto>(repeatLink)).alreadyLinked,
    ).toBe(true);

    const duplicateLead = await createLead(auth, {
      name: "Duplicate Won Lead",
      phone: existing.phone,
      businessName: "Duplicate Business",
    });
    await winLead(auth, duplicateLead.id);

    const duplicateConversion = await apiRequest(
      `/api/leads/${duplicateLead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: { mode: "create", confirmCreate: true },
      },
    );
    const duplicateBody = await expectError(
      duplicateConversion,
      409,
      "possible_duplicate",
    );
    const details = duplicateBody.error.details as {
      duplicates: DuplicateCustomerDto[];
    };
    expect(details.duplicates.some((row) => row.id === existing.id)).toBe(true);

    const allowedConversion = await apiRequest(
      `/api/leads/${duplicateLead.id}/convert-to-customer`,
      {
        method: "POST",
        auth,
        body: {
          mode: "create",
          confirmCreate: true,
          allowDuplicate: true,
        },
      },
    );
    expect(allowedConversion.status).toBe(201);
    const allowed = await parseData<ConvertLeadResultDto>(allowedConversion);
    expect(allowed.customer.id).not.toBe(existing.id);
    expect(allowed.customer.phone).toBe(existing.phone);

    const checkLink = await apiRequest(
      `/api/customers/${existing.id}/leads`,
      { method: "POST", auth, body: { leadId: lead.id } },
    );
    expect(checkLink.status).toBe(200);
    expect(
      (await parseData<{ alreadyLinked: boolean }>(checkLink)).alreadyLinked,
    ).toBe(true);
  });
});

describe("customer dashboard statistics", () => {
  it("reports real team-wide and employee-scoped customer metrics", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });
    const ownerAuth = await login(owner.email);
    const employeeAuth = await login(employee.email);

    const business = await createCustomer(ownerAuth, {
      type: "business",
      name: "Business Contact",
      businessName: "Metrics Business",
    });
    const inactive = await createCustomer(ownerAuth, {
      type: "individual",
      name: "Inactive Individual",
      status: "inactive",
    });
    await createCustomer(employeeAuth, {
      type: "individual",
      name: "Employee Customer",
    });

    const archiveResponse = await apiRequest(
      `/api/customers/${inactive.id}/archive`,
      { method: "POST", auth: ownerAuth },
    );
    expect(archiveResponse.status).toBe(200);

    const ownerStatsResponse = await apiRequest(
      "/api/dashboard/customer-stats",
      { auth: ownerAuth },
    );
    expect(ownerStatsResponse.status).toBe(200);
    const ownerStats = await parseData<CustomerDashboardStatsDto>(
      ownerStatsResponse,
    );
    expect(ownerStats.scope).toBe("organization");
    expect(ownerStats.counts).toMatchObject({
      total: 2,
      active: 2,
      inactive: 0,
      archived: 1,
      business: 1,
      individual: 1,
    });
    expect(ownerStats.counts.newThisMonth).toBe(2);
    expect(ownerStats.monthlyGrowth).toHaveLength(6);
    expect(ownerStats.recentCustomers).toHaveLength(2);
    expect(
      ownerStats.recentCustomers.some((row) => row.id === business.id),
    ).toBe(true);
    expect(ownerStats.recentActivity.length).toBeGreaterThan(0);

    const employeeStatsResponse = await apiRequest(
      "/api/dashboard/customer-stats",
      { auth: employeeAuth },
    );
    expect(employeeStatsResponse.status).toBe(200);
    const employeeStats = await parseData<CustomerDashboardStatsDto>(
      employeeStatsResponse,
    );
    expect(employeeStats.scope).toBe("personal");
    expect(employeeStats.counts).toMatchObject({
      total: 1,
      active: 1,
      inactive: 0,
      archived: 0,
      business: 0,
      individual: 1,
    });
    expect(employeeStats.recentCustomers).toHaveLength(1);
    expect(employeeStats.recentCustomers[0]?.assignedTo).toBe(employee.id);

    const dashboardResponse = await apiRequest("/api/dashboard/stats", {
      auth: ownerAuth,
    });
    expect(dashboardResponse.status).toBe(200);
    const dashboard = await parseData<{
      customerStats: CustomerDashboardStatsDto;
    }>(dashboardResponse);
    expect(dashboard.customerStats.counts.total).toBe(
      ownerStats.counts.total,
    );
    expect(dashboard.customerStats.scope).toBe("organization");
  });
});
