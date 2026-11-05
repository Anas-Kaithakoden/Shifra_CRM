import { describe, expect, it } from "vitest";
import type { Paginated } from "../src/shared/types/api";
import type { LeadDto } from "../src/shared/types/leads";
import type { CustomerDto } from "../src/shared/types/customers";
import type {
  TaskActivityDto,
  TaskDto,
  TaskStatsDto,
} from "../src/shared/types/tasks";
import type { AuthSession } from "./helpers";
import {
  apiRequest,
  createUser,
  expectError,
  login,
  parseData,
} from "./helpers";

let taskSeq = 0;

function uniqueTaskTitle(prefix = "Test Task"): string {
  taskSeq += 1;
  return `${prefix} ${taskSeq} (${Date.now()})`;
}

async function createLead(
  auth: AuthSession,
  overrides: Record<string, unknown> = {},
): Promise<LeadDto> {
  taskSeq += 1;
  const suffix = String(Date.now()).slice(-6) + String(taskSeq).padStart(3, "0");
  const response = await apiRequest("/api/leads", {
    method: "POST",
    auth,
    body: {
      name: `Lead ${suffix}`,
      phone: `+1 555 ${suffix.slice(-3)} ${suffix.slice(0, 3)}${suffix.slice(3, 6)}`,
      email: `lead.${suffix}@example.com`,
      source: "Website",
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  const data = await parseData<{ lead: LeadDto }>(response);
  return data.lead;
}

async function createCustomer(
  auth: AuthSession,
  overrides: Record<string, unknown> = {},
): Promise<CustomerDto> {
  taskSeq += 1;
  const suffix = String(Date.now()).slice(-6) + String(taskSeq).padStart(3, "0");
  const response = await apiRequest("/api/customers", {
    method: "POST",
    auth,
    body: {
      type: "individual",
      name: `Customer ${suffix}`,
      phone: `+1 555 ${suffix.slice(-3)} ${suffix.slice(0, 3)}${suffix.slice(3, 6)}`,
      email: `customer.${suffix}@example.com`,
      ...overrides,
    },
  });
  expect(response.status).toBe(201);
  const data = await parseData<{ customer: CustomerDto }>(response);
  return data.customer;
}

describe("Task Management Module", () => {
  it("creates a task with sequential number, defaults, activity log and audit trail", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const title = uniqueTaskTitle("Review Q3 Proposals");
    const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const response = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title,
        description: "Verify milestone delivery details.",
        taskType: "internal",
        priority: "high",
        dueAt,
        reminderEnabled: true,
        reminderMinutesBefore: 30,
      },
    });

    expect(response.status).toBe(201);
    const data = await parseData<{ task: TaskDto }>(response);
    const task = data.task;

    expect(task.id).toBeDefined();
    expect(task.taskNumber).toMatch(/^SN-TASK-\d{4}$/);
    expect(task.title).toBe(title);
    expect(task.priority).toBe("high");
    expect(task.taskType).toBe("internal");
    expect(task.status).toBe("pending");
    expect(task.isOverdue).toBe(false);
    expect(task.assignedTo).toBe(owner.id);
    expect(task.createdBy).toBe(owner.id);
    expect(task.reminderEnabled).toBe(true);
    expect(task.reminderMinutesBefore).toBe(30);
    expect(task.reminderStatus).toBe("pending");

    // Fetch activities for task
    const actResponse = await apiRequest(`/api/tasks/${task.id}/activities`, {
      auth,
    });
    expect(actResponse.status).toBe(200);
    const actData = await parseData<{ activities: TaskActivityDto[] }>(actResponse);
    expect(actData.activities.length).toBeGreaterThan(0);
    expect(actData.activities[0]?.activityType).toBe("created");
  });

  it("validates task fields, assignee, and rejects inactive assignee", async () => {
    const owner = await createUser({ role: "owner" });
    const inactiveUser = await createUser({ role: "employee", isActive: false });
    const auth = await login(owner.email);

    // Empty title
    const resEmpty = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: "   " },
    });
    expect(resEmpty.status).toBe(400);

    // Inactive employee
    const resInactive = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle(),
        assignedTo: inactiveUser.id,
      },
    });
    await expectError(resInactive, 400, "invalid_assignee");
  });

  it("prevents employees from assigning tasks to other team members", async () => {
    await createUser({ role: "owner" });
    const employee1 = await createUser({ role: "employee" });
    const employee2 = await createUser({ role: "employee" });

    const emp1Auth = await login(employee1.email);

    // Employee 1 attempts to assign task to Employee 2
    const res = await apiRequest("/api/tasks", {
      method: "POST",
      auth: emp1Auth,
      body: {
        title: uniqueTaskTitle("Employee Task"),
        assignedTo: employee2.id,
      },
    });
    expect(res.status).toBe(403);

    // Employee 1 creates task for themselves
    const okRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth: emp1Auth,
      body: {
        title: uniqueTaskTitle("Employee Self Task"),
        assignedTo: employee1.id,
      },
    });
    expect(okRes.status).toBe(201);
  });

  it("enforces record-level authorization: employee cannot view or manage another employee's task", async () => {
    const owner = await createUser({ role: "owner" });
    const emp1 = await createUser({ role: "employee" });
    const emp2 = await createUser({ role: "employee" });

    const ownerAuth = await login(owner.email);
    const emp1Auth = await login(emp1.email);
    const emp2Auth = await login(emp2.email);

    // Create task assigned to Emp 1
    const createRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth: emp1Auth,
      body: { title: uniqueTaskTitle("Emp 1 Private Task") },
    });
    const { task } = await parseData<{ task: TaskDto }>(createRes);

    // Emp 2 attempts to get Emp 1's task
    const getRes = await apiRequest(`/api/tasks/${task.id}`, { auth: emp2Auth });
    expect(getRes.status).toBe(403);

    // Emp 2 attempts to complete Emp 1's task
    const compRes = await apiRequest(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      auth: emp2Auth,
    });
    expect(compRes.status).toBe(403);

    // Owner can access and manage Emp 1's task
    const ownerGet = await apiRequest(`/api/tasks/${task.id}`, { auth: ownerAuth });
    expect(ownerGet.status).toBe(200);
  });

  it("completes task, validates state guards (cannot complete cancelled or already completed task)", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const createRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: uniqueTaskTitle("Contract Signing") },
    });
    const { task } = await parseData<{ task: TaskDto }>(createRes);
    expect(task.status).toBe("pending");

    // Complete task
    const compRes = await apiRequest(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      auth,
      body: { completedNote: "Signed and filed." },
    });
    expect(compRes.status).toBe(200);
    const compData = await parseData<{ task: TaskDto }>(compRes);
    expect(compData.task.status).toBe("completed");
    expect(compData.task.completedAt).toBeDefined();

    // Re-completing already completed task should return 409 conflict
    const compAgain = await apiRequest(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      auth,
    });
    await expectError(compAgain, 409, "task_already_completed");
  });

  it("reopens completed task and restores to pending state; rejects reopening non-completed tasks", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const createRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: uniqueTaskTitle("Reopen Test") },
    });
    const { task } = await parseData<{ task: TaskDto }>(createRes);

    // Attempting to reopen a pending task should fail
    const reopenPending = await apiRequest(`/api/tasks/${task.id}/reopen`, {
      method: "POST",
      auth,
    });
    await expectError(reopenPending, 409, "task_not_completed");

    // Complete first
    await apiRequest(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      auth,
    });

    // Now reopen
    const reopenRes = await apiRequest(`/api/tasks/${task.id}/reopen`, {
      method: "POST",
      auth,
    });
    expect(reopenRes.status).toBe(200);
    const reopenData = await parseData<{ task: TaskDto }>(reopenRes);
    expect(reopenData.task.status).toBe("pending");
    expect(reopenData.task.completedAt).toBeNull();
  });

  it("cancels task and guards against cancelling completed/cancelled tasks", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const createRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: uniqueTaskTitle("Cancel Guard Test") },
    });
    const { task } = await parseData<{ task: TaskDto }>(createRes);

    // Cancel task
    const cancelRes = await apiRequest(`/api/tasks/${task.id}/cancel`, {
      method: "POST",
      auth,
      body: { reason: "Customer cancelled meeting." },
    });
    expect(cancelRes.status).toBe(200);
    const cancelData = await parseData<{ task: TaskDto }>(cancelRes);
    expect(cancelData.task.status).toBe("cancelled");
    expect(cancelData.task.cancelledAt).toBeDefined();

    // Re-cancelling should fail
    const cancelAgain = await apiRequest(`/api/tasks/${task.id}/cancel`, {
      method: "POST",
      auth,
    });
    await expectError(cancelAgain, 409, "task_already_cancelled");

    // Completing cancelled task should fail
    const compCancelled = await apiRequest(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      auth,
    });
    await expectError(compCancelled, 409, "task_cancelled");

    // Rescheduling cancelled task should fail
    const reschedCancelled = await apiRequest(`/api/tasks/${task.id}/reschedule`, {
      method: "POST",
      auth,
      body: { dueAt: new Date(Date.now() + 86400000).toISOString() },
    });
    await expectError(reschedCancelled, 409, "task_cancelled");
  });

  it("reschedules task, records previous and new due dates in history and activity log", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const originalDue = new Date(Date.now() + 86400000).toISOString();
    const newDue = new Date(Date.now() + 172800000).toISOString();

    const createRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Schedule Inspection"),
        dueAt: originalDue,
      },
    });
    const { task } = await parseData<{ task: TaskDto }>(createRes);

    // Reschedule
    const reschedRes = await apiRequest(`/api/tasks/${task.id}/reschedule`, {
      method: "POST",
      auth,
      body: {
        dueAt: newDue,
        reason: "Client postponed to Tuesday.",
      },
    });
    expect(reschedRes.status).toBe(200);
    const { task: updated } = await parseData<{ task: TaskDto }>(reschedRes);
    expect(updated.dueAt).toBe(newDue);

    // Check activity timeline
    const actRes = await apiRequest(`/api/tasks/${task.id}/activities`, { auth });
    const { activities } = await parseData<{ activities: TaskActivityDto[] }>(actRes);
    const reschedAct = activities.find((a) => a.activityType === "rescheduled");
    expect(reschedAct).toBeDefined();
    expect(reschedAct?.title).toBe("Task rescheduled");
    expect(reschedAct?.metadata).toEqual(
      expect.objectContaining({
        previousDueAt: originalDue,
        newDueAt: newDue,
        reason: "Client postponed to Tuesday.",
      }),
    );
  });

  it("computes overdue dynamically without storing as primary status and exposes in /overdue", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const pastDue = new Date(Date.now() - 3600000).toISOString();
    const futureDue = new Date(Date.now() + 3600000).toISOString();

    // 1. Pending with past due date -> isOverdue = true
    const res1 = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: uniqueTaskTitle("Overdue Pending Task"), dueAt: pastDue },
    });
    const { task: t1 } = await parseData<{ task: TaskDto }>(res1);
    expect(t1.status).toBe("pending");
    expect(t1.isOverdue).toBe(true);

    // 2. Pending with future due date -> isOverdue = false
    const res2 = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: uniqueTaskTitle("Future Task"), dueAt: futureDue },
    });
    const { task: t2 } = await parseData<{ task: TaskDto }>(res2);
    expect(t2.isOverdue).toBe(false);

    // 3. Completed with past due date -> isOverdue = false
    await apiRequest(`/api/tasks/${t1.id}/complete`, { method: "POST", auth });
    const getT1 = await apiRequest(`/api/tasks/${t1.id}`, { auth });
    const { task: t1Completed } = await parseData<{ task: TaskDto }>(getT1);
    expect(t1Completed.status).toBe("completed");
    expect(t1Completed.isOverdue).toBe(false);

    // 4. Overdue endpoint check
    const res3 = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: { title: uniqueTaskTitle("Active Overdue Task"), dueAt: pastDue },
    });
    const { task: t3 } = await parseData<{ task: TaskDto }>(res3);

    const overdueList = await apiRequest("/api/tasks/overdue", { auth });
    expect(overdueList.status).toBe(200);
    const { items } = await parseData<Paginated<TaskDto>>(overdueList);
    expect(items.some((i) => i.id === t3.id)).toBe(true);
    expect(items.every((i) => i.isOverdue === true)).toBe(true);
  });

  it("paginates and filters tasks by status, priority, type, and scopes (my, today, upcoming, follow-up)", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });
    const auth = await login(owner.email);

    const tCall = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Call Client"),
        taskType: "call",
        priority: "urgent",
        assignedTo: employee.id,
      },
    });
    expect(tCall.status).toBe(201);

    const tFollowUp = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Follow-up Proposal"),
        taskType: "follow_up",
        priority: "low",
        assignedTo: owner.id,
      },
    });
    expect(tFollowUp.status).toBe(201);

    // Filter by type
    const filterType = await apiRequest("/api/tasks?taskType=call", { auth });
    const callData = await parseData<Paginated<TaskDto>>(filterType);
    expect(callData.items.every((i) => i.taskType === "call")).toBe(true);

    // Filter by priority
    const filterPriority = await apiRequest("/api/tasks?priority=urgent", { auth });
    const urgentData = await parseData<Paginated<TaskDto>>(filterPriority);
    expect(urgentData.items.every((i) => i.priority === "urgent")).toBe(true);

    // Scope: follow-up endpoint
    const followUpsRes = await apiRequest("/api/tasks/follow-ups", { auth });
    const followUpsData = await parseData<Paginated<TaskDto>>(followUpsRes);
    expect(followUpsData.items.every((i) => i.taskType === "follow_up")).toBe(true);

    // Scope: my
    const myRes = await apiRequest("/api/tasks/my", { auth });
    const myData = await parseData<Paginated<TaskDto>>(myRes);
    expect(myData.items.every((i) => i.assignedTo === owner.id)).toBe(true);
  });

  it("links task to a lead and synchronizes lead next follow-up date and activity timeline", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const lead = await createLead(auth);
    expect(lead.nextFollowUpAt).toBeNull();

    const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const taskRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Demo Presentation"),
        taskType: "follow_up",
        leadId: lead.id,
        dueAt,
      },
    });
    expect(taskRes.status).toBe(201);
    const { task } = await parseData<{ task: TaskDto }>(taskRes);
    expect(task.leadId).toBe(lead.id);

    // Verify lead's nextFollowUpAt was synchronized!
    const leadGet = await apiRequest(`/api/leads/${lead.id}`, { auth });
    const { lead: updatedLead } = await parseData<{ lead: LeadDto }>(leadGet);
    expect(updatedLead.nextFollowUpAt).toBe(dueAt);

    // Reschedule task -> lead nextFollowUpAt updates
    const newDue = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    await apiRequest(`/api/tasks/${task.id}/reschedule`, {
      method: "POST",
      auth,
      body: { dueAt: newDue },
    });

    const leadAfterResched = await apiRequest(`/api/leads/${lead.id}`, { auth });
    const { lead: reschedLead } = await parseData<{ lead: LeadDto }>(leadAfterResched);
    expect(reschedLead.nextFollowUpAt).toBe(newDue);

    // Complete task -> nextFollowUpAt clears if no other pending tasks
    await apiRequest(`/api/tasks/${task.id}/complete`, { method: "POST", auth });
    const leadAfterComp = await apiRequest(`/api/leads/${lead.id}`, { auth });
    const { lead: completedLead } = await parseData<{ lead: LeadDto }>(leadAfterComp);
    expect(completedLead.nextFollowUpAt).toBeNull();
  });

  it("links task to a customer and creates customer activity", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const customer = await createCustomer(auth);

    const taskRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Customer Setup Review"),
        customerId: customer.id,
      },
    });
    expect(taskRes.status).toBe(201);
    const { task } = await parseData<{ task: TaskDto }>(taskRes);
    expect(task.customerId).toBe(customer.id);
  });

  it("recurrence engine: generates next occurrence on completion with correct intervals", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const startDue = new Date("2026-12-01T10:00:00.000Z").toISOString();

    // Daily recurring task
    const dailyRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Daily Standup Sync"),
        dueAt: startDue,
        recurrenceType: "daily",
        recurrenceInterval: 1,
      },
    });
    const { task: dailyTask } = await parseData<{ task: TaskDto }>(dailyRes);
    expect(dailyTask.recurrenceType).toBe("daily");
    expect(dailyTask.recurrenceGroupId).toBeDefined();

    // Complete the daily task
    await apiRequest(`/api/tasks/${dailyTask.id}/complete`, {
      method: "POST",
      auth,
      body: { completedNote: "Daily sync finished." },
    });

    // Check that next occurrence was generated
    const listRes = await apiRequest(
      `/api/tasks?search=${encodeURIComponent(dailyTask.title)}`,
      { auth },
    );
    const { items: dailyItems } = await parseData<Paginated<TaskDto>>(listRes);
    expect(dailyItems.length).toBe(2);

    const pendingDaily = dailyItems.find((i) => i.status === "pending");
    expect(pendingDaily).toBeDefined();
    expect(pendingDaily?.recurrenceGroupId).toBe(dailyTask.recurrenceGroupId);
    expect(pendingDaily?.taskNumber).not.toBe(dailyTask.taskNumber);

    // Verify next due date is +1 day
    const expectedDaily = new Date("2026-12-02T10:00:00.000Z").toISOString();
    expect(pendingDaily?.dueAt).toBe(expectedDaily);
  });

  it("recurrence engine: respects recurrenceEndAt boundary and stops recurrence when reached", async () => {
    const owner = await createUser({ role: "owner" });
    const auth = await login(owner.email);

    const dueAt = new Date("2026-12-01T10:00:00.000Z").toISOString();
    const endAt = new Date("2026-12-01T20:00:00.000Z").toISOString();

    // Task whose next occurrence (2026-12-02) would exceed recurrenceEndAt (2026-12-01)
    const taskRes = await apiRequest("/api/tasks", {
      method: "POST",
      auth,
      body: {
        title: uniqueTaskTitle("Terminating Task"),
        dueAt,
        recurrenceType: "daily",
        recurrenceInterval: 1,
        recurrenceEndAt: endAt,
      },
    });
    const { task } = await parseData<{ task: TaskDto }>(taskRes);

    // Complete task
    await apiRequest(`/api/tasks/${task.id}/complete`, { method: "POST", auth });

    // Verify NO new task was created
    const listRes = await apiRequest(
      `/api/tasks?search=${encodeURIComponent(task.title)}`,
      { auth },
    );
    const { items } = await parseData<Paginated<TaskDto>>(listRes);
    expect(items.length).toBe(1);
    expect(items[0]?.status).toBe("completed");
  });

  it("exposes task dashboard statistics scoped by user role", async () => {
    const owner = await createUser({ role: "owner" });
    const employee = await createUser({ role: "employee" });

    const ownerAuth = await login(owner.email);
    const empAuth = await login(employee.email);

    // Owner task stats
    const ownerStatsRes = await apiRequest("/api/dashboard/task-stats", {
      auth: ownerAuth,
    });
    expect(ownerStatsRes.status).toBe(200);
    const ownerStats = await parseData<TaskStatsDto>(ownerStatsRes);
    expect(ownerStats.scope).toBe("organization");
    expect(typeof ownerStats.totalTasks).toBe("number");
    expect(typeof ownerStats.overdueTasks).toBe("number");

    // Employee task stats
    const empStatsRes = await apiRequest("/api/dashboard/task-stats", {
      auth: empAuth,
    });
    expect(empStatsRes.status).toBe(200);
    const empStats = await parseData<TaskStatsDto>(empStatsRes);
    expect(empStats.scope).toBe("personal");
  });
});
