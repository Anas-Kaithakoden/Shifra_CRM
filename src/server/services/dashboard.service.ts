import type {
  AuthUserDto,
  DashboardStatsDto,
} from "../../shared/types/api";
import type { LeadDashboardStatsDto } from "../../shared/types/leads";
import type { Role } from "../../shared/types/roles";
import type { AppDatabase } from "../db/client";
import { listRecentAuditLogs } from "../db/queries/audit.queries";
import {
  countFollowUpsForDashboard,
  listFollowUps,
} from "../db/queries/follow-ups.queries";
import {
  countLeadsByStage,
  getLeadCounts,
  getLeadSourceDistribution,
  listLeads,
} from "../db/queries/leads.queries";
import {
  countUsers,
  countUsersByRole,
} from "../db/queries/users.queries";
import { getCrmDayBounds, nowIso } from "../lib/time";
import { toAuditLogDto } from "./mappers";
import { toLeadFollowUpDto, toLeadListItemDto } from "./lead-mappers";
import { toLeadAccessScope } from "./lead-access";
import { getCustomerDashboardStatsForActor } from "./customers.service";

const COMING_SOON = { value: null, status: "coming_soon" as const };

export async function getLeadDashboardStats(
  db: AppDatabase,
  actor: AuthUserDto,
): Promise<LeadDashboardStatsDto> {
  const now = nowIso();
  const { start: dayStart, end: dayEnd } = getCrmDayBounds(new Date());
  const access = toLeadAccessScope(actor);
  const timeFilters = { now, dayStart, dayEnd };
  const baseFilters = {
    quickFilter: "all" as const,
    scope: "all" as const,
    includeArchived: false,
    page: 1,
    pageSize: 6,
    ...timeFilters,
  };

  const [counts, followUpCounts, pipeline, sources, recent, dueToday, overdue] =
    await Promise.all([
      getLeadCounts(db, access, { ...timeFilters, includeArchived: false }),
      countFollowUpsForDashboard(db, access, timeFilters),
      countLeadsByStage(db, baseFilters, access),
      getLeadSourceDistribution(db, access),
      listLeads(db, baseFilters, access),
      listFollowUps(
        db,
        { ...timeFilters, scope: "today", page: 1, pageSize: 5 },
        access,
      ),
      listFollowUps(
        db,
        { ...timeFilters, scope: "overdue", page: 1, pageSize: 5 },
        access,
      ),
    ]);

  const closed = counts.won + counts.lost;
  const open = Math.max(0, counts.total - closed);
  const conversionRate =
    closed === 0 ? 0 : Math.round((counts.won / closed) * 1000) / 10;

  return {
    scope: actor.role === "employee" ? "personal" : "organization",
    counts: {
      total: counts.total,
      new: counts.newCount,
      notContacted: counts.notContacted,
      attempted: counts.attempted,
      contacted: counts.contacted,
      qualified: counts.qualified,
      proposalsSent: counts.proposalsSent,
      negotiation: counts.negotiation,
      won: counts.won,
      lost: counts.lost,
      overdueFollowUps: followUpCounts.overdue,
      dueTodayFollowUps: followUpCounts.dueToday,
    },
    pipeline,
    sources,
    conversion: {
      won: counts.won,
      lost: counts.lost,
      open,
      conversionRate,
      wonValue: counts.wonValue,
    },
    recentLeads: recent.rows.map(toLeadListItemDto),
    followUps: {
      dueToday: dueToday.rows.map(toLeadFollowUpDto),
      overdue: overdue.rows.map(toLeadFollowUpDto),
    },
    generatedAt: now,
  };
}

export async function getDashboardStats(
  db: AppDatabase,
  actor: AuthUserDto,
): Promise<DashboardStatsDto> {
  const organizationScope = actor.role === "owner";

  const [counts, roleRows, recent, leadStats, customerStats] = await Promise.all([
    countUsers(db),
    countUsersByRole(db),
    listRecentAuditLogs(db, {
      limit: 8,
      userId: organizationScope ? undefined : actor.id,
    }),
    getLeadDashboardStats(db, actor),
    getCustomerDashboardStatsForActor(db, actor),
  ]);

  const byRole: Record<Role, number> = {
    owner: 0,
    admin: 0,
    employee: 0,
  };
  for (const row of roleRows) {
    byRole[row.role] = row.count;
  }

  return {
    employees: {
      total: counts.total,
      active: counts.active,
      inactive: counts.total - counts.active,
      byRole,
    },
    leads: { value: leadStats.counts.total, status: "available" },
    leadStats,
    customerStats,
    activeProjects: COMING_SOON,
    pendingPayments: COMING_SOON,
    recentActivity: recent.map(toAuditLogDto),
    recentActivityScope: organizationScope ? "organization" : "personal",
    generatedAt: nowIso(),
  };
}
