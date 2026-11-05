import {
  and,
  asc,
  desc,
  eq,
  gte,
  like,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Role } from "../../../shared/types/roles";
import type { AppDatabase } from "../client";
import {
  customers,
  leads,
  taskActivities,
  taskNumberSequence,
  tasks,
  users,
  type NewTaskActivityRow,
  type NewTaskRow,
  type TaskActivityRow,
  type TaskRow,
} from "../schema";

const assignedUser = alias(users, "task_assigned_user");
const createdByUser = alias(users, "task_created_by_user");
const activityUser = alias(users, "task_activity_user");

export interface TaskAccessScope {
  userId: string;
  role: Role;
}

export interface TaskWithRelations {
  task: TaskRow;
  assignedUser: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  createdByUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  lead: {
    id: string;
    leadNumber: string;
    name: string;
    phone: string;
    businessName: string | null;
  } | null;
  customer: {
    id: string;
    customerNumber: string;
    name: string;
    phone: string;
    businessName: string | null;
  } | null;
}

export interface TaskActivityWithUser {
  activity: TaskActivityRow;
  user: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface ListTasksFilterOptions {
  scope?: "all" | "my" | "today" | "upcoming" | "overdue" | "follow_up";
  status?: string;
  priority?: string;
  taskType?: string;
  assignedTo?: string;
  leadId?: string;
  customerId?: string;
  search?: string;
  dueFrom?: string | null;
  dueTo?: string | null;
  now: string;
  dayStart: string;
  dayEnd: string;
  sortBy?: "created_at" | "due_at" | "priority" | "status" | "title";
  sortDir?: "asc" | "desc";
}

export async function getNextTaskNumber(db: AppDatabase): Promise<string> {
  const row = await db
    .select()
    .from(taskNumberSequence)
    .where(eq(taskNumberSequence.id, 1))
    .get();
  const next = row?.nextValue ?? 1;
  await db
    .update(taskNumberSequence)
    .set({ nextValue: next + 1 })
    .where(eq(taskNumberSequence.id, 1));
  return `SN-TASK-${String(next).padStart(4, "0")}`;
}

export async function insertTask(
  db: AppDatabase,
  values: NewTaskRow,
): Promise<TaskRow> {
  const row = await db.insert(tasks).values(values).returning().get();
  if (!row) {
    throw new Error("Failed to insert task.");
  }
  return row;
}

export async function updateTaskById(
  db: AppDatabase,
  id: string,
  values: Partial<NewTaskRow>,
): Promise<TaskRow | undefined> {
  return db.update(tasks).set(values).where(eq(tasks.id, id)).returning().get();
}

export async function findTaskById(
  db: AppDatabase,
  id: string,
): Promise<TaskRow | undefined> {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

export async function findTaskWithRelationsById(
  db: AppDatabase,
  id: string,
): Promise<TaskWithRelations | null> {
  const row = await db
    .select({
      task: tasks,
      assignedUser: {
        id: assignedUser.id,
        fullName: assignedUser.fullName,
        email: assignedUser.email,
        role: assignedUser.role,
      },
      createdByUser: {
        id: createdByUser.id,
        fullName: createdByUser.fullName,
        email: createdByUser.email,
      },
      lead: {
        id: leads.id,
        leadNumber: leads.leadNumber,
        name: leads.name,
        phone: leads.phone,
        businessName: leads.businessName,
      },
      customer: {
        id: customers.id,
        customerNumber: customers.customerNumber,
        name: customers.name,
        phone: customers.phone,
        businessName: customers.businessName,
      },
    })
    .from(tasks)
    .leftJoin(assignedUser, eq(tasks.assignedTo, assignedUser.id))
    .leftJoin(createdByUser, eq(tasks.createdBy, createdByUser.id))
    .leftJoin(leads, eq(tasks.leadId, leads.id))
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .where(eq(tasks.id, id))
    .get();

  if (!row) return null;

  return {
    task: row.task,
    assignedUser: row.assignedUser?.id ? row.assignedUser : null,
    createdByUser: row.createdByUser?.id ? row.createdByUser : null,
    lead: row.lead?.id ? row.lead : null,
    customer: row.customer?.id ? row.customer : null,
  };
}

function buildTaskConditions(
  access: TaskAccessScope,
  filters: ListTasksFilterOptions,
) {
  const conditions = [];

  // RBAC scope
  if (access.role === "employee") {
    conditions.push(
      or(
        eq(tasks.assignedTo, access.userId),
        eq(tasks.createdBy, access.userId),
      ),
    );
  }

  // Quick scope
  if (filters.scope === "my") {
    conditions.push(eq(tasks.assignedTo, access.userId));
  } else if (filters.scope === "today") {
    conditions.push(
      and(
        gte(tasks.dueAt, filters.dayStart),
        lte(tasks.dueAt, filters.dayEnd),
      ),
    );
  } else if (filters.scope === "upcoming") {
    conditions.push(
      and(
        gte(tasks.dueAt, filters.dayEnd),
        notInArray(tasks.status, ["completed", "cancelled"]),
      ),
    );
  } else if (filters.scope === "overdue") {
    conditions.push(
      and(
        lte(tasks.dueAt, filters.now),
        notInArray(tasks.status, ["completed", "cancelled"]),
      ),
    );
  } else if (filters.scope === "follow_up") {
    conditions.push(eq(tasks.taskType, "follow_up"));
  }

  // Status / Overdue filter
  if (filters.status) {
    if (filters.status === "overdue") {
      conditions.push(
        and(
          lte(tasks.dueAt, filters.now),
          notInArray(tasks.status, ["completed", "cancelled"]),
        ),
      );
    } else {
      conditions.push(eq(tasks.status, filters.status));
    }
  }

  if (filters.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }

  if (filters.taskType) {
    conditions.push(eq(tasks.taskType, filters.taskType));
  }

  if (filters.assignedTo) {
    conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  }

  if (filters.leadId) {
    conditions.push(eq(tasks.leadId, filters.leadId));
  }

  if (filters.customerId) {
    conditions.push(eq(tasks.customerId, filters.customerId));
  }

  if (filters.dueFrom) {
    conditions.push(gte(tasks.dueAt, filters.dueFrom));
  }

  if (filters.dueTo) {
    conditions.push(lte(tasks.dueAt, filters.dueTo));
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(tasks.title, term),
        like(tasks.description, term),
        like(tasks.taskNumber, term),
      ),
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listTasksWithRelations(
  db: AppDatabase,
  access: TaskAccessScope,
  filters: ListTasksFilterOptions,
  limit: number,
  offset: number,
): Promise<{ items: TaskWithRelations[]; total: number }> {
  const where = buildTaskConditions(access, filters);

  let sortColumn = desc(tasks.createdAt);
  const dir = filters.sortDir === "asc" ? asc : desc;

  if (filters.sortBy === "due_at") {
    sortColumn = dir(tasks.dueAt);
  } else if (filters.sortBy === "priority") {
    sortColumn = dir(tasks.priority);
  } else if (filters.sortBy === "status") {
    sortColumn = dir(tasks.status);
  } else if (filters.sortBy === "title") {
    sortColumn = dir(tasks.title);
  } else if (filters.sortBy === "created_at") {
    sortColumn = dir(tasks.createdAt);
  }

  const rows = await db
    .select({
      task: tasks,
      assignedUser: {
        id: assignedUser.id,
        fullName: assignedUser.fullName,
        email: assignedUser.email,
        role: assignedUser.role,
      },
      createdByUser: {
        id: createdByUser.id,
        fullName: createdByUser.fullName,
        email: createdByUser.email,
      },
      lead: {
        id: leads.id,
        leadNumber: leads.leadNumber,
        name: leads.name,
        phone: leads.phone,
        businessName: leads.businessName,
      },
      customer: {
        id: customers.id,
        customerNumber: customers.customerNumber,
        name: customers.name,
        phone: customers.phone,
        businessName: customers.businessName,
      },
    })
    .from(tasks)
    .leftJoin(assignedUser, eq(tasks.assignedTo, assignedUser.id))
    .leftJoin(createdByUser, eq(tasks.createdBy, createdByUser.id))
    .leftJoin(leads, eq(tasks.leadId, leads.id))
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .where(where)
    .orderBy(sortColumn)
    .limit(limit)
    .offset(offset)
    .all();

  const countRow = await db
    .select({ c: sql<number>`count(*)` })
    .from(tasks)
    .where(where)
    .get();

  const items: TaskWithRelations[] = rows.map((r) => ({
    task: r.task,
    assignedUser: r.assignedUser?.id ? r.assignedUser : null,
    createdByUser: r.createdByUser?.id ? r.createdByUser : null,
    lead: r.lead?.id ? r.lead : null,
    customer: r.customer?.id ? r.customer : null,
  }));

  return { items, total: countRow?.c ?? 0 };
}

export async function insertTaskActivity(
  db: AppDatabase,
  values: NewTaskActivityRow,
): Promise<TaskActivityRow> {
  const row = await db.insert(taskActivities).values(values).returning().get();
  if (!row) {
    throw new Error("Failed to insert task activity.");
  }
  return row;
}

export async function listTaskActivitiesByTaskId(
  db: AppDatabase,
  taskId: string,
): Promise<TaskActivityWithUser[]> {
  const rows = await db
    .select({
      activity: taskActivities,
      user: {
        id: activityUser.id,
        fullName: activityUser.fullName,
        email: activityUser.email,
      },
    })
    .from(taskActivities)
    .leftJoin(activityUser, eq(taskActivities.userId, activityUser.id))
    .where(eq(taskActivities.taskId, taskId))
    .orderBy(desc(taskActivities.createdAt))
    .all();

  return rows.map((r) => ({
    activity: r.activity,
    user: r.user?.id ? r.user : null,
  }));
}

export async function listRecentTaskActivities(
  db: AppDatabase,
  access: TaskAccessScope,
  limit = 20,
): Promise<Array<TaskActivityWithUser & { task: { id: string; taskNumber: string; title: string } }>> {
  const baseWhere =
    access.role === "employee"
      ? or(
          eq(tasks.assignedTo, access.userId),
          eq(tasks.createdBy, access.userId),
        )
      : undefined;

  const rows = await db
    .select({
      activity: taskActivities,
      user: {
        id: activityUser.id,
        fullName: activityUser.fullName,
        email: activityUser.email,
      },
      task: {
        id: tasks.id,
        taskNumber: tasks.taskNumber,
        title: tasks.title,
      },
    })
    .from(taskActivities)
    .innerJoin(tasks, eq(taskActivities.taskId, tasks.id))
    .leftJoin(activityUser, eq(taskActivities.userId, activityUser.id))
    .where(baseWhere)
    .orderBy(desc(taskActivities.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    activity: r.activity,
    user: r.user?.id ? r.user : null,
    task: r.task,
  }));
}

export async function countTaskStats(
  db: AppDatabase,
  access: TaskAccessScope,
  options: { now: string; dayStart: string; dayEnd: string },
) {
  const baseWhere =
    access.role === "employee"
      ? or(
          eq(tasks.assignedTo, access.userId),
          eq(tasks.createdBy, access.userId),
        )
      : undefined;

  const row = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${tasks.status} = 'pending' then 1 else 0 end)`,
      inProgress: sql<number>`sum(case when ${tasks.status} = 'in_progress' then 1 else 0 end)`,
      completed: sql<number>`sum(case when ${tasks.status} = 'completed' then 1 else 0 end)`,
      cancelled: sql<number>`sum(case when ${tasks.status} = 'cancelled' then 1 else 0 end)`,
      overdue: sql<number>`sum(case when ${tasks.dueAt} is not null and ${tasks.dueAt} < ${options.now} and ${tasks.status} not in ('completed', 'cancelled') then 1 else 0 end)`,
      dueToday: sql<number>`sum(case when ${tasks.dueAt} is not null and ${tasks.dueAt} >= ${options.dayStart} and ${tasks.dueAt} <= ${options.dayEnd} then 1 else 0 end)`,
      upcoming: sql<number>`sum(case when ${tasks.dueAt} is not null and ${tasks.dueAt} > ${options.dayEnd} and ${tasks.status} not in ('completed', 'cancelled') then 1 else 0 end)`,
      followUp: sql<number>`sum(case when ${tasks.taskType} = 'follow_up' then 1 else 0 end)`,
      urgent: sql<number>`sum(case when ${tasks.priority} = 'urgent' then 1 else 0 end)`,
      high: sql<number>`sum(case when ${tasks.priority} = 'high' then 1 else 0 end)`,
      medium: sql<number>`sum(case when ${tasks.priority} = 'medium' then 1 else 0 end)`,
      low: sql<number>`sum(case when ${tasks.priority} = 'low' then 1 else 0 end)`,
    })
    .from(tasks)
    .where(baseWhere)
    .get();

  return {
    totalTasks: row?.total ?? 0,
    pendingTasks: row?.pending ?? 0,
    inProgressTasks: row?.inProgress ?? 0,
    completedTasks: row?.completed ?? 0,
    cancelledTasks: row?.cancelled ?? 0,
    overdueTasks: row?.overdue ?? 0,
    dueTodayTasks: row?.dueToday ?? 0,
    upcomingTasks: row?.upcoming ?? 0,
    followUpTasks: row?.followUp ?? 0,
    byPriority: {
      urgent: row?.urgent ?? 0,
      high: row?.high ?? 0,
      medium: row?.medium ?? 0,
      low: row?.low ?? 0,
    },
    scope: access.role === "employee" ? ("personal" as const) : ("organization" as const),
  };
}

export async function findEarliestPendingTaskDueAt(
  db: AppDatabase,
  leadId: string,
): Promise<string | null> {
  const row = await db
    .select({
      nextAt: sql<string | null>`min(${tasks.dueAt})`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.leadId, leadId),
        notInArray(tasks.status, ["completed", "cancelled"]),
        sql`${tasks.dueAt} is not null`,
      ),
    )
    .get();

  return row?.nextAt ?? null;
}
