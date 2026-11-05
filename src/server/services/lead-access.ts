import type { AuthUserDto } from "../../shared/types/api";
import type { LeadRow } from "../db/schema";
import type { LeadAccessScope } from "../db/queries/leads.queries";

export function toLeadAccessScope(actor: AuthUserDto): LeadAccessScope {
  return { userId: actor.id, role: actor.role };
}

/** Owner and admin see every lead; employees see their own records. */
export function canViewLead(actor: AuthUserDto, lead: LeadRow): boolean {
  if (actor.role === "owner" || actor.role === "admin") {
    return true;
  }
  return lead.assignedTo === actor.id || lead.createdBy === actor.id;
}

/** Employees may edit only leads assigned to them. */
export function canManageLead(actor: AuthUserDto, lead: LeadRow): boolean {
  if (actor.role === "owner" || actor.role === "admin") {
    return true;
  }
  return lead.assignedTo === actor.id;
}

/** Lead follow-ups follow the same ownership boundary as the lead. */
export function canManageLeadFollowUp(
  actor: AuthUserDto,
  options: { assignedTo: string | null; leadAssignedTo: string | null },
): boolean {
  if (actor.role === "owner" || actor.role === "admin") {
    return true;
  }
  return options.assignedTo === actor.id || options.leadAssignedTo === actor.id;
}
