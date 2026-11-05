/**
 * Shared lead domain vocabulary.
 *
 * These values are persisted in D1, so changing a stored value requires a data
 * migration. Labels can change freely.
 */

export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const OPEN_PIPELINE_STAGES: readonly PipelineStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
];

export const CLOSED_PIPELINE_STAGES: readonly PipelineStage[] = ["won", "lost"];

export const CONTACT_STATUSES = [
  "not_contacted",
  "attempted",
  "contacted",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not Contacted",
  attempted: "Attempted",
  contacted: "Contacted",
};

export const LEAD_PRIORITIES = ["low", "medium", "high"] as const;

export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const LEAD_SOURCES = [
  "Facebook Ads",
  "Instagram Ads",
  "WhatsApp",
  "Website",
  "Phone Call",
  "Referral",
  "Walk-in",
  "Other",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const ACTIVITY_TYPES = [
  "lead_created",
  "call",
  "whatsapp",
  "email",
  "meeting",
  "note",
  "stage_changed",
  "assignment_changed",
  "contact_status_changed",
  "follow_up_scheduled",
  "follow_up_rescheduled",
  "follow_up_completed",
  "follow_up_cancelled",
  "lead_won",
  "lead_lost",
  "lead_reopened",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Activity types an employee can log manually from the UI. */
export const MANUAL_ACTIVITY_TYPES = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "note",
] as const;

export type ManualActivityType = (typeof MANUAL_ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  lead_created: "Lead Created",
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  stage_changed: "Stage Changed",
  assignment_changed: "Assignment Changed",
  contact_status_changed: "Contact Status Changed",
  follow_up_scheduled: "Follow-up Scheduled",
  follow_up_rescheduled: "Follow-up Rescheduled",
  follow_up_completed: "Follow-up Completed",
  follow_up_cancelled: "Follow-up Cancelled",
  lead_won: "Lead Won",
  lead_lost: "Lead Lost",
  lead_reopened: "Lead Reopened",
};

export const FOLLOW_UP_STATUSES = ["pending", "completed", "cancelled"] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const LEAD_QUICK_FILTERS = [
  "all",
  "new",
  "not_contacted",
  "contacted",
  "follow_up_due",
  "overdue",
  "my_leads",
  "won",
  "lost",
] as const;

export type LeadQuickFilter = (typeof LEAD_QUICK_FILTERS)[number];

export const LEAD_QUICK_FILTER_LABELS: Record<LeadQuickFilter, string> = {
  all: "All Leads",
  new: "New Leads",
  not_contacted: "Not Contacted",
  contacted: "Contacted",
  follow_up_due: "Follow-up Due",
  overdue: "Overdue",
  my_leads: "My Leads",
  won: "Won",
  lost: "Lost",
};

export const CRM_TIMEZONE = "Asia/Kolkata";
export const CRM_CURRENCY = "INR";

export function isPipelineStage(value: unknown): value is PipelineStage {
  return (
    typeof value === "string" &&
    (PIPELINE_STAGES as readonly string[]).includes(value)
  );
}

export function isContactStatus(value: unknown): value is ContactStatus {
  return (
    typeof value === "string" &&
    (CONTACT_STATUSES as readonly string[]).includes(value)
  );
}

export function isLeadPriority(value: unknown): value is LeadPriority {
  return (
    typeof value === "string" &&
    (LEAD_PRIORITIES as readonly string[]).includes(value)
  );
}

export function isManualActivityType(
  value: unknown,
): value is ManualActivityType {
  return (
    typeof value === "string" &&
    (MANUAL_ACTIVITY_TYPES as readonly string[]).includes(value)
  );
}

export function isFollowUpStatus(value: unknown): value is FollowUpStatus {
  return (
    typeof value === "string" &&
    (FOLLOW_UP_STATUSES as readonly string[]).includes(value)
  );
}
