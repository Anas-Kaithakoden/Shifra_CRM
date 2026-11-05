import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { FollowUpStatus } from "../../../shared/constants/leads";
import type { AppDatabase } from "../client";
import {
  leadFollowUps,
  leads,
  users,
  type LeadFollowUpRow,
  type NewLeadFollowUpRow,
} from "../schema";
import type { LeadAccessScope } from "./leads.queries";

const assignedUser = alias(users, "follow_up_assigned_user");
const createdByUser = alias(users, "follow_up_created_by_user");

export interface FollowUpWithRelations {
  followUp: LeadFollowUpRow;
  lead: {
    id: string;
    leadNumber: string;
    name: string;
    phone: string;
  } | null;
  assignedUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdByUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export type FollowUpScope =
  | "all"
  | "today"
  | "upcoming"
  | "overdue"
  | "completed"
  | "cancelled";

export interface ListFollowUpsFilters {
  scope: FollowUpScope;
  status?: FollowUpStatus;
  assignedTo?: string;
  leadId?: string;
  search?: string;
  page: number;
  pageSize: number;
  now: string;
  dayStart: string;
  dayEnd: string;
}

function buildConditions(
  filters: ListFollowUpsFilters,
  access: LeadAccessScope,
) {
  const conditions = [isNull(leads.deletedAt)];

  if (access.role === "employee") {
    conditions.push(
      or(
        eq(leadFollowUps.assignedTo, access.userId),
        and(
          isNull(leadFollowUps.assignedTo),
          eq(leads.assignedTo, access.userId),
        ),
      )!,
    );
  }

  if (filters.leadId) {
    conditions.push(eq(leadFollowUps.leadId, filters.leadId));
  }
  if (filters.assignedTo) {
    conditions.push(eq(leadFollowUps.assignedTo, filters.assignedTo));
  }
  if (filters.status) {
    conditions.push(eq(leadFollowUps.status, filters.status));
  }
  if (filters.search) {
    const pattern = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${leads.name}) like ${pattern}`,
        sql`lower(${leads.leadNumber}) like ${pattern}`,
        sql`lower(${leadFollowUps.title}) like ${pattern}`,
        sql`${leads.phoneNormalized} like ${`%${filters.search.replace(/\D/g, "")}%`}`,
      )!,
    );
  }

  switch (filters.scope) {
    case "today":
      conditions.push(
        eq(leadFollowUps.status, "pending"),
        gte(leadFollowUps.scheduledAt, filters.dayStart),
        lte(leadFollowUps.scheduledAt, filters.dayEnd),
      );
      break;
    case "upcoming":
      conditions.push(
        eq(leadFollowUps.status, "pending"),
        sql`${leadFollowUps.scheduledAt} > ${filters.dayEnd}`,
      );
      break;
    case "overdue":
      conditions.push(
        eq(leadFollowUps.status, "pending"),
        lt(leadFollowUps.scheduledAt, filters.dayStart),
      );
      break;
    case "completed":
      conditions.push(eq(leadFollowUps.status, "completed"));
      break;
    case "cancelled":
      conditions.push(eq(leadFollowUps.status, "cancelled"));
      break;
    default:
      break;
  }

  return and(...conditions);
}

export async function listFollowUps(
  db: AppDatabase,
  filters: ListFollowUpsFilters,
  access: LeadAccessScope,
): Promise<{ rows: FollowUpWithRelations[]; total: number }> {
  const where = buildConditions(filters, access);
  const offset = (filters.page - 1) * filters.pageSize;

  const orderBy =
    filters.scope === "completed" || filters.scope === "cancelled"
      ? [
          desc(leadFollowUps.completedAt),
          desc(leadFollowUps.scheduledAt),
          desc(leadFollowUps.createdAt),
        ]
      : [asc(leadFollowUps.scheduledAt), asc(leadFollowUps.createdAt)];

  const [rows, countRow] = await Promise.all([
    db
      .select({
        followUp: leadFollowUps,
        lead: {
          id: leads.id,
          leadNumber: leads.leadNumber,
          name: leads.name,
          phone: leads.phone,
        },
        assignedUser: {
          id: assignedUser.id,
          fullName: assignedUser.fullName,
          email: assignedUser.email,
        },
        createdByUser: {
          id: createdByUser.id,
          fullName: createdByUser.fullName,
          email: createdByUser.email,
        },
      })
      .from(leadFollowUps)
      .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
      .leftJoin(assignedUser, eq(leadFollowUps.assignedTo, assignedUser.id))
      .leftJoin(createdByUser, eq(leadFollowUps.createdBy, createdByUser.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(filters.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leadFollowUps)
      .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function countFollowUpsByScope(
  db: AppDatabase,
  access: LeadAccessScope,
  options: { now: string; dayStart: string; dayEnd: string },
): Promise<Record<"today" | "upcoming" | "overdue" | "completed", number>> {
  const scopes = ["today", "upcoming", "overdue", "completed"] as const;

  const results = await Promise.all(
    scopes.map(async (scope) => {
      const where = buildConditions(
        {
          scope,
          page: 1,
          pageSize: 1,
          now: options.now,
          dayStart: options.dayStart,
          dayEnd: options.dayEnd,
        },
        access,
      );
      const row = await db
        .select({ count: sql<number>`count(*)` })
        .from(leadFollowUps)
        .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
        .where(where)
        .get();
      return [scope, Number(row?.count ?? 0)] as const;
    }),
  );

  return Object.fromEntries(results) as Record<
    "today" | "upcoming" | "overdue" | "completed",
    number
  >;
}

export async function findFollowUpById(
  db: AppDatabase,
  id: string,
): Promise<FollowUpWithRelations | undefined> {
  return db
    .select({
      followUp: leadFollowUps,
      lead: {
        id: leads.id,
        leadNumber: leads.leadNumber,
        name: leads.name,
        phone: leads.phone,
      },
      assignedUser: {
        id: assignedUser.id,
        fullName: assignedUser.fullName,
        email: assignedUser.email,
      },
      createdByUser: {
        id: createdByUser.id,
        fullName: createdByUser.fullName,
        email: createdByUser.email,
      },
    })
    .from(leadFollowUps)
    .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
    .leftJoin(assignedUser, eq(leadFollowUps.assignedTo, assignedUser.id))
    .leftJoin(createdByUser, eq(leadFollowUps.createdBy, createdByUser.id))
    .where(eq(leadFollowUps.id, id))
    .get();
}

export async function insertFollowUp(
  db: AppDatabase,
  values: NewLeadFollowUpRow,
): Promise<LeadFollowUpRow> {
  const row = await db
    .insert(leadFollowUps)
    .values(values)
    .returning()
    .get();
  if (!row) {
    throw new Error("Failed to insert follow-up.");
  }
  return row;
}

export async function updateFollowUpById(
  db: AppDatabase,
  id: string,
  values: Partial<NewLeadFollowUpRow>,
): Promise<LeadFollowUpRow | undefined> {
  return db
    .update(leadFollowUps)
    .set(values)
    .where(eq(leadFollowUps.id, id))
    .returning()
    .get();
}

export async function getNextPendingFollowUpAt(
  db: AppDatabase,
  leadId: string,
): Promise<string | null> {
  const row = await db
    .select({
      nextAt: sql<string | null>`min(${leadFollowUps.scheduledAt})`,
    })
    .from(leadFollowUps)
    .where(
      and(
        eq(leadFollowUps.leadId, leadId),
        eq(leadFollowUps.status, "pending"),
      ),
    )
    .get();

  return row?.nextAt ?? null;
}

export async function countFollowUpsForDashboard(
  db: AppDatabase,
  access: LeadAccessScope,
  options: { now: string; dayStart: string; dayEnd: string },
): Promise<{ overdue: number; dueToday: number }> {
  const scopeCondition =
    access.role === "employee"
      ? or(
          eq(leadFollowUps.assignedTo, access.userId),
          and(
            isNull(leadFollowUps.assignedTo),
            eq(leads.assignedTo, access.userId),
          ),
        )
      : undefined;

  const baseConditions = [isNull(leads.deletedAt), eq(leadFollowUps.status, "pending")];
  if (scopeCondition) {
    baseConditions.push(scopeCondition);
  }

  const [overdueRow, todayRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(leadFollowUps)
      .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
      .where(and(...baseConditions, lt(leadFollowUps.scheduledAt, options.now)))
      .get(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leadFollowUps)
      .innerJoin(leads, eq(leadFollowUps.leadId, leads.id))
      .where(
        and(
          ...baseConditions,
          gte(leadFollowUps.scheduledAt, options.dayStart),
          lte(leadFollowUps.scheduledAt, options.dayEnd),
        ),
      )
      .get(),
  ]);

  return {
    overdue: Number(overdueRow?.count ?? 0),
    dueToday: Number(todayRow?.count ?? 0),
  };
}
