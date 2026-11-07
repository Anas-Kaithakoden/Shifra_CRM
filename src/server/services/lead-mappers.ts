import type { Role } from "../../shared/types/roles";
import type {
  DuplicateLeadDto,
  LeadActivityDto,
  LeadDto,
  LeadFollowUpDto,
  LeadListItemDto,
  LeadUserSummary,
} from "../../shared/types/leads";
import type { FollowUpWithRelations } from "../db/queries/follow-ups.queries";
import type {
  LeadActivityWithUser,
  LeadWithRelations,
} from "../db/queries/leads.queries";
import type { LeadRow } from "../db/schema";

function toUserSummary(
  user:
    | {
        id: string | null;
        fullName: string | null;
        email: string | null;
        role: string | null;
      }
    | null
    | undefined,
): LeadUserSummary | null {
  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    role: (user.role ?? "employee") as Role,
  };
}

export function toLeadDto(row: LeadWithRelations): LeadDto {
  const { lead } = row;
  const assigned = toUserSummary(row.assignedUser);
  const createdBy = toUserSummary(row.createdByUser);

  return {
    id: lead.id,
    leadNumber: lead.leadNumber,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    businessName: lead.businessName,
    location: lead.location,
    serviceInterest: lead.serviceInterest,
    serviceCategory: lead.serviceCategory,
    source: lead.source,
    pipelineStage: lead.pipelineStage,
    contactStatus: lead.contactStatus,
    assignedTo: lead.assignedTo,
    assignedToName: assigned?.fullName ?? null,
    assignedToUser: assigned,
    estimatedValue: lead.estimatedValue,
    priority: lead.priority,
    description: lead.description,
    lostReason: lead.lostReason,
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactedAt: lead.lastContactedAt,
    convertedAt: lead.convertedAt,
    customerId: lead.customerId,
    convertedToCustomerAt: lead.convertedToCustomerAt,
    createdBy: lead.createdBy,
    createdByName: createdBy?.fullName ?? null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    deletedAt: lead.deletedAt,
  };
}

export function toLeadListItemDto(row: LeadWithRelations): LeadListItemDto {
  return {
    ...toLeadDto(row),
    pendingFollowUpCount: Number(row.pendingFollowUpCount ?? 0),
  };
}

export function toLeadDtoFromRow(
  row: LeadRow,
  users: {
    assigned?: LeadUserSummary | null;
    createdBy?: LeadUserSummary | null;
  } = {},
): LeadDto {
  return {
    id: row.id,
    leadNumber: row.leadNumber,
    name: row.name,
    phone: row.phone,
    email: row.email,
    businessName: row.businessName,
    location: row.location,
    serviceInterest: row.serviceInterest,
    serviceCategory: row.serviceCategory,
    source: row.source,
    pipelineStage: row.pipelineStage,
    contactStatus: row.contactStatus,
    assignedTo: row.assignedTo,
    assignedToName: users.assigned?.fullName ?? null,
    assignedToUser: users.assigned ?? null,
    estimatedValue: row.estimatedValue,
    priority: row.priority,
    description: row.description,
    lostReason: row.lostReason,
    nextFollowUpAt: row.nextFollowUpAt,
    lastContactedAt: row.lastContactedAt,
    convertedAt: row.convertedAt,
    customerId: row.customerId,
    convertedToCustomerAt: row.convertedToCustomerAt,
    createdBy: row.createdBy,
    createdByName: users.createdBy?.fullName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toDuplicateLeadDto(
  row: LeadWithRelations,
  canView = true,
): DuplicateLeadDto {
  return {
    id: row.lead.id,
    leadNumber: row.lead.leadNumber,
    name: row.lead.name,
    phone: row.lead.phone,
    email: row.lead.email,
    businessName: row.lead.businessName,
    pipelineStage: row.lead.pipelineStage,
    assignedToName: row.assignedUser?.fullName ?? null,
    createdAt: row.lead.createdAt,
    canView,
  };
}

export function toLeadActivityDto(row: LeadActivityWithUser): LeadActivityDto {
  return {
    id: row.activity.id,
    leadId: row.activity.leadId,
    userId: row.activity.userId,
    userName: row.user?.fullName ?? null,
    activityType: row.activity.activityType,
    title: row.activity.title,
    description: row.activity.description,
    previousStage: row.activity.previousStage,
    newStage: row.activity.newStage,
    createdAt: row.activity.createdAt,
  };
}

export function toLeadFollowUpDto(
  row: FollowUpWithRelations,
): LeadFollowUpDto {
  return {
    id: row.followUp.id,
    leadId: row.followUp.leadId,
    leadNumber: row.lead?.leadNumber ?? null,
    leadName: row.lead?.name ?? null,
    leadPhone: row.lead?.phone ?? null,
    assignedTo: row.followUp.assignedTo,
    assignedToName: row.assignedUser?.fullName ?? null,
    title: row.followUp.title,
    notes: row.followUp.notes,
    scheduledAt: row.followUp.scheduledAt,
    status: row.followUp.status,
    completedAt: row.followUp.completedAt,
    reminderEnabled: row.followUp.reminderEnabled,
    reminderMinutesBefore: row.followUp.reminderMinutesBefore,
    reminderStatus: row.followUp.reminderStatus as
      | "pending"
      | "sent"
      | "failed"
      | "skipped",
    reminderSentAt: row.followUp.reminderSentAt,
    reminderAttemptedAt: row.followUp.reminderAttemptedAt,
    reminderError: row.followUp.reminderError,
    createdBy: row.followUp.createdBy,
    createdByName: row.createdByUser?.fullName ?? null,
    createdAt: row.followUp.createdAt,
    updatedAt: row.followUp.updatedAt,
  };
}
