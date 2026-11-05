import { describe, expect, it } from "vitest";
import type { DashboardStatsDto } from "../src/shared/types/api";
import {
  apiRequest,
  createUser,
  login,
  parseData,
} from "./helpers";

describe("dashboard statistics", () => {
  it("returns real employee counts and marks unbuilt modules as coming soon", async () => {
    const owner = await createUser({ role: "owner" });
    await createUser({ role: "admin" });
    await createUser({ role: "employee", isActive: true });
    await createUser({ role: "employee", isActive: false });
    const ownerAuth = await login(owner.email);

    const response = await apiRequest("/api/dashboard/stats", {
      auth: ownerAuth,
    });
    expect(response.status).toBe(200);

    const stats = await parseData<DashboardStatsDto>(response);
    expect(stats.employees.total).toBe(4);
    expect(stats.employees.active).toBe(3);
    expect(stats.employees.inactive).toBe(1);
    expect(stats.employees.byRole).toEqual({
      owner: 1,
      admin: 1,
      employee: 2,
    });

    expect(stats.leads).toEqual({ value: 0, status: "available" });
    expect(stats.customerStats.counts.total).toBe(0);
    expect(stats.customerStats.scope).toBe("organization");
    expect(stats.activeProjects).toEqual({
      value: null,
      status: "coming_soon",
    });
    expect(stats.pendingPayments).toEqual({
      value: null,
      status: "coming_soon",
    });

    expect(stats.recentActivityScope).toBe("organization");
    expect(stats.recentActivity.length).toBeGreaterThan(0);
    expect(stats.recentActivity[0]?.action).toBe("auth.login_success");
    expect(new Date(stats.generatedAt).toString()).not.toBe("Invalid Date");
  });

  it("limits an employee's recent activity to their own account", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });

    await login(owner.email);
    const employeeAuth = await login(employee.email);

    const response = await apiRequest("/api/dashboard/stats", {
      auth: employeeAuth,
    });
    expect(response.status).toBe(200);

    const stats = await parseData<DashboardStatsDto>(response);
    expect(stats.recentActivityScope).toBe("personal");
    expect(stats.recentActivity.length).toBeGreaterThan(0);
    expect(
      stats.recentActivity.every((log) => log.userId === employee.id),
    ).toBe(true);
    expect(
      stats.recentActivity.some((log) => log.action === "auth.login_success"),
    ).toBe(true);
  });
});
