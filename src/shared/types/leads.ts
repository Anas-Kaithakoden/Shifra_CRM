import type {
  ActivityType,
  ContactStatus,
  FollowUpStatus,
  LeadPriority,
  LeadQuickFilter,
  LeadSource,
  ManualActivityType,
  PipelineStage,
} from "../constants/leads";
import type { Role } from "./roles";

export interface LeadUserSummary {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface LeadDto {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  email: string | null;
  businessName: string | null;
  location: string | null;
  serviceInterest: string | null;
  serviceCategory: string | null;
  source: LeadSource;
  pipelineStage: PipelineStage;
  contactStatus: ContactStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToUser: LeadUserSummary | null;
  estimatedValue: number | null;
  priority: LeadPriority;
  description: string | null;
  lostReason: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  convertedAt: string | null;
  customerId: string | null;
  convertedToCustomerAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LeadListItemDto extends LeadDto {
  pendingFollowUpCount: number;
}

export interface LeadActivityDto {
  id: string;
  leadId: string;
  userId: string | null;
  userName: string | null;
  activityType: ActivityType;
  title: string;
  description: string | null;
  previousStage: PipelineStage | null;
  newStage: PipelineStage | null;
  createdAt: string;
}

export interface LeadFollowUpDto {
  id: string;
  leadId: string;
  leadNumber: string | null;
  leadName: string | null;
  leadPhone: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  title: string;
  notes: string | null;
  scheduledAt: string;
  status: FollowUpStatus;
  completedAt: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminderStatus: "pending" | "sent" | "failed" | "skipped";
  reminderSentAt: string | null;
  reminderAttemptedAt: string | null;
  reminderError: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineColumnDto {
  stage: PipelineStage;
  count: number;
  leads: LeadListItemDto[];
}

export interface LeadPipelineDto {
  columns: PipelineColumnDto[];
  total: number;
  generatedAt: string;
}

export interface LeadStatusCounts {
  total: number;
  new: number;
  notContacted: number;
  attempted: number;
  contacted: number;
  qualified: number;
  proposalsSent: number;
  negotiation: number;
  won: number;
  lost: number;
  overdueFollowUps: number;
  dueTodayFollowUps: number;
}

export interface LeadSourceDistribution {
  source: LeadSource;
  count: number;
  won: number;
  estimatedValue: number;
}

export interface LeadPipelineOverviewRow {
  stage: PipelineStage;
  count: number;
  estimatedValue: number;
}

export interface LeadConversionDto {
  won: number;
  lost: number;
  open: number;
  conversionRate: number;
  wonValue: number;
}

export interface LeadDashboardStatsDto {
  scope: "organization" | "personal";
  counts: LeadStatusCounts;
  pipeline: LeadPipelineOverviewRow[];
  sources: LeadSourceDistribution[];
  conversion: LeadConversionDto;
  recentLeads: LeadDto[];
  followUps: {
    dueToday: LeadFollowUpDto[];
    overdue: LeadFollowUpDto[];
  };
  generatedAt: string;
}

export interface LeadListFilters {
  quickFilter?: LeadQuickFilter;
  scope?: "all" | "my";
}

export interface DuplicateLeadDto {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  email: string | null;
  businessName: string | null;
  pipelineStage: PipelineStage;
  assignedToName: string | null;
  createdAt: string;
  canView: boolean;
}

export interface ManualActivityInput {
  activityType: ManualActivityType;
  title: string;
  description?: string;
  contacted?: boolean;
  contactStatus?: ContactStatus;
  occurredAt?: string;
}
