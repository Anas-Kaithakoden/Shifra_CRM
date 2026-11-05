import type { Role } from "../../shared/types/roles";
import type {
  CustomerActivityDto,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerDto,
  CustomerLeadDto,
  CustomerListItemDto,
  CustomerUserSummary,
  DuplicateCustomerDto,
  CustomerDuplicateMatch,
} from "../../shared/types/customers";
import type {
  CustomerActivityWithUser,
  CustomerLeadWithUser,
  CustomerWithRelations,
} from "../db/queries/customers.queries";
import type {
  CustomerContactRow,
  CustomerActivityRow,
} from "../db/schema";

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
): CustomerUserSummary | null {
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

export function toCustomerDto(row: CustomerWithRelations): CustomerDto {
  const { customer } = row;
  const assigned = toUserSummary(row.assignedUser);
  const createdBy = toUserSummary(row.createdByUser);

  return {
    id: customer.id,
    customerNumber: customer.customerNumber,
    type: customer.type,
    name: customer.name,
    businessName: customer.businessName,
    phone: customer.phone,
    email: customer.email,
    website: customer.website,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    state: customer.state,
    postalCode: customer.postalCode,
    country: customer.country,
    notes: customer.notes,
    status: customer.status,
    archivedAt: customer.archivedAt,
    assignedTo: customer.assignedTo,
    assignedToName: assigned?.fullName ?? null,
    assignedToUser: assigned,
    createdBy: customer.createdBy,
    createdByName: createdBy?.fullName ?? null,
    createdByUser: createdBy,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export function toCustomerContactDto(
  contact: CustomerContactRow,
): CustomerContactDto {
  return {
    id: contact.id,
    customerId: contact.customerId,
    fullName: contact.fullName,
    jobTitle: contact.jobTitle,
    phone: contact.phone,
    email: contact.email,
    isPrimary: contact.isPrimary,
    notes: contact.notes,
    createdBy: contact.createdBy,
    createdByName: null,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

export function toCustomerListItemDto(
  row: CustomerWithRelations,
  contacts: CustomerContactRow[],
): CustomerListItemDto {
  const primary = contacts.find((contact) => contact.isPrimary) ?? null;
  return {
    ...toCustomerDto(row),
    primaryContact: primary ? toCustomerContactDto(primary) : null,
    contactCount: Number(row.contactCount ?? 0),
    enquiryCount: Number(row.enquiryCount ?? 0),
    wonCount: Number(row.wonCount ?? 0),
    lastActivityAt: row.lastActivityAt,
  };
}

export function toCustomerLeadDto(row: CustomerLeadWithUser): CustomerLeadDto {
  const assigned = toUserSummary(row.assignedUser);
  return {
    id: row.lead.id,
    leadNumber: row.lead.leadNumber,
    name: row.lead.name,
    phone: row.lead.phone,
    email: row.lead.email,
    businessName: row.lead.businessName,
    serviceInterest: row.lead.serviceInterest,
    pipelineStage: row.lead.pipelineStage,
    estimatedValue: row.lead.estimatedValue,
    assignedTo: row.lead.assignedTo,
    assignedToName: assigned?.fullName ?? null,
    convertedAt: row.lead.convertedAt,
    convertedToCustomerAt: row.lead.convertedToCustomerAt,
    createdAt: row.lead.createdAt,
    updatedAt: row.lead.updatedAt,
    deletedAt: row.lead.deletedAt,
  };
}

export function toCustomerDetailDto(options: {
  row: CustomerWithRelations;
  contacts: CustomerContactRow[];
  leads: CustomerLeadWithUser[];
  stats: { leadCount: number; wonLeadCount: number; openLeadCount: number };
}): CustomerDetailDto {
  const contacts = options.contacts.map(toCustomerContactDto);
  return {
    ...toCustomerDto(options.row),
    contacts,
    primaryContact:
      contacts.find((contact) => contact.isPrimary) ?? null,
    leads: options.leads.map(toCustomerLeadDto),
    stats: {
      ...options.stats,
      contactCount: contacts.length,
    },
    lastActivityAt: options.row.lastActivityAt,
  };
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function toCustomerActivityDto(
  row: CustomerActivityWithUser,
): CustomerActivityDto {
  return {
    id: row.activity.id,
    customerId: row.activity.customerId,
    userId: row.activity.userId,
    userName: row.user?.fullName ?? null,
    activityType: row.activity.activityType,
    title: row.activity.title,
    description: row.activity.description,
    metadata: parseMetadata(row.activity.metadata),
    leadId: row.activity.leadId,
    contactId: row.activity.contactId,
    createdAt: row.activity.createdAt,
  };
}

export function toCustomerActivityDtoFromRow(
  activity: CustomerActivityRow,
  userName: string | null,
): CustomerActivityDto {
  return {
    id: activity.id,
    customerId: activity.customerId,
    userId: activity.userId,
    userName,
    activityType: activity.activityType,
    title: activity.title,
    description: activity.description,
    metadata: parseMetadata(activity.metadata),
    leadId: activity.leadId,
    contactId: activity.contactId,
    createdAt: activity.createdAt,
  };
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "••••";
}

export function toDuplicateCustomerDto(
  row: CustomerWithRelations,
  matchedOn: CustomerDuplicateMatch[],
  canView: boolean,
): DuplicateCustomerDto {
  if (!canView) {
    return {
      id: row.customer.id,
      customerNumber: row.customer.customerNumber,
      name: "Restricted customer",
      businessName: null,
      phone: maskPhone(row.customer.phone),
      email: null,
      type: row.customer.type,
      status: row.customer.status,
      assignedToName: null,
      createdAt: row.customer.createdAt,
      canView: false,
      matchedOn,
    };
  }

  return {
    id: row.customer.id,
    customerNumber: row.customer.customerNumber,
    name: row.customer.name,
    businessName: row.customer.businessName,
    phone: row.customer.phone,
    email: row.customer.email,
    type: row.customer.type,
    status: row.customer.status,
    assignedToName: row.assignedUser?.fullName ?? null,
    createdAt: row.customer.createdAt,
    canView,
    matchedOn,
  };
}
