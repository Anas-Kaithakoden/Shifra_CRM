import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import {
  ACTIVITY_TYPE_LABELS,
  CONTACT_STATUS_LABELS,
  PIPELINE_STAGE_LABELS,
  type ContactStatus,
  type ManualActivityType,
  type PipelineStage,
} from "../../shared/constants/leads";
import { findServiceCategory } from "../../shared/constants/services";
import type { AuthUserDto } from "../../shared/types/api";
import type {
  DuplicateLeadDto,
  LeadActivityDto,
  LeadDto,
  LeadListItemDto,
  LeadPipelineDto,
  LeadUserSummary,
} from "../../shared/types/leads";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppDatabase } from "../db/client";
import { findUserById } from "../db/queries/users.queries";
import {
  countLeadsByStage,
  deleteLeadById,
  findDuplicateLeads,
  findLeadById,
  insertLead,
  listLeadActivities,
  listLeads,
  updateLeadById,
  type LeadWithRelations,
} from "../db/queries/leads.queries";
import { getNextPendingFollowUpAt, insertFollowUp } from "../db/queries/follow-ups.queries";
import { findEarliestPendingTaskDueAt } from "../db/queries/tasks.queries";
import type { LeadActivityRow, LeadRow } from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { randomHex } from "../lib/encoding";
import { newId } from "../lib/ids";
import { normalizeEmail, normalizePhone } from "../lib/phone";
import { getCrmDateKey, getCrmDayBounds, nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";
import {
  canManageLead,
  canViewLead,
  toLeadAccessScope,
} from "./lead-access";
import { recordLeadActivity } from "./lead-activity.service";
import {
  toDuplicateLeadDto,
  toLeadActivityDto,
  toLeadDto,
  toLeadListItemDto,
} from "./lead-mappers";
import type {
  AssignLeadInput,
  ChangeStageInput,
  CreateActivityInput,
  CreateLeadInput,
  DuplicateLeadQuery,
  ListActivitiesQuery,
  ListLeadsQuery,
  PipelineQuery,
  UpdateLeadInput,
} from "../schemas/leads.schema";

function isUniqueLeadNumberError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("unique constraint failed: leads.lead_number");
}

function generateLeadNumber(): string {
  return `LD-${getCrmDateKey()}-${randomHex(3).toUpperCase()}`;
}

function toUserSummary(
  user:
    | {
        id: string;
        fullName: string;
        email: string;
        role: AuthUserDto["role"];
      }
    | undefined
    | null,
): LeadUserSummary | null {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

async function resolveAssignee(
  db: AppDatabase,
  actor: AuthUserDto,
  requested: string | undefined,
): Promise<{
  assignedTo: string | null;
  user: LeadUserSummary | null;
}> {
  if (actor.role === "employee") {
    if (requested && requested !== actor.id) {
      throw forbidden("Employees cannot reassign leads.");
    }
    return { assignedTo: actor.id, user: toUserSummary(actor) };
  }

  if (!requested) {
    return { assignedTo: null, user: null };
  }

  const target = await findUserById(db, requested);
  if (!target || !target.isActive) {
    throw badRequest(
      "invalid_assignee",
      "Choose an active team member for this lead.",
    );
  }

  return {
    assignedTo: target.id,
    user: toUserSummary(target),
  };
}

function dayFilters() {
  const now = nowIso();
  const { start, end } = getCrmDayBounds(new Date());
  return { now, dayStart: start, dayEnd: end };
}

export async function listLeadsForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: ListLeadsQuery,
): Promise<{ items: LeadListItemDto[]; total: number }> {
  const { now, dayStart, dayEnd } = dayFilters();
  const { rows, total } = await listLeads(
    db,
    {
      search: query.search,
      pipelineStage: query.pipelineStage,
      contactStatus: query.contactStatus,
      source: query.source,
      serviceInterest: query.serviceInterest,
      assignedTo: query.assignedTo,
      priority: query.priority,
      quickFilter: query.quickFilter,
      scope: query.scope,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      includeArchived: query.includeArchived,
      page: query.page,
      pageSize: query.pageSize,
      now,
      dayStart,
      dayEnd,
    },
    toLeadAccessScope(actor),
  );

  return { items: rows.map(toLeadListItemDto), total };
}

export async function getLeadForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
): Promise<LeadDto> {
  const row = await findLeadById(db, id);
  if (!row || row.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canViewLead(actor, row.lead)) {
    throw forbidden("You do not have access to this lead.");
  }
  return toLeadDto(row);
}

export async function getPipelineForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: PipelineQuery,
): Promise<LeadPipelineDto> {
  const { now, dayStart, dayEnd } = dayFilters();
  const access = toLeadAccessScope(actor);
  const baseFilters = {
    search: query.search,
    assignedTo: query.assignedTo,
    scope: query.scope,
    source: query.source,
    serviceInterest: query.serviceInterest,
    priority: query.priority,
    quickFilter: "all" as const,
    includeArchived: false,
    page: 1,
    pageSize: query.limitPerStage,
    now,
    dayStart,
    dayEnd,
  };

  const counts = await countLeadsByStage(db, baseFilters, access);
  const countByStage = new Map(
    counts.map((row) => [row.stage, Number(row.count)]),
  );

  const stages: PipelineStage[] = [
    "new",
    "contacted",
    "qualified",
    "proposal_sent",
    "negotiation",
    "won",
    "lost",
  ];

  const columns = await Promise.all(
    stages.map(async (stage) => {
      const { rows } = await listLeads(
        db,
        { ...baseFilters, pipelineStage: stage },
        access,
      );
      return {
        stage,
        count: countByStage.get(stage) ?? 0,
        leads: rows.map(toLeadListItemDto),
      };
    }),
  );

  return {
    columns,
    total: counts.reduce((sum, row) => sum + Number(row.count), 0),
    generatedAt: now,
  };
}

export async function checkDuplicateLeadsForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: DuplicateLeadQuery,
): Promise<DuplicateLeadDto[]> {
  const phone = query.phone ? normalizePhone(query.phone) : null;
  const email = query.email ? normalizeEmail(query.email) : null;

  const rows = await findDuplicateLeads(db, {
    phoneNormalized: phone?.valid ? phone.normalized : undefined,
    emailNormalized: email || undefined,
    excludeId: query.excludeId,
  });

  return rows.map((row) => toDuplicateLeadDto(row, canViewLead(actor, row.lead)));
}

export async function createLeadForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  input: CreateLeadInput,
  ipAddress: string | null,
): Promise<LeadDto> {
  const phone = normalizePhone(input.phone);
  if (!phone.valid) {
    throw badRequest("invalid_phone", "Enter a valid phone number.");
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  const duplicates = await findDuplicateLeads(db, {
    phoneNormalized: phone.normalized,
    emailNormalized: email ?? undefined,
  });

  if (duplicates.length > 0 && !input.allowDuplicate) {
    throw conflict(
      "possible_duplicate",
      "A lead with this phone number or email already exists. Review the existing lead before creating another.",
      {
        duplicates: duplicates.map((row) =>
          toDuplicateLeadDto(row, canViewLead(actor, row.lead)),
        ),
      },
    );
  }

  const assignee = await resolveAssignee(db, actor, input.assignedTo);
  const now = nowIso();
  const serviceInterest = input.serviceInterest ?? null;
  const serviceCategory = serviceInterest
    ? findServiceCategory(serviceInterest)
    : null;

  let created: LeadRow | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    try {
      created = await insertLead(db, {
        id: newId(),
        leadNumber: generateLeadNumber(),
        name: input.name,
        phone: phone.display,
        phoneNormalized: phone.normalized,
        email,
        emailNormalized: email,
        businessName: input.businessName ?? null,
        location: input.location ?? null,
        serviceInterest,
        serviceCategory,
        source: input.source,
        pipelineStage: "new",
        contactStatus: "not_contacted",
        assignedTo: assignee.assignedTo,
        estimatedValue: input.estimatedValue ?? null,
        priority: input.priority,
        description: input.description ?? null,
        lostReason: null,
        nextFollowUpAt: input.nextFollowUpAt ?? null,
        lastContactedAt: null,
        convertedAt: null,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (isUniqueLeadNumberError(error) && attempt < 4) {
        continue;
      }
      throw error;
    }
  }

  if (!created) {
    throw new Error("Could not generate a unique lead number.");
  }

  await recordLeadActivity(db, {
    leadId: created.id,
    userId: actor.id,
    activityType: "lead_created",
    title: "Lead created",
    description: `Captured from ${created.source}.`,
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_CREATED,
    entityType: "lead",
    entityId: created.id,
    metadata: {
      leadNumber: created.leadNumber,
      source: created.source,
      assignedTo: created.assignedTo,
    },
    ipAddress,
  });

  if (input.nextFollowUpAt) {
    const followUpId = newId();
    await insertFollowUp(db, {
      id: followUpId,
      leadId: created.id,
      assignedTo: assignee.assignedTo ?? actor.id,
      title: "Initial follow-up",
      notes: "Scheduled when the lead was created.",
      scheduledAt: input.nextFollowUpAt,
      status: "pending",
      completedAt: null,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
    });

    await recordLeadActivity(db, {
      leadId: created.id,
      userId: actor.id,
      activityType: "follow_up_scheduled",
      title: "Follow-up scheduled",
      description: "Initial follow-up scheduled.",
      createdAt: now,
    });

    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.LEAD_FOLLOW_UP_SCHEDULED,
      entityType: "lead",
      entityId: created.id,
      metadata: {
        leadNumber: created.leadNumber,
        followUpId,
        scheduledAt: input.nextFollowUpAt,
      },
      ipAddress,
    });
  }

  return getLeadForActor(db, actor, created.id);
}

export async function updateLeadForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: UpdateLeadInput,
  ipAddress: string | null,
): Promise<LeadDto> {
  const existing = await findLeadById(db, id);
  if (!existing || existing.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canManageLead(actor, existing.lead)) {
    throw forbidden("You can only edit leads assigned to you.");
  }

  const now = nowIso();
  const updates: Record<string, unknown> = { updatedAt: now };
  const changedFields: string[] = [];
  const auditActions: Array<{
    action: string;
    metadata: Record<string, unknown>;
  }> = [];

  if (input.name !== undefined && input.name !== existing.lead.name) {
    updates.name = input.name;
    changedFields.push("name");
  }

  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    if (!phone.valid) {
      throw badRequest("invalid_phone", "Enter a valid phone number.");
    }
    if (
      phone.normalized !== existing.lead.phoneNormalized ||
      phone.display !== existing.lead.phone
    ) {
      const duplicates = await findDuplicateLeads(db, {
        phoneNormalized: phone.normalized,
        excludeId: id,
      });
      if (duplicates.length > 0) {
        throw conflict(
          "possible_duplicate",
          "Another lead already uses this phone number.",
          {
            duplicates: duplicates.map((row) =>
              toDuplicateLeadDto(row, canViewLead(actor, row.lead)),
            ),
          },
        );
      }
      updates.phone = phone.display;
      updates.phoneNormalized = phone.normalized;
      changedFields.push("phone");
    }
  }

  if (input.email !== undefined) {
    const email = input.email ? normalizeEmail(input.email) : null;
    if (email !== existing.lead.email) {
      if (email) {
        const duplicates = await findDuplicateLeads(db, {
          emailNormalized: email,
          excludeId: id,
        });
        if (duplicates.length > 0) {
          throw conflict(
            "possible_duplicate",
            "Another lead already uses this email address.",
            {
              duplicates: duplicates.map((row) =>
                toDuplicateLeadDto(row, canViewLead(actor, row.lead)),
              ),
            },
          );
        }
      }
      updates.email = email;
      updates.emailNormalized = email;
      changedFields.push("email");
    }
  }

  if (input.businessName !== undefined && input.businessName !== existing.lead.businessName) {
    updates.businessName = input.businessName;
    changedFields.push("businessName");
  }
  if (input.location !== undefined && input.location !== existing.lead.location) {
    updates.location = input.location;
    changedFields.push("location");
  }

  if (input.serviceInterest !== undefined) {
    const serviceInterest = input.serviceInterest;
    if (serviceInterest !== existing.lead.serviceInterest) {
      updates.serviceInterest = serviceInterest;
      updates.serviceCategory = serviceInterest
        ? findServiceCategory(serviceInterest)
        : null;
      changedFields.push("serviceInterest");
    }
  }

  if (input.source !== undefined && input.source !== existing.lead.source) {
    updates.source = input.source;
    changedFields.push("source");
  }

  if (
    input.estimatedValue !== undefined &&
    input.estimatedValue !== existing.lead.estimatedValue
  ) {
    updates.estimatedValue = input.estimatedValue;
    changedFields.push("estimatedValue");
  }

  if (input.priority !== undefined && input.priority !== existing.lead.priority) {
    updates.priority = input.priority;
    changedFields.push("priority");
  }

  if (input.description !== undefined && input.description !== existing.lead.description) {
    updates.description = input.description;
    changedFields.push("description");
  }

  if (input.contactStatus !== undefined && input.contactStatus !== existing.lead.contactStatus) {
    updates.contactStatus = input.contactStatus;
    if (input.contactStatus === "contacted") {
      updates.lastContactedAt = now;
    }
    changedFields.push("contactStatus");

    await recordLeadActivity(db, {
      leadId: id,
      userId: actor.id,
      activityType: "contact_status_changed",
      title: "Contact status changed",
      description: `From ${CONTACT_STATUS_LABELS[existing.lead.contactStatus]} to ${CONTACT_STATUS_LABELS[input.contactStatus]}.`,
      createdAt: now,
    });

    auditActions.push({
      action: AUDIT_ACTIONS.LEAD_CONTACT_STATUS_CHANGED,
      metadata: {
        leadNumber: existing.lead.leadNumber,
        from: existing.lead.contactStatus,
        to: input.contactStatus,
      },
    });
  }

  if (input.assignedTo !== undefined && input.assignedTo !== existing.lead.assignedTo) {
    if (!actor.permissions.includes(PERMISSIONS.LEADS_ASSIGN)) {
      throw forbidden("You cannot reassign leads.");
    }

    let targetName: string | null = null;
    if (input.assignedTo) {
      const target = await findUserById(db, input.assignedTo);
      if (!target || !target.isActive) {
        throw badRequest(
          "invalid_assignee",
          "Choose an active team member for this lead.",
        );
      }
      targetName = target.fullName;
    }

    updates.assignedTo = input.assignedTo;
    changedFields.push("assignedTo");

    await recordLeadActivity(db, {
      leadId: id,
      userId: actor.id,
      activityType: "assignment_changed",
      title: "Assignment changed",
      description: targetName
        ? `Lead assigned to ${targetName}.`
        : "Lead was unassigned.",
      createdAt: now,
    });

    auditActions.push({
      action: existing.lead.assignedTo
        ? AUDIT_ACTIONS.LEAD_REASSIGNED
        : AUDIT_ACTIONS.LEAD_ASSIGNED,
      metadata: {
        leadNumber: existing.lead.leadNumber,
        from: existing.lead.assignedTo,
        to: input.assignedTo,
        toName: targetName,
      },
    });
  }

  if (changedFields.length === 0) {
    return toLeadDto(existing);
  }

  const updated = await updateLeadById(db, id, updates);
  if (!updated) {
    throw notFound("Lead not found.");
  }

  if (changedFields.some((field) => field !== "assignedTo" && field !== "contactStatus")) {
    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.LEAD_UPDATED,
      entityType: "lead",
      entityId: id,
      metadata: { leadNumber: updated.leadNumber, fields: changedFields },
      ipAddress,
    });
  }

  for (const entry of auditActions) {
    await recordAudit(db, {
      userId: actor.id,
      action: entry.action,
      entityType: "lead",
      entityId: id,
      metadata: entry.metadata,
      ipAddress,
    });
  }

  return getLeadForActor(db, actor, id);
}

export async function assignLeadForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: AssignLeadInput,
  ipAddress: string | null,
): Promise<LeadDto> {
  const existing = await findLeadById(db, id);
  if (!existing || existing.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (input.assignedTo === existing.lead.assignedTo) {
    return toLeadDto(existing);
  }

  let targetName: string | null = null;
  if (input.assignedTo) {
    const target = await findUserById(db, input.assignedTo);
    if (!target || !target.isActive) {
      throw badRequest(
        "invalid_assignee",
        "Choose an active team member for this lead.",
      );
    }
    targetName = target.fullName;
  }

  const now = nowIso();
  const updated = await updateLeadById(db, id, {
    assignedTo: input.assignedTo,
    updatedAt: now,
  });
  if (!updated) {
    throw notFound("Lead not found.");
  }

  await recordLeadActivity(db, {
    leadId: id,
    userId: actor.id,
    activityType: "assignment_changed",
    title: "Assignment changed",
    description: targetName
      ? `Lead assigned to ${targetName}.`
      : "Lead was unassigned.",
    createdAt: now,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: existing.lead.assignedTo
      ? AUDIT_ACTIONS.LEAD_REASSIGNED
      : AUDIT_ACTIONS.LEAD_ASSIGNED,
    entityType: "lead",
    entityId: id,
    metadata: {
      leadNumber: updated.leadNumber,
      from: existing.lead.assignedTo,
      to: input.assignedTo,
      toName: targetName,
    },
    ipAddress,
  });

  return getLeadForActor(db, actor, id);
}

export async function changeLeadStageForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: ChangeStageInput,
  ipAddress: string | null,
): Promise<LeadDto> {
  const existing = await findLeadById(db, id);
  if (!existing || existing.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canManageLead(actor, existing.lead)) {
    throw forbidden("You can only change the stage of leads assigned to you.");
  }

  const previousStage = existing.lead.pipelineStage;
  const newStage = input.stage;

  if (previousStage === newStage) {
    throw badRequest("same_stage", "The lead is already in that stage.");
  }

  const previousClosed = previousStage === "won" || previousStage === "lost";
  const newClosed = newStage === "won" || newStage === "lost";
  if (previousClosed && newClosed) {
    throw badRequest(
      "invalid_transition",
      "Reopen this closed lead before moving it to another closed stage.",
    );
  }

  const lostReason = input.lostReason?.trim() || null;
  if (newStage === "lost" && !lostReason) {
    throw badRequest(
      "lost_reason_required",
      "Add a reason before marking the lead as lost.",
    );
  }

  const now = nowIso();
  const reopened = previousClosed && !newClosed;
  const updates: Record<string, unknown> = {
    pipelineStage: newStage,
    updatedAt: now,
  };

  if (newStage === "won") {
    updates.convertedAt = now;
    updates.lostReason = null;
    if (existing.lead.contactStatus !== "contacted") {
      updates.contactStatus = "contacted";
      updates.lastContactedAt = existing.lead.lastContactedAt ?? now;
    }
  } else if (newStage === "lost") {
    updates.lostReason = lostReason;
    updates.convertedAt = null;
  } else {
    updates.convertedAt = null;
    updates.lostReason = null;
  }

  const updated = await updateLeadById(db, id, updates);
  if (!updated) {
    throw notFound("Lead not found.");
  }

  const activityType = newStage === "won"
    ? "lead_won"
    : newStage === "lost"
      ? "lead_lost"
      : reopened
        ? "lead_reopened"
        : "stage_changed";

  const title =
    newStage === "won"
      ? "Lead marked as won"
      : newStage === "lost"
        ? "Lead marked as lost"
        : reopened
          ? "Lead reopened"
          : `Stage changed to ${PIPELINE_STAGE_LABELS[newStage]}`;

  const descriptionParts = [
    `From ${PIPELINE_STAGE_LABELS[previousStage]} to ${PIPELINE_STAGE_LABELS[newStage]}.`,
  ];
  if (lostReason) {
    descriptionParts.push(`Reason: ${lostReason}`);
  }
  if (input.reason) {
    descriptionParts.push(input.reason);
  }

  await recordLeadActivity(db, {
    leadId: id,
    userId: actor.id,
    activityType,
    title,
    description: descriptionParts.join(" "),
    previousStage,
    newStage,
    createdAt: now,
  });

  const auditAction =
    newStage === "won"
      ? AUDIT_ACTIONS.LEAD_WON
      : newStage === "lost"
        ? AUDIT_ACTIONS.LEAD_LOST
        : reopened
          ? AUDIT_ACTIONS.LEAD_REOPENED
          : AUDIT_ACTIONS.LEAD_STAGE_CHANGED;

  await recordAudit(db, {
    userId: actor.id,
    action: auditAction,
    entityType: "lead",
    entityId: id,
    metadata: {
      leadNumber: updated.leadNumber,
      previousStage,
      newStage,
      lostReason,
      reopened,
    },
    ipAddress,
  });

  return getLeadForActor(db, actor, id);
}

export async function addLeadActivityForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: CreateActivityInput,
  ipAddress: string | null,
): Promise<{ activity: LeadActivityDto; lead: LeadDto }> {
  const existing = await findLeadById(db, id);
  if (!existing || existing.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canManageLead(actor, existing.lead)) {
    throw forbidden("You can only record interactions for leads assigned to you.");
  }

  const now = nowIso();
  const occurredAt = input.occurredAt ?? now;
  const contactActivity = (
    ["call", "whatsapp", "email", "meeting"] as ManualActivityType[]
  ).includes(input.activityType);
  const established = input.contacted ?? input.activityType === "meeting";

  let nextContactStatus: ContactStatus = existing.lead.contactStatus;
  if (input.contactStatus) {
    nextContactStatus = input.contactStatus;
  } else if (established) {
    nextContactStatus = "contacted";
  } else if (contactActivity && existing.lead.contactStatus === "not_contacted") {
    nextContactStatus = "attempted";
  }

  if (existing.lead.contactStatus === "contacted" && !input.contactStatus) {
    nextContactStatus = "contacted";
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  const contactStatusChanged = nextContactStatus !== existing.lead.contactStatus;
  if (contactStatusChanged) {
    updates.contactStatus = nextContactStatus;
  }
  if (nextContactStatus === "contacted") {
    updates.lastContactedAt = occurredAt;
  }

  if (Object.keys(updates).length > 1) {
    await updateLeadById(db, id, updates);
  }

  const activity = await recordLeadActivity(db, {
    leadId: id,
    userId: actor.id,
    activityType: input.activityType,
    title: input.title,
    description: input.description ?? null,
    createdAt: occurredAt,
  });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_INTERACTION_LOGGED,
    entityType: "lead",
    entityId: id,
    metadata: {
      leadNumber: existing.lead.leadNumber,
      activityType: input.activityType,
      contactStatus: nextContactStatus,
    },
    ipAddress,
  });

  if (contactStatusChanged) {
    await recordAudit(db, {
      userId: actor.id,
      action: AUDIT_ACTIONS.LEAD_CONTACT_STATUS_CHANGED,
      entityType: "lead",
      entityId: id,
      metadata: {
        leadNumber: existing.lead.leadNumber,
        from: existing.lead.contactStatus,
        to: nextContactStatus,
      },
      ipAddress,
    });
  }

  return {
    activity: toLeadActivityDto({
      activity,
      user: {
        id: actor.id,
        fullName: actor.fullName,
        email: actor.email,
        role: actor.role,
      },
    }),
    lead: await getLeadForActor(db, actor, id),
  };
}

export async function listLeadActivitiesForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  query: ListActivitiesQuery,
): Promise<{ items: LeadActivityDto[]; total: number }> {
  const existing = await findLeadById(db, id);
  if (!existing || existing.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canViewLead(actor, existing.lead)) {
    throw forbidden("You do not have access to this lead.");
  }

  const { rows, total } = await listLeadActivities(db, {
    leadId: id,
    activityType: query.activityType,
    page: query.page,
    pageSize: query.pageSize,
  });

  return { items: rows.map(toLeadActivityDto), total };
}

export async function archiveLeadForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  ipAddress: string | null,
): Promise<void> {
  const existing = await findLeadById(db, id);
  if (!existing || existing.lead.deletedAt) {
    throw notFound("Lead not found.");
  }

  const now = nowIso();
  await updateLeadById(db, id, { deletedAt: now, updatedAt: now });

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_ARCHIVED,
    entityType: "lead",
    entityId: id,
    metadata: { leadNumber: existing.lead.leadNumber },
    ipAddress,
  });
}

export async function deleteLeadPermanentlyForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  ipAddress: string | null,
): Promise<void> {
  const existing = await findLeadById(db, id);
  if (!existing) {
    throw notFound("Lead not found.");
  }
  if (!canManageLead(actor, existing.lead)) {
    throw forbidden("You do not have permission to delete this lead.");
  }

  await deleteLeadById(db, id);
  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.LEAD_DELETED,
    entityType: "lead",
    entityId: id,
    metadata: { leadNumber: existing.lead.leadNumber },
    ipAddress,
  });
}

export async function syncLeadNextFollowUpAt(
  db: AppDatabase,
  leadId: string,
): Promise<void> {
  const nextFollowUp = await getNextPendingFollowUpAt(db, leadId);
  const nextTask = await findEarliestPendingTaskDueAt(db, leadId);
  let next: string | null = null;
  if (nextFollowUp && nextTask) {
    next = nextFollowUp < nextTask ? nextFollowUp : nextTask;
  } else {
    next = nextFollowUp ?? nextTask ?? null;
  }
  await updateLeadById(db, leadId, {
    nextFollowUpAt: next,
    updatedAt: nowIso(),
  });
}

export function describeActivityType(type: ManualActivityType): string {
  return ACTIVITY_TYPE_LABELS[type];
}

export function toLeadDtoForTest(row: LeadWithRelations): LeadDto {
  return toLeadDto(row);
}

export function toLeadActivityRowForTest(row: LeadActivityRow): LeadActivityRow {
  return row;
}
