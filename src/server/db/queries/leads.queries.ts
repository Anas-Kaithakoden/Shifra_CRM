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
import type {
  ActivityType,
  ContactStatus,
  LeadPriority,
  LeadQuickFilter,
  LeadSource,
  PipelineStage,
} from "../../../shared/constants/leads";
import { digitsOnly } from "../../lib/phone";
import type { AppDatabase } from "../client";
import {
  leadActivities,
  leads,
  users,
  type LeadActivityRow,
  type LeadRow,
  type NewLeadActivityRow,
  type NewLeadRow,
} from "../schema";

const assignedUser = alias(users, "assigned_user");
const createdByUser = alias(users, "created_by_user");

export interface LeadAccessScope {
  userId: string;
  role: string;
}

export interface LeadWithRelations {
  lead: LeadRow;
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
    role: string;
  } | null;
  pendingFollowUpCount?: number;
}

export interface ListLeadsFilters {
  search?: string;
  pipelineStage?: PipelineStage;
  contactStatus?: ContactStatus;
  source?: LeadSource;
  serviceInterest?: string;
  assignedTo?: string;
  priority?: LeadPriority;
  quickFilter?: LeadQuickFilter;
  scope?: "all" | "my";
  sortBy?: "created_at" | "next_follow_up_at";
  sortDir?: "asc" | "desc";
  includeArchived?: boolean;
  page: number;
  pageSize: number;
  now: string;
  dayStart: string;
  dayEnd: string;
}

export interface LeadCountRow {
  total: number;
  newCount: number;
  notContacted: number;
  attempted: number;
  contacted: number;
  qualified: number;
  proposalsSent: number;
  negotiation: number;
  won: number;
  lost: number;
  wonValue: number;
}

function scopeConditions(access: LeadAccessScope, scope?: "all" | "my") {
  if (access.role === "employee") {
    return [
      or(
        eq(leads.assignedTo, access.userId),
        eq(leads.createdBy, access.userId),
      ),
    ];
  }

  if (scope === "my") {
    return [eq(leads.assignedTo, access.userId)];
  }

  return [];
}

function searchCondition(search: string) {
  const pattern = `%${search.toLowerCase()}%`;
  const digits = digitsOnly(search);
  const phonePattern = digits ? `%${digits}%` : null;

  return or(
    sql`lower(${leads.name}) like ${pattern}`,
    sql`lower(coalesce(${leads.email}, '')) like ${pattern}`,
    sql`lower(coalesce(${leads.businessName}, '')) like ${pattern}`,
    sql`lower(${leads.leadNumber}) like ${pattern}`,
    sql`lower(coalesce(${leads.location}, '')) like ${pattern}`,
    phonePattern
      ? sql`${leads.phoneNormalized} like ${phonePattern}`
      : undefined,
  );
}

function quickFilterConditions(
  filters: ListLeadsFilters,
  access: LeadAccessScope,
) {
  switch (filters.quickFilter) {
    case "new":
      return [eq(leads.pipelineStage, "new")];
    case "not_contacted":
      return [eq(leads.contactStatus, "not_contacted")];
    case "contacted":
      return [eq(leads.contactStatus, "contacted")];
    case "won":
      return [eq(leads.pipelineStage, "won")];
    case "lost":
      return [eq(leads.pipelineStage, "lost")];
    case "my_leads":
      return [eq(leads.assignedTo, access.userId)];
    case "follow_up_due":
      return [
        gte(leads.nextFollowUpAt, filters.dayStart),
        lte(leads.nextFollowUpAt, filters.dayEnd),
        sql`${leads.pipelineStage} not in ('won', 'lost')`,
      ];
    case "overdue":
      return [
        lt(leads.nextFollowUpAt, filters.now),
        sql`${leads.pipelineStage} not in ('won', 'lost')`,
      ];
    default:
      return [];
  }
}

function buildConditions(
  filters: ListLeadsFilters,
  access: LeadAccessScope,
) {
  const conditions = [];

  if (!filters.includeArchived) {
    conditions.push(isNull(leads.deletedAt));
  }

  conditions.push(...scopeConditions(access, filters.scope));

  if (filters.search) {
    conditions.push(searchCondition(filters.search));
  }
  if (filters.pipelineStage) {
    conditions.push(eq(leads.pipelineStage, filters.pipelineStage));
  }
  if (filters.contactStatus) {
    conditions.push(eq(leads.contactStatus, filters.contactStatus));
  }
  if (filters.source) {
    conditions.push(eq(leads.source, filters.source));
  }
  if (filters.serviceInterest) {
    conditions.push(eq(leads.serviceInterest, filters.serviceInterest));
  }
  if (filters.assignedTo) {
    conditions.push(eq(leads.assignedTo, filters.assignedTo));
  }
  if (filters.priority) {
    conditions.push(eq(leads.priority, filters.priority));
  }

  conditions.push(...quickFilterConditions(filters, access));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function leadSelection() {
  return {
    lead: leads,
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
      role: createdByUser.role,
    },
    pendingFollowUpCount:
      sql<number>`(select count(*) from lead_follow_ups where lead_follow_ups.lead_id = ${leads.id} and lead_follow_ups.status = 'pending')`,
  };
}

function baseLeadQuery(db: AppDatabase) {
  return db
    .select(leadSelection())
    .from(leads)
    .leftJoin(assignedUser, eq(leads.assignedTo, assignedUser.id))
    .leftJoin(createdByUser, eq(leads.createdBy, createdByUser.id));
}

export async function listLeads(
  db: AppDatabase,
  filters: ListLeadsFilters,
  access: LeadAccessScope,
): Promise<{ rows: LeadWithRelations[]; total: number }> {
  const where = buildConditions(filters, access);
  const offset = (filters.page - 1) * filters.pageSize;

  const orderBy =
    filters.sortBy === "next_follow_up_at"
      ? filters.sortDir === "asc"
        ? sql`${leads.nextFollowUpAt} is null, ${leads.nextFollowUpAt} asc, ${leads.createdAt} desc`
        : sql`${leads.nextFollowUpAt} is null, ${leads.nextFollowUpAt} desc, ${leads.createdAt} desc`
      : filters.sortDir === "asc"
        ? asc(leads.createdAt)
        : desc(leads.createdAt);

  const [rows, countRow] = await Promise.all([
    baseLeadQuery(db)
      .where(where)
      .orderBy(orderBy)
      .limit(filters.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function findLeadById(
  db: AppDatabase,
  id: string,
): Promise<LeadWithRelations | undefined> {
  return baseLeadQuery(db).where(eq(leads.id, id)).get();
}

export async function findDuplicateLeads(
  db: AppDatabase,
  options: {
    phoneNormalized?: string;
    emailNormalized?: string;
    excludeId?: string;
  },
): Promise<LeadWithRelations[]> {
  const matches = [];
  if (options.phoneNormalized) {
    matches.push(eq(leads.phoneNormalized, options.phoneNormalized));
  }
  if (options.emailNormalized) {
    matches.push(eq(leads.emailNormalized, options.emailNormalized));
  }
  if (matches.length === 0) {
    return [];
  }

  const conditions = [isNull(leads.deletedAt), or(...matches)];
  if (options.excludeId) {
    conditions.push(sql`${leads.id} != ${options.excludeId}`);
  }

  return baseLeadQuery(db)
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt))
    .limit(10)
    .all();
}

export async function insertLead(
  db: AppDatabase,
  values: NewLeadRow,
): Promise<LeadRow> {
  const row = await db.insert(leads).values(values).returning().get();
  if (!row) {
    throw new Error("Failed to insert lead.");
  }
  return row;
}

export async function updateLeadById(
  db: AppDatabase,
  id: string,
  values: Partial<NewLeadRow>,
): Promise<LeadRow | undefined> {
  return db.update(leads).set(values).where(eq(leads.id, id)).returning().get();
}

export async function deleteLeadById(
  db: AppDatabase,
  id: string,
): Promise<void> {
  await db.delete(leads).where(eq(leads.id, id)).run();
}

export async function insertLeadActivity(
  db: AppDatabase,
  values: NewLeadActivityRow,
): Promise<LeadActivityRow> {
  const row = await db
    .insert(leadActivities)
    .values(values)
    .returning()
    .get();
  if (!row) {
    throw new Error("Failed to insert lead activity.");
  }
  return row;
}

export interface LeadActivityWithUser {
  activity: LeadActivityRow;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export async function listLeadActivities(
  db: AppDatabase,
  options: {
    leadId: string;
    activityType?: ActivityType;
    page: number;
    pageSize: number;
  },
): Promise<{ rows: LeadActivityWithUser[]; total: number }> {
  const conditions = [eq(leadActivities.leadId, options.leadId)];
  if (options.activityType) {
    conditions.push(eq(leadActivities.activityType, options.activityType));
  }
  const where = and(...conditions);
  const offset = (options.page - 1) * options.pageSize;

  const [rows, countRow] = await Promise.all([
    db
      .select({
        activity: leadActivities,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
        },
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.userId, users.id))
      .where(where)
      .orderBy(desc(leadActivities.createdAt), desc(leadActivities.id))
      .limit(options.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leadActivities)
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function countLeadsByStage(
  db: AppDatabase,
  filters: ListLeadsFilters,
  access: LeadAccessScope,
): Promise<Array<{ stage: PipelineStage; count: number; estimatedValue: number }>> {
  const where = buildConditions(filters, access);

  const rows = await db
    .select({
      stage: leads.pipelineStage,
      count: sql<number>`count(*)`,
      estimatedValue: sql<number>`coalesce(sum(${leads.estimatedValue}), 0)`,
    })
    .from(leads)
    .where(where)
    .groupBy(leads.pipelineStage)
    .all();

  return rows.map((row) => ({
    stage: row.stage,
    count: Number(row.count),
    estimatedValue: Number(row.estimatedValue),
  }));
}

export async function getLeadCounts(
  db: AppDatabase,
  access: LeadAccessScope,
  filters: Pick<ListLeadsFilters, "now" | "dayStart" | "dayEnd" | "includeArchived">,
): Promise<LeadCountRow> {
  const conditions = [];
  if (!filters.includeArchived) {
    conditions.push(isNull(leads.deletedAt));
  }
  conditions.push(...scopeConditions(access, "all"));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const row = await db
    .select({
      total: sql<number>`count(*)`,
      newCount: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'new' then 1 else 0 end), 0)`,
      notContacted: sql<number>`coalesce(sum(case when ${leads.contactStatus} = 'not_contacted' then 1 else 0 end), 0)`,
      attempted: sql<number>`coalesce(sum(case when ${leads.contactStatus} = 'attempted' then 1 else 0 end), 0)`,
      contacted: sql<number>`coalesce(sum(case when ${leads.contactStatus} = 'contacted' then 1 else 0 end), 0)`,
      qualified: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'qualified' then 1 else 0 end), 0)`,
      proposalsSent: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'proposal_sent' then 1 else 0 end), 0)`,
      negotiation: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'negotiation' then 1 else 0 end), 0)`,
      won: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'won' then 1 else 0 end), 0)`,
      lost: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'lost' then 1 else 0 end), 0)`,
      wonValue: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'won' then ${leads.estimatedValue} else 0 end), 0)`,
    })
    .from(leads)
    .where(where)
    .get();

  return {
    total: Number(row?.total ?? 0),
    newCount: Number(row?.newCount ?? 0),
    notContacted: Number(row?.notContacted ?? 0),
    attempted: Number(row?.attempted ?? 0),
    contacted: Number(row?.contacted ?? 0),
    qualified: Number(row?.qualified ?? 0),
    proposalsSent: Number(row?.proposalsSent ?? 0),
    negotiation: Number(row?.negotiation ?? 0),
    won: Number(row?.won ?? 0),
    lost: Number(row?.lost ?? 0),
    wonValue: Number(row?.wonValue ?? 0),
  };
}

export async function getLeadSourceDistribution(
  db: AppDatabase,
  access: LeadAccessScope,
): Promise<
  Array<{ source: LeadSource; count: number; won: number; estimatedValue: number }>
> {
  const conditions = [isNull(leads.deletedAt), ...scopeConditions(access, "all")];
  const rows = await db
    .select({
      source: leads.source,
      count: sql<number>`count(*)`,
      won: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'won' then 1 else 0 end), 0)`,
      estimatedValue: sql<number>`coalesce(sum(${leads.estimatedValue}), 0)`,
    })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.source)
    .all();

  return rows.map((row) => ({
    source: row.source,
    count: Number(row.count),
    won: Number(row.won),
    estimatedValue: Number(row.estimatedValue),
  }));
}
