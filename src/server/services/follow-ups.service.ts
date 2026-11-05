import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import type { AuthUserDto } from "../../shared/types/api";
import type { LeadFollowUpDto } from "../../shared/types/leads";
import type { AppDatabase } from "../db/client";
import { findUserById } from "../db/queries/users.queries";
import { findLeadById } from "../db/queries/leads.queries";
import {
  countFollowUpsByScope,
  findFollowUpById,
  insertFollowUp,
  listFollowUps,
  updateFollowUpById,
} from "../db/queries/follow-ups.queries";
import type { LeadFollowUpRow, LeadRow } from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { getCrmDayBounds, nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";
import { canManageLead, canManageLeadFollowUp, canViewLead, toLeadAccessScope } from "./lead-access";
import { recordLeadActivity } from "./lead-activity.service";
import { toLeadFollowUpDto } from "./lead-mappers";
import { syncLeadNextFollowUpAt } from "./leads.service";
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  ListFollowUpsQuery,
  UpdateFollowUpInput,
} from "../schemas/leads.schema";

function dayFilters() {
  const now = nowIso();
  const { start, end } = getCrmDayBounds(new Date());
  return { now, dayStart: start, dayEnd: end };
}

async function requireFollowUp(
  db: AppDatabase,
  id: string,
): Promise<{ followUp: LeadFollowUpRow; lead: LeadRow }> {
  const row = await findFollowUpById(db, id);
  if (!row) {
    throw notFound("Follow-up not found.");
  }

  const lead = await findLeadById(db, row.followUp.leadId);
  if (!lead || lead.lead.deletedAt) {
    throw notFound("Lead not found.");
  }

  return { followUp: row.followUp, lead: lead.lead };
}

function assertCanManageFollowUp(
  actor: AuthUserDto,
  followUp: LeadFollowUpRow,
  lead: LeadRow,
): void {
  if (!canViewLead(actor, lead)) {
    throw forbidden("You do not have access to this follow-up.");
  }
  if (
    !canManageLeadFollowUp(actor, {
      assignedTo: followUp.assignedTo,
      leadAssignedTo: lead.assignedTo,
    })
  ) {
    throw forbidden("You can only manage your own follow-ups.");
  }
}

async function resolveFollowUpAssignee(
  db: AppDatabase,
  actor: AuthUserDto,
  requested: string | null | undefined,
  fallback: string | null,
): Promise<string | null> {
  if (requested === undefined) {
    return fallback;
  }

  if (actor.role === "employee") {
    if (requested !== actor.id) {
      throw forbidden("Employees cannot assign follow-ups to other team members.");
    }
    return actor.id;
  }

  if (requested === null) {
    return null;
  }

  const target = await findUserById(db, requested);
  if (!target || !target.isActive) {
    throw badRequest(
      "invalid_assignee",
      "Choose an active team member for this follow-up.",
    );
  }
  return target.id;
}

async function getFollowUpDto(
  db: AppDatabase,
  id: string,
): Promise<LeadFollowUpDto> {
  const row = await findFollowUpById(db, id);
  if (!row) {
    throw notFound("Follow-up not found.");
  }
  return toLeadFollowUpDto(row);
}

export async function listFollowUpsForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: ListFollowUpsQuery,
): Promise<{ items: LeadFollowUpDto[]; total: number }> {
  const { now, dayStart, dayEnd } = dayFilters();
  const { rows, total } = await listFollowUps(
    db,
    {
      scope: query.scope,
      status: query.status,
      assignedTo: query.assignedTo,
      leadId: query.leadId,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
      now,
      dayStart,
      dayEnd,
    },
    toLeadAccessScope(actor),
  );

  return { items: rows.map(toLeadFollowUpDto), total };
}

export async function getFollowUpCountsForActor(
  db: AppDatabase,
  actor: AuthUserDto,
): Promise<{ today: number; upcoming: number; overdue: number; completed: number }> {
  const { now, dayStart, dayEnd } = dayFilters();
  return countFollowUpsByScope(db, toLeadAccessScope(actor), {
    now,
    dayStart,
    dayEnd,
  });
}

export async function createFollowUpForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  leadId: string,
  input: CreateFollowUpInput,
  ipAddress: string | null,
): Promise<LeadFollowUpDto> {
  const leadRow = await findLeadById(db, leadId);
  if (!leadRow || leadRow.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canManageLead(actor, leadRow.lead)) {
    throw forbidden("You can only schedule follow-ups for leads assigned to you.");
  }

  const assignedTo = await resolveFollowUpAssignee(
    db,
    actor,
    input.assignedTo,
    leadRow.lead.assignedTo ?? actor.id,
  );

  const now = nowIso();
  const followUp = await insertFollowUp(db, {
    id: newId(),
    leadId,
    assignedTo,
    title: input.title,
    notes: input.notes ?? null,
    scheduledAt: input.scheduledAt,
    status: "pending",
    completedAt: null,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await recordLeadActivity(db, {
    leadId,
    userId: actor.id,
    activityType: "follow_up_scheduled",
    title: "Follow-up scheduled",
    description: `${followUp.title} · ${followUp.scheduledAt}`,
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_FOLLOW_UP_SCHEDULED,
    entityType: "lead",
    entityId: leadId,
    metadata: {
      leadNumber: leadRow.lead.leadNumber,
      followUpId: followUp.id,
      title: followUp.title,
      scheduledAt: followUp.scheduledAt,
      assignedTo,
    },
    ipAddress,
  });

  await syncLeadNextFollowUpAt(db, leadId);

  return getFollowUpDto(db, followUp.id);
}

export async function updateFollowUpForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: UpdateFollowUpInput,
  ipAddress: string | null,
): Promise<LeadFollowUpDto> {
  const { followUp, lead } = await requireFollowUp(db, id);
  assertCanManageFollowUp(actor, followUp, lead);

  if (followUp.status !== "pending") {
    throw conflict(
      "follow_up_not_pending",
      "Only pending follow-ups can be changed.",
    );
  }

  const now = nowIso();
  const updates: Record<string, unknown> = { updatedAt: now };
  const changedFields: string[] = [];

  if (input.title !== undefined && input.title !== followUp.title) {
    updates.title = input.title;
    changedFields.push("title");
  }
  if (input.notes !== undefined && input.notes !== followUp.notes) {
    updates.notes = input.notes;
    changedFields.push("notes");
  }

  const rescheduled =
    input.scheduledAt !== undefined && input.scheduledAt !== followUp.scheduledAt;
  if (rescheduled) {
    updates.scheduledAt = input.scheduledAt;
    changedFields.push("scheduledAt");
  }

  if (input.assignedTo !== undefined) {
    const assignedTo = await resolveFollowUpAssignee(
      db,
      actor,
      input.assignedTo,
      followUp.assignedTo,
    );
    if (assignedTo !== followUp.assignedTo) {
      updates.assignedTo = assignedTo;
      changedFields.push("assignedTo");
    }
  }

  if (changedFields.length === 0) {
    return getFollowUpDto(db, id);
  }

  const updated = await updateFollowUpById(db, id, updates);
  if (!updated) {
    throw notFound("Follow-up not found.");
  }

  if (rescheduled) {
    await recordLeadActivity(db, {
      leadId: followUp.leadId,
      userId: actor.id,
      activityType: "follow_up_rescheduled",
      title: "Follow-up rescheduled",
      description: `${followUp.title}: ${followUp.scheduledAt} → ${updated.scheduledAt}`,
      createdAt: now,
    });

    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.LEAD_FOLLOW_UP_RESCHEDULED,
      entityType: "lead",
      entityId: followUp.leadId,
      metadata: {
        leadNumber: lead.leadNumber,
        followUpId: id,
        from: followUp.scheduledAt,
        to: updated.scheduledAt,
        fields: changedFields,
      },
      ipAddress,
    });
  }

  const otherChanges = changedFields.filter((field) => field !== "scheduledAt");
  if (otherChanges.length > 0) {
    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.LEAD_FOLLOW_UP_UPDATED,
      entityType: "lead",
      entityId: followUp.leadId,
      metadata: {
        leadNumber: lead.leadNumber,
        followUpId: id,
        fields: otherChanges,
      },
      ipAddress,
    });
  }

  await syncLeadNextFollowUpAt(db, followUp.leadId);

  return getFollowUpDto(db, id);
}

export async function completeFollowUpForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: CompleteFollowUpInput,
  ipAddress: string | null,
): Promise<LeadFollowUpDto> {
  const { followUp, lead } = await requireFollowUp(db, id);
  assertCanManageFollowUp(actor, followUp, lead);

  if (followUp.status !== "pending") {
    throw conflict(
      "follow_up_not_pending",
      "Only pending follow-ups can be completed.",
    );
  }

  const now = nowIso();
  const updated = await updateFollowUpById(db, id, {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  });
  if (!updated) {
    throw notFound("Follow-up not found.");
  }

  await recordLeadActivity(db, {
    leadId: followUp.leadId,
    userId: actor.id,
    activityType: "follow_up_completed",
    title: "Follow-up completed",
    description: input.completedNote ?? followUp.notes ?? followUp.title,
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_FOLLOW_UP_COMPLETED,
    entityType: "lead",
    entityId: followUp.leadId,
    metadata: {
      leadNumber: lead.leadNumber,
      followUpId: id,
      scheduledAt: followUp.scheduledAt,
      completedAt: now,
    },
    ipAddress,
  });

  await syncLeadNextFollowUpAt(db, followUp.leadId);

  return getFollowUpDto(db, id);
}

export async function cancelFollowUpForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  reason: string | undefined,
  ipAddress: string | null,
): Promise<LeadFollowUpDto> {
  const { followUp, lead } = await requireFollowUp(db, id);
  assertCanManageFollowUp(actor, followUp, lead);

  if (followUp.status !== "pending") {
    throw conflict(
      "follow_up_not_pending",
      "Only pending follow-ups can be cancelled.",
    );
  }

  const now = nowIso();
  const updated = await updateFollowUpById(db, id, {
    status: "cancelled",
    updatedAt: now,
  });
  if (!updated) {
    throw notFound("Follow-up not found.");
  }

  await recordLeadActivity(db, {
    leadId: followUp.leadId,
    userId: actor.id,
    activityType: "follow_up_cancelled",
    title: "Follow-up cancelled",
    description: reason ?? followUp.title,
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_FOLLOW_UP_CANCELLED,
    entityType: "lead",
    entityId: followUp.leadId,
    metadata: {
      leadNumber: lead.leadNumber,
      followUpId: id,
      scheduledAt: followUp.scheduledAt,
      reason: reason ?? null,
    },
    ipAddress,
  });

  await syncLeadNextFollowUpAt(db, followUp.leadId);

  return getFollowUpDto(db, id);
}
