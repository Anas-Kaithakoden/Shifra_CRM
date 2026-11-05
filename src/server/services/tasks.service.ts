import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import type { AuthUserDto } from "../../shared/types/api";
import type {
  TaskActivityDto,
  TaskDto,
  TaskStatsDto,
} from "../../shared/types/tasks";
import type { AppDatabase } from "../db/client";
import { findCustomerRowById } from "../db/queries/customers.queries";
import { findLeadById } from "../db/queries/leads.queries";
import {
  countTaskStats,
  findTaskWithRelationsById,
  getNextTaskNumber,
  insertTask,
  insertTaskActivity,
  listRecentTaskActivities,
  listTaskActivitiesByTaskId,
  listTasksWithRelations,
  updateTaskById,
  type TaskWithRelations,
} from "../db/queries/tasks.queries";
import { findUserById } from "../db/queries/users.queries";
import type { TaskRow } from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { getCrmDayBounds, nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";
import { canViewCustomer } from "./customer-access";
import { recordCustomerActivity } from "./customer-activity.service";
import { canViewLead } from "./lead-access";
import { recordLeadActivity } from "./lead-activity.service";
import { syncLeadNextFollowUpAt } from "./leads.service";
import type {
  AssignTaskInput,
  CreateTaskInput,
  ListTasksQuery,
  RescheduleTaskInput,
  UpdateTaskInput,
} from "../schemas/tasks.schema";

export function toTaskDto(row: TaskWithRelations): TaskDto {
  const now = nowIso();
  const isOverdue = Boolean(
    row.task.dueAt &&
      row.task.dueAt < now &&
      row.task.status !== "completed" &&
      row.task.status !== "cancelled",
  );

  return {
    id: row.task.id,
    taskNumber: row.task.taskNumber,
    title: row.task.title,
    description: row.task.description,
    taskType: row.task.taskType as any,
    status: row.task.status as any,
    priority: row.task.priority as any,
    assignedTo: row.task.assignedTo,
    createdBy: row.task.createdBy,
    leadId: row.task.leadId,
    customerId: row.task.customerId,
    projectId: row.task.projectId,
    dueAt: row.task.dueAt,
    completedAt: row.task.completedAt,
    cancelledAt: row.task.cancelledAt,
    reminderEnabled: row.task.reminderEnabled,
    reminderMinutesBefore: row.task.reminderMinutesBefore,
    reminderSentAt: row.task.reminderSentAt,
    reminderAttemptedAt: row.task.reminderAttemptedAt,
    reminderStatus: row.task.reminderStatus as any,
    reminderError: row.task.reminderError,
    recurrenceType: (row.task.recurrenceType as any) ?? null,
    recurrenceInterval: row.task.recurrenceInterval,
    recurrenceEndAt: row.task.recurrenceEndAt,
    recurrenceGroupId: row.task.recurrenceGroupId,
    createdAt: row.task.createdAt,
    updatedAt: row.task.updatedAt,
    isOverdue,
    assignedUser: row.assignedUser,
    createdByUser: row.createdByUser,
    lead: row.lead,
    customer: row.customer,
  };
}

export function computeNextRecurrenceDate(
  baseDueAt: string | null,
  recurrenceType: "daily" | "weekly" | "monthly" | "custom",
  interval = 1,
): string {
  const base = baseDueAt ? new Date(baseDueAt) : new Date();
  const safeInterval = Math.max(1, interval || 1);
  const next = new Date(base.getTime());

  if (recurrenceType === "daily") {
    next.setDate(next.getDate() + safeInterval);
  } else if (recurrenceType === "weekly") {
    next.setDate(next.getDate() + safeInterval * 7);
  } else if (recurrenceType === "monthly") {
    const currentDay = next.getDate();
    next.setMonth(next.getMonth() + safeInterval);
    if (next.getDate() !== currentDay) {
      next.setDate(0);
    }
  } else if (recurrenceType === "custom") {
    next.setDate(next.getDate() + safeInterval);
  }

  return next.toISOString();
}

export function assertCanViewTask(actor: AuthUserDto, task: TaskRow): void {
  if (actor.role === "owner" || actor.role === "admin") {
    return;
  }
  if (task.assignedTo === actor.id || task.createdBy === actor.id) {
    return;
  }
  throw forbidden("You do not have access to this task.");
}

export function assertCanManageTask(actor: AuthUserDto, task: TaskRow): void {
  if (actor.role === "owner" || actor.role === "admin") {
    return;
  }
  if (task.assignedTo === actor.id || task.createdBy === actor.id) {
    return;
  }
  throw forbidden("You can only manage your own tasks.");
}

async function resolveTaskAssignee(
  db: AppDatabase,
  actor: AuthUserDto,
  requested: string | null | undefined,
  fallback: string | null = null,
): Promise<string | null> {
  if (requested === undefined) {
    return fallback ?? actor.id;
  }

  if (requested === null) {
    if (actor.role === "employee") {
      throw forbidden("Employees cannot unassign tasks.");
    }
    return null;
  }

  if (actor.role === "employee") {
    if (requested !== actor.id) {
      throw forbidden("Employees cannot assign tasks to other team members.");
    }
    return actor.id;
  }

  const target = await findUserById(db, requested);
  if (!target || !target.isActive) {
    throw badRequest(
      "invalid_assignee",
      "Choose an active team member for this task.",
    );
  }
  return target.id;
}

async function validateLinkedEntities(
  db: AppDatabase,
  actor: AuthUserDto,
  leadId: string | null | undefined,
  customerId: string | null | undefined,
): Promise<void> {
  if (leadId) {
    const lead = await findLeadById(db, leadId);
    if (!lead || lead.lead.deletedAt) {
      throw badRequest("invalid_lead", "Selected lead does not exist.");
    }
    if (actor.role === "employee" && !canViewLead(actor, lead.lead)) {
      throw forbidden("You do not have access to this lead.");
    }
  }

  if (customerId) {
    const customer = await findCustomerRowById(db, customerId);
    if (!customer || customer.status === "archived") {
      throw badRequest("invalid_customer", "Selected customer does not exist.");
    }
    if (actor.role === "employee" && !canViewCustomer(actor, customer)) {
      throw forbidden("You do not have access to this customer.");
    }
  }
}

export async function createTask(
  db: AppDatabase,
  actor: AuthUserDto,
  input: CreateTaskInput,
  ipAddress?: string | null,
): Promise<TaskDto> {
  await validateLinkedEntities(db, actor, input.leadId, input.customerId);
  const assignedTo = await resolveTaskAssignee(
    db,
    actor,
    input.assignedTo,
    actor.id,
  );

  const taskNumber = await getNextTaskNumber(db);
  const taskId = newId();
  const now = nowIso();

  const recurrenceGroupId =
    input.recurrenceType ? newId() : null;

  const row = await insertTask(db, {
    id: taskId,
    taskNumber,
    title: input.title,
    description: input.description ?? null,
    taskType: input.taskType ?? "internal",
    status: "pending",
    priority: input.priority ?? "medium",
    assignedTo,
    createdBy: actor.id,
    leadId: input.leadId ?? null,
    customerId: input.customerId ?? null,
    projectId: input.projectId ?? null,
    dueAt: input.dueAt ?? null,
    reminderEnabled: input.reminderEnabled ?? false,
    reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    reminderStatus: "pending",
    recurrenceType: input.recurrenceType ?? null,
    recurrenceInterval: input.recurrenceInterval ?? null,
    recurrenceEndAt: input.recurrenceEndAt ?? null,
    recurrenceGroupId,
    createdAt: now,
    updatedAt: now,
  });

  await insertTaskActivity(db, {
    id: newId(),
    taskId: row.id,
    userId: actor.id,
    activityType: "created",
    title: "Task created",
    description: `Created task ${taskNumber}: ${row.title}`,
    metadata: JSON.stringify({ taskNumber, priority: row.priority, taskType: row.taskType }),
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.TASK_CREATED,
    entityType: "task",
    entityId: row.id,
    metadata: {
      taskNumber,
      title: row.title,
      assignedTo,
      dueAt: row.dueAt,
    },
    ipAddress,
  });

  if (row.leadId) {
    await recordLeadActivity(db, {
      leadId: row.leadId,
      userId: actor.id,
      activityType: "follow_up_scheduled",
      title: "Task scheduled",
      description: `${row.title} (due: ${row.dueAt ?? "none"})`,
      createdAt: now,
    });
    await syncLeadNextFollowUpAt(db, row.leadId);
  }

  if (row.customerId) {
    await recordCustomerActivity(db, {
      customerId: row.customerId,
      userId: actor.id,
      activityType: "interaction_logged",
      title: "Task created",
      description: `${row.title} (due: ${row.dueAt ?? "none"})`,
      createdAt: now,
    });
  }

  const withRelations = await findTaskWithRelationsById(db, row.id);
  if (!withRelations) {
    throw notFound("Task not found after creation.");
  }

  return toTaskDto(withRelations);
}

export async function getTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
): Promise<TaskDto> {
  const row = await findTaskWithRelationsById(db, id);
  if (!row) {
    throw notFound("Task not found.");
  }
  assertCanViewTask(actor, row.task);
  return toTaskDto(row);
}

export async function updateTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: UpdateTaskInput,
  ipAddress?: string | null,
): Promise<TaskDto> {
  const existing = await findTaskWithRelationsById(db, id);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanManageTask(actor, existing.task);

  if (input.status !== undefined && input.status !== existing.task.status) {
    throw conflict(
      "invalid_status_transition",
      "Use task actions (complete, reopen, cancel) to change status.",
    );
  }

  const targetLeadId = input.leadId === undefined ? existing.task.leadId : input.leadId;
  const targetCustomerId =
    input.customerId === undefined ? existing.task.customerId : input.customerId;
  await validateLinkedEntities(db, actor, targetLeadId, targetCustomerId);

  let assignedTo = existing.task.assignedTo;
  const assigneeChanged =
    input.assignedTo !== undefined && input.assignedTo !== existing.task.assignedTo;
  if (assigneeChanged) {
    assignedTo = await resolveTaskAssignee(
      db,
      actor,
      input.assignedTo,
      existing.task.assignedTo,
    );
  }

  const now = nowIso();
  const updates: Partial<TaskRow> = {
    ...input,
    assignedTo,
    updatedAt: now,
  };

  const rescheduled =
    input.dueAt !== undefined && input.dueAt !== existing.task.dueAt;

  const recurrenceTouched =
    input.recurrenceType !== undefined ||
    input.recurrenceInterval !== undefined ||
    input.recurrenceEndAt !== undefined;
  if (recurrenceTouched) {
    const nextType =
      input.recurrenceType !== undefined ? input.recurrenceType : existing.task.recurrenceType;
    updates.recurrenceType = nextType ?? null;
    updates.recurrenceInterval = nextType
      ? (input.recurrenceInterval ?? existing.task.recurrenceInterval ?? 1)
      : null;
    updates.recurrenceEndAt = nextType
      ? (input.recurrenceEndAt ?? existing.task.recurrenceEndAt ?? null)
      : null;
    updates.recurrenceGroupId = nextType
      ? (existing.task.recurrenceGroupId ?? existing.task.id)
      : null;
  }

  if (rescheduled) {
    updates.reminderStatus = "pending";
    updates.reminderSentAt = null;
    updates.reminderAttemptedAt = null;
    updates.reminderError = null;
  }

  if (input.reminderEnabled === false) {
    updates.reminderStatus = "skipped";
    updates.reminderSentAt = null;
    updates.reminderError = null;
  }

  if (input.recurrenceType === null) {
    updates.reminderStatus = updates.reminderStatus ?? existing.task.reminderStatus;
  }

  const updated = await updateTaskById(db, id, updates as any);
  if (!updated) {
    throw notFound("Task not found.");
  }

  if (rescheduled) {
    await insertTaskActivity(db, {
      id: newId(),
      taskId: id,
      userId: actor.id,
      activityType: "rescheduled",
      title: "Task rescheduled",
      description: `${existing.task.dueAt ?? "none"} -> ${updated.dueAt ?? "none"}`,
      metadata: JSON.stringify({
        previousDueAt: existing.task.dueAt,
        newDueAt: updated.dueAt,
      }),
      createdAt: now,
    });

    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.TASK_RESCHEDULED,
      entityType: "task",
      entityId: id,
      metadata: {
        taskNumber: existing.task.taskNumber,
        previousDueAt: existing.task.dueAt,
        newDueAt: updated.dueAt,
      },
      ipAddress,
    });
  }

  if (assigneeChanged) {
    await insertTaskActivity(db, {
      id: newId(),
      taskId: id,
      userId: actor.id,
      activityType: "assigned",
      title: "Task assigned",
      description: `Assigned to ${assignedTo ?? "unassigned"}`,
      metadata: JSON.stringify({ from: existing.task.assignedTo, to: assignedTo }),
      createdAt: now,
    });
    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.TASK_ASSIGNED,
      entityType: "task",
      entityId: id,
      metadata: { taskNumber: existing.task.taskNumber, from: existing.task.assignedTo, to: assignedTo },
      ipAddress,
    });
  }

  if (!rescheduled || Object.keys(input).some((k) => !["dueAt", "assignedTo"].includes(k))) {
    await insertTaskActivity(db, {
      id: newId(),
      taskId: id,
      userId: actor.id,
      activityType: "updated",
      title: "Task updated",
      description: "Updated task details",
      metadata: JSON.stringify(input),
      createdAt: now,
    });

    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.TASK_UPDATED,
      entityType: "task",
      entityId: id,
      metadata: {
        taskNumber: existing.task.taskNumber,
        changes: input,
      },
      ipAddress,
    });
  }

  if (existing.task.leadId || updated.leadId) {
    if (existing.task.leadId) await syncLeadNextFollowUpAt(db, existing.task.leadId);
    if (updated.leadId && updated.leadId !== existing.task.leadId) {
      await syncLeadNextFollowUpAt(db, updated.leadId);
    }
  }

  const withRelations = await findTaskWithRelationsById(db, id);
  return toTaskDto(withRelations!);
}

export async function completeTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input?: { completedNote?: string | null },
  ipAddress?: string | null,
): Promise<TaskDto> {
  const existing = await findTaskWithRelationsById(db, id);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanManageTask(actor, existing.task);

  if (existing.task.status === "completed") {
    throw conflict("task_already_completed", "This task is already completed.");
  }
  if (existing.task.status === "cancelled") {
    throw conflict("task_cancelled", "Cancelled tasks cannot be completed.");
  }

  const now = nowIso();
  await updateTaskById(db, id, {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  });

  await insertTaskActivity(db, {
    id: newId(),
    taskId: id,
    userId: actor.id,
    activityType: "completed",
    title: "Task completed",
    description: input?.completedNote ?? "Task marked as completed",
    metadata: JSON.stringify({ completedAt: now, note: input?.completedNote }),
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.TASK_COMPLETED,
    entityType: "task",
    entityId: id,
    metadata: {
      taskNumber: existing.task.taskNumber,
      completedAt: now,
    },
    ipAddress,
  });

  if (existing.task.leadId) {
    await recordLeadActivity(db, {
      leadId: existing.task.leadId,
      userId: actor.id,
      activityType: "follow_up_completed",
      title: "Task completed",
      description: `${existing.task.title}${input?.completedNote ? `: ${input.completedNote}` : ""}`,
      createdAt: now,
    });
    await syncLeadNextFollowUpAt(db, existing.task.leadId);
  }

  if (existing.task.customerId) {
    await recordCustomerActivity(db, {
      customerId: existing.task.customerId,
      userId: actor.id,
      activityType: "interaction_logged",
      title: "Task completed",
      description: `${existing.task.title}${input?.completedNote ? `: ${input.completedNote}` : ""}`,
      createdAt: now,
    });
  }

  // Recurrence: generate next occurrence if recurrenceType is configured
  if (
    existing.task.recurrenceType &&
    ["daily", "weekly", "monthly", "custom"].includes(existing.task.recurrenceType)
  ) {
    const nextDue = computeNextRecurrenceDate(
      existing.task.dueAt,
      existing.task.recurrenceType as any,
      existing.task.recurrenceInterval ?? 1,
    );

    const recurrenceExpired =
      existing.task.recurrenceEndAt &&
      new Date(nextDue) > new Date(existing.task.recurrenceEndAt);

    if (!recurrenceExpired) {
      const nextTaskNumber = await getNextTaskNumber(db);
      const nextTaskId = newId();
      const recurrenceGroupId = existing.task.recurrenceGroupId || existing.task.id;

      await insertTask(db, {
        id: nextTaskId,
        taskNumber: nextTaskNumber,
        title: existing.task.title,
        description: existing.task.description,
        taskType: existing.task.taskType,
        status: "pending",
        priority: existing.task.priority,
        assignedTo: existing.task.assignedTo,
        createdBy: actor.id,
        leadId: existing.task.leadId,
        customerId: existing.task.customerId,
        projectId: existing.task.projectId,
        dueAt: nextDue,
        reminderEnabled: existing.task.reminderEnabled,
        reminderMinutesBefore: existing.task.reminderMinutesBefore,
        reminderStatus: "pending",
        recurrenceType: existing.task.recurrenceType,
        recurrenceInterval: existing.task.recurrenceInterval,
        recurrenceEndAt: existing.task.recurrenceEndAt,
        recurrenceGroupId,
        createdAt: now,
        updatedAt: now,
      });

      await insertTaskActivity(db, {
        id: newId(),
        taskId: nextTaskId,
        userId: actor.id,
        activityType: "created",
        title: "Next recurring task generated",
        description: `Generated from ${existing.task.taskNumber}`,
        metadata: JSON.stringify({
          previousTaskId: id,
          recurrenceGroupId,
          dueAt: nextDue,
        }),
        createdAt: now,
      });

      if (existing.task.leadId) {
        await syncLeadNextFollowUpAt(db, existing.task.leadId);
      }
    }
  }

  const withRelations = await findTaskWithRelationsById(db, id);
  return toTaskDto(withRelations!);
}

export async function reopenTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  ipAddress?: string | null,
): Promise<TaskDto> {
  const existing = await findTaskWithRelationsById(db, id);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanManageTask(actor, existing.task);

  if (existing.task.status !== "completed") {
    throw conflict("task_not_completed", "Only completed tasks can be reopened.");
  }

  const now = nowIso();
  await updateTaskById(db, id, {
    status: "pending",
    completedAt: null,
    updatedAt: now,
  });

  await insertTaskActivity(db, {
    id: newId(),
    taskId: id,
    userId: actor.id,
    activityType: "reopened",
    title: "Task reopened",
    description: "Task reopened to pending state",
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.TASK_REOPENED,
    entityType: "task",
    entityId: id,
    metadata: {
      taskNumber: existing.task.taskNumber,
    },
    ipAddress,
  });

  if (existing.task.leadId) {
    await syncLeadNextFollowUpAt(db, existing.task.leadId);
  }

  const withRelations = await findTaskWithRelationsById(db, id);
  return toTaskDto(withRelations!);
}

export async function cancelTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input?: { reason?: string | null },
  ipAddress?: string | null,
): Promise<TaskDto> {
  const existing = await findTaskWithRelationsById(db, id);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanManageTask(actor, existing.task);

  if (existing.task.status === "cancelled") {
    throw conflict("task_already_cancelled", "This task is already cancelled.");
  }
  if (existing.task.status === "completed") {
    throw conflict("task_already_completed", "Completed tasks cannot be cancelled.");
  }

  const now = nowIso();
  await updateTaskById(db, id, {
    status: "cancelled",
    cancelledAt: now,
    reminderStatus: "skipped",
    updatedAt: now,
  });

  await insertTaskActivity(db, {
    id: newId(),
    taskId: id,
    userId: actor.id,
    activityType: "cancelled",
    title: "Task cancelled",
    description: input?.reason ?? "Task was cancelled",
    metadata: JSON.stringify({ cancelledAt: now, reason: input?.reason }),
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.TASK_CANCELLED,
    entityType: "task",
    entityId: id,
    metadata: {
      taskNumber: existing.task.taskNumber,
      reason: input?.reason,
    },
    ipAddress,
  });

  if (existing.task.leadId) {
    await recordLeadActivity(db, {
      leadId: existing.task.leadId,
      userId: actor.id,
      activityType: "follow_up_cancelled",
      title: "Task cancelled",
      description: `${existing.task.title}${input?.reason ? `: ${input.reason}` : ""}`,
      createdAt: now,
    });
    await syncLeadNextFollowUpAt(db, existing.task.leadId);
  }

  const withRelations = await findTaskWithRelationsById(db, id);
  return toTaskDto(withRelations!);
}

export async function rescheduleTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: RescheduleTaskInput,
  ipAddress?: string | null,
): Promise<TaskDto> {
  const existing = await findTaskWithRelationsById(db, id);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanManageTask(actor, existing.task);

  if (existing.task.status === "cancelled") {
    throw conflict("task_cancelled", "Cannot reschedule a cancelled task.");
  }
  if (existing.task.status === "completed") {
    throw conflict("task_completed", "Cannot reschedule a completed task.");
  }

  const now = nowIso();
  await updateTaskById(db, id, {
    dueAt: input.dueAt,
    reminderStatus: "pending",
    reminderSentAt: null,
    reminderAttemptedAt: null,
    reminderError: null,
    updatedAt: now,
  });

  await insertTaskActivity(db, {
    id: newId(),
    taskId: id,
    userId: actor.id,
    activityType: "rescheduled",
    title: "Task rescheduled",
    description: `${existing.task.dueAt ?? "none"} → ${input.dueAt}${input.reason ? ` (${input.reason})` : ""}`,
    metadata: JSON.stringify({
      previousDueAt: existing.task.dueAt,
      newDueAt: input.dueAt,
      reason: input.reason,
    }),
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.TASK_RESCHEDULED,
    entityType: "task",
    entityId: id,
    metadata: {
      taskNumber: existing.task.taskNumber,
      previousDueAt: existing.task.dueAt,
      newDueAt: input.dueAt,
      reason: input.reason,
    },
    ipAddress,
  });

  if (existing.task.leadId) {
    await recordLeadActivity(db, {
      leadId: existing.task.leadId,
      userId: actor.id,
      activityType: "follow_up_rescheduled",
      title: "Task rescheduled",
      description: `${existing.task.title}: ${existing.task.dueAt ?? "none"} → ${input.dueAt}`,
      createdAt: now,
    });
    await syncLeadNextFollowUpAt(db, existing.task.leadId);
  }

  const withRelations = await findTaskWithRelationsById(db, id);
  return toTaskDto(withRelations!);
}

export async function assignTask(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: AssignTaskInput,
  ipAddress?: string | null,
): Promise<TaskDto> {
  const existing = await findTaskWithRelationsById(db, id);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanManageTask(actor, existing.task);

  const targetId = await resolveTaskAssignee(
    db,
    actor,
    input.assignedTo,
    null,
  );

  const now = nowIso();
  await updateTaskById(db, id, {
    assignedTo: targetId,
    updatedAt: now,
  });

  await insertTaskActivity(db, {
    id: newId(),
    taskId: id,
    userId: actor.id,
    activityType: "assigned",
    title: "Task assigned",
    description: `Assigned to ${targetId ?? "unassigned"}`,
    metadata: JSON.stringify({
      from: existing.task.assignedTo,
      to: targetId,
    }),
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.TASK_ASSIGNED,
    entityType: "task",
    entityId: id,
    metadata: {
      taskNumber: existing.task.taskNumber,
      from: existing.task.assignedTo,
      to: targetId,
    },
    ipAddress,
  });

  const withRelations = await findTaskWithRelationsById(db, id);
  return toTaskDto(withRelations!);
}

export async function listTasksForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: ListTasksQuery,
): Promise<{ items: TaskDto[]; total: number }> {
  const now = nowIso();
  const { start, end } = getCrmDayBounds(new Date());

  const { items, total } = await listTasksWithRelations(
    db,
    { userId: actor.id, role: actor.role },
    {
      ...query,
      now,
      dayStart: start,
      dayEnd: end,
    },
    query.pageSize,
    (query.page - 1) * query.pageSize,
  );

  return {
    items: items.map(toTaskDto),
    total,
  };
}

export async function listTaskActivitiesForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  taskId: string,
): Promise<TaskActivityDto[]> {
  const existing = await findTaskWithRelationsById(db, taskId);
  if (!existing) {
    throw notFound("Task not found.");
  }
  assertCanViewTask(actor, existing.task);

  const rows = await listTaskActivitiesByTaskId(db, taskId);

  return rows.map((r) => ({
    id: r.activity.id,
    taskId: r.activity.taskId,
    userId: r.activity.userId,
    activityType: r.activity.activityType as any,
    title: r.activity.title,
    description: r.activity.description,
    metadata: r.activity.metadata ? JSON.parse(r.activity.metadata) : null,
    createdAt: r.activity.createdAt,
    user: r.user,
  }));
}

export async function listRecentActivitiesForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  limit = 20,
) {
  const rows = await listRecentTaskActivities(
    db,
    { userId: actor.id, role: actor.role },
    limit,
  );

  return rows.map((r) => ({
    id: r.activity.id,
    taskId: r.activity.taskId,
    userId: r.activity.userId,
    activityType: r.activity.activityType,
    title: r.activity.title,
    description: r.activity.description,
    metadata: r.activity.metadata ? JSON.parse(r.activity.metadata) : null,
    createdAt: r.activity.createdAt,
    user: r.user,
    task: r.task,
  }));
}

export async function getTaskDashboardStatsForActor(
  db: AppDatabase,
  actor: AuthUserDto,
): Promise<TaskStatsDto> {
  const now = nowIso();
  const { start, end } = getCrmDayBounds(new Date());

  return countTaskStats(
    db,
    { userId: actor.id, role: actor.role },
    { now, dayStart: start, dayEnd: end },
  );
}
