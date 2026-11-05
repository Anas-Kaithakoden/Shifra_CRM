import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Paginated, UserDto } from "../src/shared/types/api";
import {
  TEST_PASSWORD,
  apiRequest,
  createUser,
  expectError,
  login,
  parseData,
} from "./helpers";

describe("employee management and RBAC", () => {
  it("allows owners and admins to list users but blocks employees", async () => {
    const owner = await createUser({ role: "owner" });
    const admin = await createUser({ role: "admin" });
    const employee = await createUser({ role: "employee" });

    const ownerAuth = await login(owner.email);
    const adminAuth = await login(admin.email);
    const employeeAuth = await login(employee.email);

    expect(
      (await apiRequest("/api/users", { auth: ownerAuth })).status,
    ).toBe(200);
    expect(
      (await apiRequest("/api/users", { auth: adminAuth })).status,
    ).toBe(200);

    const forbidden = await apiRequest("/api/users", { auth: employeeAuth });
    await expectError(forbidden, 403, "forbidden");
  });

  it("lets an owner create an employee who must change the temporary password", async () => {
    const owner = await createUser({ role: "owner" });
    const ownerAuth = await login(owner.email);

    const createResponse = await apiRequest("/api/users", {
      method: "POST",
      auth: ownerAuth,
      body: {
        fullName: "New Employee",
        email: "new.employee@example.com",
        password: TEST_PASSWORD,
        role: "employee",
      },
    });

    expect(createResponse.status).toBe(201);
    const created = await parseData<{ user: UserDto }>(createResponse);
    expect(created.user.role).toBe("employee");
    expect(created.user.isActive).toBe(true);
    expect(created.user.mustChangePassword).toBe(true);

    const employeeAuth = await login("new.employee@example.com");
    expect(employeeAuth.user.mustChangePassword).toBe(true);

    const audit = await env.DB.prepare(
      "SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'user.created' LIMIT 1",
    )
      .bind(created.user.id)
      .first<{ action: string }>();
    expect(audit?.action).toBe("user.created");
  });

  it("deactivates an employee, invalidates their sessions and allows reactivation", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser();
    const ownerAuth = await login(owner.email);
    const employeeAuth = await login(employee.email);

    const deactivate = await apiRequest(
      `/api/users/${employee.id}/deactivate`,
      { method: "POST", auth: ownerAuth },
    );
    expect(deactivate.status).toBe(200);
    const deactivated = await parseData<{ user: UserDto }>(deactivate);
    expect(deactivated.user.isActive).toBe(false);

    const oldSession = await apiRequest("/api/auth/me", { auth: employeeAuth });
    await expectError(oldSession, 401, "unauthenticated");

    const loginBlocked = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: employee.email, password: TEST_PASSWORD },
    });
    await expectError(loginBlocked, 401, "invalid_credentials");

    const activate = await apiRequest(`/api/users/${employee.id}/activate`, {
      method: "POST",
      auth: ownerAuth,
    });
    expect(activate.status).toBe(200);
    const activated = await parseData<{ user: UserDto }>(activate);
    expect(activated.user.isActive).toBe(true);

    const loginAllowed = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: employee.email, password: TEST_PASSWORD },
    });
    expect(loginAllowed.status).toBe(200);
  });

  it("prevents admins from creating admin accounts", async () => {
    const admin = await createUser({ role: "admin" });
    const adminAuth = await login(admin.email);

    const employeeResponse = await apiRequest("/api/users", {
      method: "POST",
      auth: adminAuth,
      body: {
        fullName: "Regular Employee",
        email: "regular@example.com",
        password: TEST_PASSWORD,
        role: "employee",
      },
    });
    expect(employeeResponse.status).toBe(201);

    const adminResponse = await apiRequest("/api/users", {
      method: "POST",
      auth: adminAuth,
      body: {
        fullName: "Another Admin",
        email: "another.admin@example.com",
        password: TEST_PASSWORD,
        role: "admin",
      },
    });
    await expectError(adminResponse, 403, "forbidden");
  });

  it("protects the owner account and blocks self-management", async () => {
    const owner = await createUser({ role: "owner" });
    const admin = await createUser({ role: "admin" });
    const otherAdmin = await createUser({ role: "admin" });

    const adminAuth = await login(admin.email);
    const ownerAuth = await login(owner.email);

    const adminUpdatesOwner = await apiRequest(`/api/users/${owner.id}`, {
      method: "PATCH",
      auth: adminAuth,
      body: { fullName: "Renamed Owner" },
    });
    await expectError(adminUpdatesOwner, 403, "forbidden");

    const adminDeactivatesOwner = await apiRequest(
      `/api/users/${owner.id}/deactivate`,
      { method: "POST", auth: adminAuth },
    );
    await expectError(adminDeactivatesOwner, 403, "forbidden");

    const adminUpdatesAdmin = await apiRequest(
      `/api/users/${otherAdmin.id}`,
      {
        method: "PATCH",
        auth: adminAuth,
        body: { fullName: "Renamed Admin" },
      },
    );
    await expectError(adminUpdatesAdmin, 403, "forbidden");

    const ownerChangesOwnRole = await apiRequest(`/api/users/${owner.id}`, {
      method: "PATCH",
      auth: ownerAuth,
      body: { role: "admin" },
    });
    await expectError(ownerChangesOwnRole, 403, "forbidden");

    const ownerDeactivatesSelf = await apiRequest(
      `/api/users/${owner.id}/deactivate`,
      { method: "POST", auth: ownerAuth },
    );
    await expectError(ownerDeactivatesSelf, 403, "forbidden");

    const ownerStillActive = await apiRequest("/api/auth/me", {
      auth: ownerAuth,
    });
    expect(ownerStillActive.status).toBe(200);
  });

  it("lets only the owner change roles, with permissions taking effect immediately", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser();
    const ownerAuth = await login(owner.email);
    const employeeAuth = await login(employee.email);

    const update = await apiRequest(`/api/users/${employee.id}`, {
      method: "PATCH",
      auth: ownerAuth,
      body: { role: "admin" },
    });
    expect(update.status).toBe(200);
    const updated = await parseData<{ user: UserDto }>(update);
    expect(updated.user.role).toBe("admin");

    const me = await apiRequest("/api/auth/me", { auth: employeeAuth });
    const meData = await parseData<{
      user: { role: string; permissions: string[] };
    }>(me);
    expect(meData.user.role).toBe("admin");
    expect(meData.user.permissions).toContain("users:read");

    const auditStillForbidden = await apiRequest("/api/audit-logs", {
      auth: employeeAuth,
    });
    await expectError(auditStillForbidden, 403, "forbidden");
  });

  it("validates input, rejects duplicate emails and requires CSRF", async () => {
    const owner = await createUser({ role: "owner" });
    const existing = await createUser({ email: "existing@example.com" });
    const ownerAuth = await login(owner.email);

    const weakPassword = await apiRequest("/api/users", {
      method: "POST",
      auth: ownerAuth,
      body: {
        fullName: "Weak Password",
        email: "weak@example.com",
        password: "short",
        role: "employee",
      },
    });
    await expectError(weakPassword, 400, "validation_error");

    const duplicate = await apiRequest("/api/users", {
      method: "POST",
      auth: ownerAuth,
      body: {
        fullName: "Duplicate Email",
        email: existing.email,
        password: TEST_PASSWORD,
        role: "employee",
      },
    });
    await expectError(duplicate, 409, "email_in_use");

    const missingCsrf = await apiRequest("/api/users", {
      method: "POST",
      auth: ownerAuth,
      includeCsrf: false,
      body: {
        fullName: "No CSRF",
        email: "no.csrf@example.com",
        password: TEST_PASSWORD,
        role: "employee",
      },
    });
    await expectError(missingCsrf, 403, "csrf_failed");
  });

  it("paginates and filters the employee list", async () => {
    const owner = await createUser({ role: "owner" });
    await createUser({ role: "employee", fullName: "Alpha One", email: "alpha@example.com" });
    await createUser({ role: "employee", fullName: "Beta Two", email: "beta@example.com" });
    await createUser({ role: "employee", fullName: "Gamma Three", email: "gamma@example.com" });
    const ownerAuth = await login(owner.email);

    const filtered = await apiRequest(
      "/api/users?page=1&pageSize=2&role=employee&search=alpha",
      { auth: ownerAuth },
    );
    expect(filtered.status).toBe(200);
    const filteredData = await parseData<Paginated<UserDto>>(filtered);
    expect(filteredData.pagination.total).toBe(1);
    expect(filteredData.items).toHaveLength(1);
    expect(filteredData.items[0]?.fullName).toBe("Alpha One");

    const firstPage = await apiRequest("/api/users?page=1&pageSize=2", {
      auth: ownerAuth,
    });
    const firstPageData = await parseData<Paginated<UserDto>>(firstPage);
    expect(firstPageData.pagination.total).toBe(4);
    expect(firstPageData.pagination.totalPages).toBe(2);
    expect(firstPageData.items).toHaveLength(2);

    const secondPage = await apiRequest("/api/users?page=2&pageSize=2", {
      auth: ownerAuth,
    });
    const secondPageData = await parseData<Paginated<UserDto>>(secondPage);
    expect(secondPageData.items).toHaveLength(2);
    expect(secondPageData.items[0]?.id).not.toBe(firstPageData.items[0]?.id);
  });

  it("blocks administrators from reading audit logs and settings", async () => {
    const admin = await createUser({ role: "admin" });
    const adminAuth = await login(admin.email);

    const audit = await apiRequest("/api/audit-logs", { auth: adminAuth });
    await expectError(audit, 403, "forbidden");

    const settings = await apiRequest("/api/settings", { auth: adminAuth });
    await expectError(settings, 403, "forbidden");
  });
});
