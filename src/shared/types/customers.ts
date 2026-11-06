import type {
  CustomerActivityType,
  CustomerStatus,
  CustomerType,
  ManualCustomerActivityType,
} from "../constants/customers";
import type { PipelineStage } from "../constants/leads";
import type { Role } from "./roles";

export interface CustomerUserSummary {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface CustomerContactDto {
  id: string;
  customerId: string;
  fullName: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDto {
  id: string;
  customerNumber: string;
  type: CustomerType;
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  website: string | null;
  industry: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  gstin: string | null;
  notes: string | null;
  source: string | null;
  totalCost: number | null;
  profit: number | null;
  serviceDeliveredOn: string | null;
  renewalOn: string | null;
  status: CustomerStatus;
  archivedAt: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToUser: CustomerUserSummary | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByUser: CustomerUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListItemDto extends CustomerDto {
  primaryContact: CustomerContactDto | null;
  contactCount: number;
  enquiryCount: number;
  wonCount: number;
  lastActivityAt: string | null;
}

export interface CustomerLeadDto {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  email: string | null;
  businessName: string | null;
  serviceInterest: string | null;
  source: string | null;
  pipelineStage: PipelineStage;
  lostReason: string | null;
  estimatedValue: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  convertedAt: string | null;
  convertedToCustomerAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CustomerActivityDto {
  id: string;
  customerId: string;
  userId: string | null;
  userName: string | null;
  activityType: CustomerActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  leadId: string | null;
  contactId: string | null;
  createdAt: string;
}

export interface CustomerSummaryCounts {
  leadCount: number;
  wonLeadCount: number;
  openLeadCount: number;
  contactCount: number;
}

export interface CustomerDetailDto extends CustomerDto {
  contacts: CustomerContactDto[];
  primaryContact: CustomerContactDto | null;
  leads: CustomerLeadDto[];
  stats: CustomerSummaryCounts;
  lastActivityAt: string | null;
}

export type CustomerDuplicateMatch = "phone" | "email" | "business_name";

export interface DuplicateCustomerDto {
  id: string;
  customerNumber: string;
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  type: CustomerType;
  status: CustomerStatus;
  assignedToName: string | null;
  createdAt: string;
  canView: boolean;
  matchedOn: CustomerDuplicateMatch[];
}

export interface CustomerDashboardCounts {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  newThisMonth: number;
  business: number;
  individual: number;
}

export interface CustomerMonthlyGrowthRow {
  month: string;
  label: string;
  count: number;
}

export interface CustomerDashboardStatsDto {
  scope: "organization" | "personal";
  counts: CustomerDashboardCounts;
  monthlyGrowth: CustomerMonthlyGrowthRow[];
  recentCustomers: CustomerListItemDto[];
  recentActivity: CustomerActivityDto[];
  generatedAt: string;
}

export interface CustomerManualActivityInput {
  activityType: ManualCustomerActivityType;
  title: string;
  description?: string;
  occurredAt?: string;
}

export interface CustomerNoteInput {
  note: string;
}

export interface CustomerLeadLinkInput {
  leadId: string;
}

export interface ConvertLeadCustomerInput {
  type?: CustomerType;
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  gstin?: string;
  notes?: string;
  source?: string;
  totalCost?: number;
  profit?: number;
  serviceDeliveredOn?: string;
  renewalOn?: string;
  assignedTo?: string;
}

export interface ConvertLeadInput {
  /**
   * "link" attaches the won lead to an existing customer. "create" requires an
   * explicit confirmation so the server never creates a customer implicitly.
   */
  mode: "link" | "create";
  customerId?: string;
  confirmCreate?: boolean;
  allowDuplicate?: boolean;
  customer?: ConvertLeadCustomerInput;
}

export interface ConvertLeadResultDto {
  customer: CustomerDetailDto;
  leadId: string;
  alreadyLinked: boolean;
}
