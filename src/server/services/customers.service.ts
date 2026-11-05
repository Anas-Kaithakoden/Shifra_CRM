import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import {
  CUSTOMER_STATUS_LABELS,
  MANUAL_CUSTOMER_ACTIVITY_TYPE_LABELS,
  formatCustomerNumber,
  type CustomerActivityType,
} from "../../shared/constants/customers";
import { PIPELINE_STAGE_LABELS } from "../../shared/constants/leads";
import type { AuthUserDto } from "../../shared/types/api";
import type {
  ConvertLeadResultDto,
  CustomerActivityDto,
  CustomerContactDto,
  CustomerDashboardStatsDto,
  CustomerDetailDto,
  CustomerListItemDto,
  CustomerMonthlyGrowthRow,
  DuplicateCustomerDto,
  CustomerDuplicateMatch,
} from "../../shared/types/customers";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppDatabase } from "../db/client";
import {
  allocateCustomerNumber,
  claimLeadForCustomer,
  clearPrimaryContacts,
  countCustomerContacts,
  countCustomerLeads,
  deleteCustomerById,
  deleteCustomerContactById,
  findCustomerById,
  findCustomerContactById,
  findCustomerRowById,
  findDuplicateCustomers,
  getCustomerCounts,
  getCustomerMonthlyGrowth,
  insertCustomer,
  insertCustomerContact,
  listContactsForCustomers,
  listCustomerActivities,
  listCustomerContacts,
  listCustomerLeads,
  listCustomers,
  listRecentCustomerActivities,
  updateCustomerById,
  updateCustomerContactById,
  type CustomerWithRelations,
} from "../db/queries/customers.queries";
import {
  findLeadById,
  type LeadWithRelations,
} from "../db/queries/leads.queries";
import { findUserById } from "../db/queries/users.queries";
import type {
  CustomerContactRow,
  CustomerRow,
  NewCustomerContactRow,
  NewCustomerRow,
} from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { normalizeEmail, normalizePhone } from "../lib/phone";
import { getCrmDayBounds, nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";
import {
  canManageCustomer,
  canViewCustomer,
  toCustomerAccessScope,
} from "./customer-access";
import {
  recordCustomerActivity,
  recordCustomerAudit,
} from "./customer-activity.service";
import {
  toCustomerActivityDto,
  toCustomerActivityDtoFromRow,
  toCustomerContactDto,
  toCustomerDetailDto,
  toCustomerListItemDto,
  toDuplicateCustomerDto,
} from "./customer-mappers";
import { recordLeadActivity } from "./lead-activity.service";
import { canViewLead } from "./lead-access";
import type {
  ConvertLeadSchemaInput,
  CreateCustomerActivityInput,
  CreateCustomerContactInput,
  CreateCustomerInput,
  CreateCustomerNoteInput,
  DuplicateCustomerQuery,
  LinkCustomerLeadInput,
  ListCustomerActivitiesQuery,
  ListCustomersQuery,
  UpdateCustomerContactInput,
  UpdateCustomerInput,
} from "../schemas/customers.schema";

function normalizeBusinessName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalized.length >= 2 ? normalized : null;
}

function isUniqueCustomerNumberError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .toLowerCase()
    .includes("unique constraint failed: customers.customer_number");
}

async function resolveAssignee(
  db: AppDatabase,
  actor: AuthUserDto,
  requested: string | undefined,
): Promise<{ assignedTo: string | null; fullName: string | null }> {
  if (actor.role === "employee") {
    if (requested && requested !== actor.id) {
      throw forbidden("Employees cannot assign customers to other employees.");
    }
    return { assignedTo: actor.id, fullName: actor.fullName };
  }

  if (!requested) {
    return { assignedTo: null, fullName: null };
  }

  const target = await findUserById(db, requested);
  if (!target || !target.isActive) {
    throw badRequest(
      "invalid_assignee",
      "Choose an active team member for this customer.",
    );
  }
  return { assignedTo: target.id, fullName: target.fullName };
}

function matchedFields(
  row: CustomerWithRelations,
  options: {
    phoneNormalized?: string;
    emailNormalized?: string;
    businessNameNormalized?: string;
  },
): CustomerDuplicateMatch[] {
  const matches: CustomerDuplicateMatch[] = [];
  if (
    options.phoneNormalized &&
    row.customer.phoneNormalized === options.phoneNormalized
  ) {
    matches.push("phone");
  }
  if (
    options.emailNormalized &&
    row.customer.emailNormalized === options.emailNormalized
  ) {
    matches.push("email");
  }
  if (
    options.businessNameNormalized &&
    row.customer.businessNameNormalized === options.businessNameNormalized
  ) {
    matches.push("business_name");
  }
  return matches;
}

function duplicateDtos(
  rows: CustomerWithRelations[],
  actor: AuthUserDto,
  options: {
    phoneNormalized?: string;
    emailNormalized?: string;
    businessNameNormalized?: string;
  },
): DuplicateCustomerDto[] {
  return rows.map((row) =>
    toDuplicateCustomerDto(
      row,
      matchedFields(row, options),
      canViewCustomer(actor, row.customer),
    ),
  );
}

async function getCustomerRowForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
): Promise<CustomerWithRelations> {
  const row = await findCustomerById(db, id);
  if (!row) {
    throw notFound("Customer not found.");
  }
  if (!canViewCustomer(actor, row.customer)) {
    throw forbidden("You do not have access to this customer.");
  }
  return row;
}

function contactsByCustomer(
  contacts: CustomerContactRow[],
): Map<string, CustomerContactRow[]> {
  const map = new Map<string, CustomerContactRow[]>();
  for (const contact of contacts) {
    const list = map.get(contact.customerId) ?? [];
    list.push(contact);
    map.set(contact.customerId, list);
  }
  return map;
}

export async function listCustomersForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: ListCustomersQuery,
): Promise<{ items: CustomerListItemDto[]; total: number }> {
  const { rows, total } = await listCustomers(
    db,
    {
      search: query.search,
      status: query.status,
      type: query.type,
      assignedTo: query.assignedTo,
      scope: query.scope,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      includeArchived: query.includeArchived,
      page: query.page,
      pageSize: query.pageSize,
    },
    toCustomerAccessScope(actor),
  );

  const contacts = await listContactsForCustomers(
    db,
    rows.map((row) => row.customer.id),
  );
  const contactMap = contactsByCustomer(contacts);
  return {
    items: rows.map((row) =>
      toCustomerListItemDto(row, contactMap.get(row.customer.id) ?? []),
    ),
    total,
  };
}

export async function getCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
): Promise<CustomerDetailDto> {
  const row = await getCustomerRowForActor(db, actor, id);
  const [contacts, leads, stats] = await Promise.all([
    listCustomerContacts(db, id),
    listCustomerLeads(db, id),
    countCustomerLeads(db, id),
  ]);

  return toCustomerDetailDto({ row, contacts, leads, stats });
}

export async function checkDuplicateCustomersForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  query: DuplicateCustomerQuery,
): Promise<DuplicateCustomerDto[]> {
  const phone = query.phone ? normalizePhone(query.phone) : null;
  if (phone && !phone.valid) {
    throw badRequest("invalid_phone", "Enter a valid phone number.");
  }
  const email = query.email ? normalizeEmail(query.email) : null;
  const businessNameNormalized = normalizeBusinessName(query.businessName);

  if (!phone?.normalized && !email && !businessNameNormalized) {
    throw badRequest(
      "duplicate_check_required",
      "Provide a phone number, email address or business name to check.",
    );
  }

  const options = {
    phoneNormalized: phone?.normalized,
    emailNormalized: email ?? undefined,
    businessNameNormalized: businessNameNormalized ?? undefined,
    excludeId: query.excludeId,
  };
  const rows = await findDuplicateCustomers(db, options);
  return duplicateDtos(rows, actor, options);
}

export async function createCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  input: CreateCustomerInput,
  ipAddress: string | null,
): Promise<CustomerDetailDto> {
  const phone = normalizePhone(input.phone);
  if (!phone.valid) {
    throw badRequest("invalid_phone", "Enter a valid phone number.");
  }
  const email = input.email ? normalizeEmail(input.email) : null;
  const businessNameNormalized = normalizeBusinessName(input.businessName);

  const duplicateOptions = {
    phoneNormalized: phone.normalized,
    emailNormalized: email ?? undefined,
    businessNameNormalized: businessNameNormalized ?? undefined,
  };
  const duplicates = await findDuplicateCustomers(db, duplicateOptions);
  if (duplicates.length > 0 && !input.allowDuplicate) {
    throw conflict(
      "possible_duplicate",
      "A customer with this phone number, email address or business name may already exist. Review the existing record before creating another.",
      {
        duplicates: duplicateDtos(duplicates, actor, duplicateOptions),
        canOverride: true,
      },
    );
  }

  const assignee = await resolveAssignee(db, actor, input.assignedTo);
  const now = nowIso();
  let created: CustomerRow | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    const sequence = await allocateCustomerNumber(db, now);
    const values: NewCustomerRow = {
      id: newId(),
      customerNumber: formatCustomerNumber(sequence),
      type: input.type,
      name: input.name,
      businessName: input.businessName ?? null,
      businessNameNormalized,
      phone: phone.display,
      phoneNormalized: phone.normalized,
      email,
      emailNormalized: email,
      website: input.website ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
      notes: input.notes ?? null,
      status: input.status,
      statusBeforeArchive: null,
      archivedAt: null,
      assignedTo: assignee.assignedTo,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
    };

    try {
      created = await insertCustomer(db, values);
    } catch (error) {
      if (isUniqueCustomerNumberError(error) && attempt < 4) {
        continue;
      }
      throw error;
    }
  }

  if (!created) {
    throw new Error("Could not allocate a unique customer number.");
  }

  const primaryContact = await insertCustomerContact(db, {
    id: newId(),
    customerId: created.id,
    fullName: created.name,
    jobTitle: created.type === "business" ? "Primary contact" : null,
    phone: created.phone,
    phoneNormalized: created.phoneNormalized,
    email: created.email,
    emailNormalized: created.emailNormalized,
    isPrimary: true,
    notes: null,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await recordCustomerActivity(db, {
    customerId: created.id,
    userId: actor.id,
    activityType: "customer_created",
    title: "Customer created",
    description: `${created.customerNumber} added to the customer register.`,
    metadata: {
      customerNumber: created.customerNumber,
      source: "manual",
    },
    createdAt: now,
  });

  await recordCustomerActivity(db, {
    customerId: created.id,
    userId: actor.id,
    activityType: "contact_added",
    title: "Primary contact added",
    description: `${primaryContact.fullName} was added as the primary contact.`,
    contactId: primaryContact.id,
    metadata: { isPrimary: true },
    createdAt: now,
  });

  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_CREATED,
    customerId: created.id,
    ipAddress,
    metadata: {
      customerNumber: created.customerNumber,
      type: created.type,
      assignedTo: created.assignedTo,
    },
  });

  return getCustomerForActor(db, actor, created.id);
}

export async function updateCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  input: UpdateCustomerInput,
  ipAddress: string | null,
): Promise<CustomerDetailDto> {
  const existing = await findCustomerById(db, id);
  if (!existing) {
    throw notFound("Customer not found.");
  }
  if (!canManageCustomer(actor, existing.customer)) {
    throw forbidden("You can only edit customers assigned to you or created by you.");
  }
  if (existing.customer.status === "archived") {
    throw conflict(
      "customer_archived",
      "Restore this customer before making changes.",
    );
  }

  const now = nowIso();
  const updates: Partial<NewCustomerRow> = { updatedAt: now };
  const changedFields: string[] = [];
  const previous: Record<string, unknown> = {};
  const activities: Array<{
    activityType: CustomerActivityType;
    title: string;
    description: string | null;
    metadata?: Record<string, unknown>;
  }> = [];
  const audits: Array<{
    action: string;
    metadata: Record<string, unknown>;
  }> = [];

  if (input.type !== undefined && input.type !== existing.customer.type) {
    updates.type = input.type;
    previous.type = existing.customer.type;
    changedFields.push("type");
  }
  if (input.name !== undefined && input.name !== existing.customer.name) {
    updates.name = input.name;
    previous.name = existing.customer.name;
    changedFields.push("name");
  }

  const businessNameChanged =
    input.businessName !== undefined &&
    input.businessName !== existing.customer.businessName;
  if (businessNameChanged) {
    updates.businessName = input.businessName ?? null;
    updates.businessNameNormalized = normalizeBusinessName(input.businessName);
    previous.businessName = existing.customer.businessName;
    changedFields.push("businessName");
  }

  const phone = input.phone !== undefined ? normalizePhone(input.phone) : null;
  if (phone && !phone.valid) {
    throw badRequest("invalid_phone", "Enter a valid phone number.");
  }
  const phoneChanged =
    phone !== null &&
    (phone.normalized !== existing.customer.phoneNormalized ||
      phone.display !== existing.customer.phone);
  if (phoneChanged && phone) {
    updates.phone = phone.display;
    updates.phoneNormalized = phone.normalized;
    previous.phone = existing.customer.phone;
    changedFields.push("phone");
  }

  const emailChanged =
    input.email !== undefined && input.email !== existing.customer.email;
  if (emailChanged) {
    updates.email = input.email ?? null;
    updates.emailNormalized = input.email ?? null;
    previous.email = existing.customer.email;
    changedFields.push("email");
  }

  if (input.website !== undefined && input.website !== existing.customer.website) {
    updates.website = input.website ?? null;
    previous.website = existing.customer.website;
    changedFields.push("website");
  }

  const simpleFields = [
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "country",
    "notes",
  ] as const;
  for (const field of simpleFields) {
    const value = input[field];
    if (value !== undefined && value !== existing.customer[field]) {
      (updates as Record<string, unknown>)[field] = value ?? null;
      previous[field] = existing.customer[field];
      changedFields.push(field);
    }
  }

  const duplicateOptions = {
    phoneNormalized: phoneChanged ? phone?.normalized : undefined,
    emailNormalized: emailChanged && input.email ? input.email : undefined,
    businessNameNormalized:
      businessNameChanged && input.businessName
        ? normalizeBusinessName(input.businessName) ?? undefined
        : undefined,
    excludeId: id,
  };
  const hasDuplicateInput = Boolean(
    duplicateOptions.phoneNormalized ||
      duplicateOptions.emailNormalized ||
      duplicateOptions.businessNameNormalized,
  );
  if (hasDuplicateInput && !input.allowDuplicate) {
    const duplicates = await findDuplicateCustomers(db, duplicateOptions);
    if (duplicates.length > 0) {
      throw conflict(
        "possible_duplicate",
        "Another customer already uses this phone number, email address or business name.",
        {
          duplicates: duplicateDtos(duplicates, actor, duplicateOptions),
          canOverride: true,
        },
      );
    }
  }

  if (
    input.status !== undefined &&
    input.status !== existing.customer.status
  ) {
    updates.status = input.status;
    if (input.status === "active") {
      updates.archivedAt = null;
      updates.statusBeforeArchive = null;
    }
    previous.status = existing.customer.status;
    changedFields.push("status");
    activities.push({
      activityType: "status_changed",
      title: "Customer status changed",
      description: `From ${CUSTOMER_STATUS_LABELS[existing.customer.status]} to ${CUSTOMER_STATUS_LABELS[input.status]}.`,
    });
    audits.push({
      action: AUDIT_ACTIONS.CUSTOMER_STATUS_CHANGED,
      metadata: {
        customerNumber: existing.customer.customerNumber,
        from: existing.customer.status,
        to: input.status,
      },
    });
  }

  if (
    input.assignedTo !== undefined &&
    input.assignedTo !== existing.customer.assignedTo
  ) {
    if (!actor.permissions.includes(PERMISSIONS.CUSTOMERS_ASSIGN)) {
      throw forbidden("You cannot assign customers.");
    }
    const assignee = await resolveAssignee(db, actor, input.assignedTo ?? undefined);
    updates.assignedTo = assignee.assignedTo;
    previous.assignedTo = existing.customer.assignedTo;
    changedFields.push("assignedTo");
    activities.push({
      activityType: "assignment_changed",
      title: "Assignment changed",
      description: assignee.fullName
        ? `Customer assigned to ${assignee.fullName}.`
        : "Customer was unassigned.",
      metadata: {
        from: existing.customer.assignedTo,
        to: assignee.assignedTo,
      },
    });
    audits.push({
      action: AUDIT_ACTIONS.CUSTOMER_ASSIGNED,
      metadata: {
        customerNumber: existing.customer.customerNumber,
        from: existing.customer.assignedTo,
        to: assignee.assignedTo,
      },
    });
  }

  if (changedFields.length === 0) {
    return getCustomerForActor(db, actor, id);
  }

  const updated = await updateCustomerById(db, id, updates);
  if (!updated) {
    throw notFound("Customer not found.");
  }

  if (
    changedFields.some(
      (field) => field !== "status" && field !== "assignedTo",
    ) ||
    activities.length === 0
  ) {
    await recordCustomerActivity(db, {
      customerId: id,
      userId: actor.id,
      activityType: "customer_updated",
      title: "Customer details updated",
      description: `Updated ${changedFields.join(", ")}.`,
      metadata: { fields: changedFields, previous },
      createdAt: now,
    });
  }

  for (const activity of activities) {
    await recordCustomerActivity(db, {
      customerId: id,
      userId: actor.id,
      activityType: activity.activityType,
      title: activity.title,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: now,
    });
  }

  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
    customerId: id,
    ipAddress,
    metadata: {
      customerNumber: updated.customerNumber,
      fields: changedFields,
    },
  });
  for (const audit of audits) {
    await recordCustomerAudit(db, {
      actorId: actor.id,
      action: audit.action,
      customerId: id,
      ipAddress,
      metadata: audit.metadata,
    });
  }

  return getCustomerForActor(db, actor, id);
}

export async function archiveCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  ipAddress: string | null,
): Promise<CustomerDetailDto> {
  const existing = await getCustomerRowForActor(db, actor, id);
  if (existing.customer.status === "archived") {
    return getCustomerForActor(db, actor, id);
  }

  const now = nowIso();
  const updated = await updateCustomerById(db, id, {
    status: "archived",
    statusBeforeArchive: existing.customer.status,
    archivedAt: now,
    updatedAt: now,
  });
  if (!updated) {
    throw notFound("Customer not found.");
  }

  await recordCustomerActivity(db, {
    customerId: id,
    userId: actor.id,
    activityType: "customer_archived",
    title: "Customer archived",
    description:
      "Customer record archived. The record and its history are preserved.",
    metadata: { previousStatus: existing.customer.status },
    createdAt: now,
  });
  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_ARCHIVED,
    customerId: id,
    ipAddress,
    metadata: { customerNumber: updated.customerNumber },
  });

  return getCustomerForActor(db, actor, id);
}

export async function restoreCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  id: string,
  ipAddress: string | null,
): Promise<CustomerDetailDto> {
  const existing = await getCustomerRowForActor(db, actor, id);
  if (existing.customer.status !== "archived") {
    throw badRequest("customer_not_archived", "This customer is not archived.");
  }

  const restoredStatus =
    existing.customer.statusBeforeArchive === "inactive"
      ? "inactive"
      : "active";
  const now = nowIso();
  const updated = await updateCustomerById(db, id, {
    status: restoredStatus,
    statusBeforeArchive: null,
    archivedAt: null,
    updatedAt: now,
  });
  if (!updated) {
    throw notFound("Customer not found.");
  }

  await recordCustomerActivity(db, {
    customerId: id,
    userId: actor.id,
    activityType: "customer_restored",
    title: "Customer restored",
    description: `Customer restored as ${CUSTOMER_STATUS_LABELS[restoredStatus]}.`,
    metadata: { status: restoredStatus },
    createdAt: now,
  });
  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_RESTORED,
    customerId: id,
    ipAddress,
    metadata: { customerNumber: updated.customerNumber, status: restoredStatus },
  });

  return getCustomerForActor(db, actor, id);
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function addCustomerContactForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  input: CreateCustomerContactInput,
  ipAddress: string | null,
): Promise<CustomerContactDto> {
  const existing = await getCustomerRowForActor(db, actor, customerId);
  if (!canManageCustomer(actor, existing.customer)) {
    throw forbidden("You cannot add contacts to this customer.");
  }
  if (existing.customer.status === "archived") {
    throw conflict("customer_archived", "Restore this customer before editing contacts.");
  }

  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone && !phone.valid) {
    throw badRequest("invalid_phone", "Enter a valid phone number.");
  }
  const email = input.email ? normalizeEmail(input.email) : null;
  if (!phone?.normalized && !email) {
    throw badRequest(
      "contact_details_required",
      "Enter a phone number or email address for this contact.",
    );
  }

  const contactCount = await countCustomerContacts(db, customerId);
  const isPrimary = input.isPrimary || contactCount === 0;
  if (isPrimary) {
    await clearPrimaryContacts(db, customerId);
  }

  const now = nowIso();
  const contact = await insertCustomerContact(db, {
    id: newId(),
    customerId,
    fullName: input.fullName,
    jobTitle: input.jobTitle ?? null,
    phone: phone?.display ?? null,
    phoneNormalized: phone?.normalized ?? null,
    email,
    emailNormalized: email,
    isPrimary,
    notes: input.notes ?? null,
    createdBy: actor.id,
    createdAt: now,
    updatedAt: now,
  });

  await recordCustomerActivity(db, {
    customerId,
    userId: actor.id,
    activityType: "contact_added",
    title: "Contact added",
    description: `${contact.fullName} was added${isPrimary ? " as the primary contact" : ""}.`,
    contactId: contact.id,
    metadata: { isPrimary },
    createdAt: now,
  });
  if (isPrimary) {
    await recordCustomerActivity(db, {
      customerId,
      userId: actor.id,
      activityType: "primary_contact_changed",
      title: "Primary contact changed",
      description: `${contact.fullName} is now the primary contact.`,
      contactId: contact.id,
      createdAt: now,
    });
  }
  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_CONTACT_ADDED,
    customerId,
    ipAddress,
    metadata: { contactId: contact.id, isPrimary },
  });

  return toCustomerContactDto(contact);
}

export async function updateCustomerContactForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  contactId: string,
  input: UpdateCustomerContactInput,
  ipAddress: string | null,
): Promise<CustomerContactDto> {
  const existingCustomer = await getCustomerRowForActor(db, actor, customerId);
  if (!canManageCustomer(actor, existingCustomer.customer)) {
    throw forbidden("You cannot edit contacts for this customer.");
  }
  if (existingCustomer.customer.status === "archived") {
    throw conflict("customer_archived", "Restore this customer before editing contacts.");
  }

  const existing = await findCustomerContactById(db, customerId, contactId);
  if (!existing) {
    throw notFound("Contact not found.");
  }

  const updates: Partial<NewCustomerContactRow> = { updatedAt: nowIso() };
  const changedFields: string[] = [];
  const previous: Record<string, unknown> = {};

  if (input.fullName !== undefined && input.fullName !== existing.fullName) {
    updates.fullName = input.fullName;
    previous.fullName = existing.fullName;
    changedFields.push("fullName");
  }
  if (input.jobTitle !== undefined && input.jobTitle !== existing.jobTitle) {
    updates.jobTitle = input.jobTitle ?? null;
    previous.jobTitle = existing.jobTitle;
    changedFields.push("jobTitle");
  }

  let nextPhone = existing.phone;
  let nextPhoneNormalized = existing.phoneNormalized;
  if (input.phone !== undefined) {
    const phone = input.phone ? normalizePhone(input.phone) : null;
    if (phone && !phone.valid) {
      throw badRequest("invalid_phone", "Enter a valid phone number.");
    }
    nextPhone = phone?.display ?? null;
    nextPhoneNormalized = phone?.normalized ?? null;
    if (
      nextPhone !== existing.phone ||
      nextPhoneNormalized !== existing.phoneNormalized
    ) {
      updates.phone = nextPhone;
      updates.phoneNormalized = nextPhoneNormalized;
      previous.phone = existing.phone;
      changedFields.push("phone");
    }
  }

  let nextEmail = existing.email;
  if (input.email !== undefined) {
    nextEmail = input.email ? normalizeEmail(input.email) : null;
    if (nextEmail !== existing.email) {
      updates.email = nextEmail;
      updates.emailNormalized = nextEmail;
      previous.email = existing.email;
      changedFields.push("email");
    }
  }
  if (!nextPhoneNormalized && !nextEmail) {
    throw badRequest(
      "contact_details_required",
      "A contact must keep a phone number or email address.",
    );
  }

  if (input.notes !== undefined && input.notes !== existing.notes) {
    updates.notes = input.notes ?? null;
    previous.notes = existing.notes;
    changedFields.push("notes");
  }

  let promotedContactId: string | null = null;
  let primaryChanged = false;
  if (input.isPrimary !== undefined && input.isPrimary !== existing.isPrimary) {
    if (input.isPrimary) {
      await clearPrimaryContacts(db, customerId, contactId);
    }
    updates.isPrimary = input.isPrimary;
    changedFields.push("isPrimary");
    primaryChanged = true;
  }

  if (changedFields.length === 0) {
    return toCustomerContactDto(existing);
  }

  const updated = await updateCustomerContactById(
    db,
    customerId,
    contactId,
    updates,
  );
  if (!updated) {
    throw notFound("Contact not found.");
  }

  if (input.isPrimary === false && existing.isPrimary) {
    const contacts = await listCustomerContacts(db, customerId);
    const replacement = contacts.find((contact) => contact.id !== contactId);
    if (replacement) {
      await updateCustomerContactById(db, customerId, replacement.id, {
        isPrimary: true,
        updatedAt: nowIso(),
      });
      promotedContactId = replacement.id;
    }
  }

  const now = nowIso();
  await recordCustomerActivity(db, {
    customerId,
    userId: actor.id,
    activityType: "contact_updated",
    title: "Contact updated",
    description: `Updated ${updated.fullName}: ${changedFields.join(", ")}.`,
    contactId,
    metadata: { fields: changedFields, previous },
    createdAt: now,
  });
  if (primaryChanged || promotedContactId) {
    await recordCustomerActivity(db, {
      customerId,
      userId: actor.id,
      activityType: "primary_contact_changed",
      title: "Primary contact changed",
      description: promotedContactId
        ? "A new primary contact was selected."
        : `${updated.fullName} is now the primary contact.`,
      contactId: promotedContactId ?? contactId,
      metadata: { previousPrimaryContactId: existing.id },
      createdAt: now,
    });
  }
  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_CONTACT_UPDATED,
    customerId,
    ipAddress,
    metadata: { contactId, fields: changedFields },
  });

  return toCustomerContactDto(updated);
}

export async function removeCustomerContactForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  contactId: string,
  ipAddress: string | null,
): Promise<void> {
  const existingCustomer = await getCustomerRowForActor(db, actor, customerId);
  if (!canManageCustomer(actor, existingCustomer.customer)) {
    throw forbidden("You cannot remove contacts from this customer.");
  }
  if (existingCustomer.customer.status === "archived") {
    throw conflict("customer_archived", "Restore this customer before editing contacts.");
  }

  const existing = await findCustomerContactById(db, customerId, contactId);
  if (!existing) {
    throw notFound("Contact not found.");
  }

  await deleteCustomerContactById(db, customerId, contactId);

  if (existing.isPrimary) {
    const contacts = await listCustomerContacts(db, customerId);
    if (contacts[0]) {
      await updateCustomerContactById(db, customerId, contacts[0].id, {
        isPrimary: true,
        updatedAt: nowIso(),
      });
    }
  }

  const now = nowIso();
  await recordCustomerActivity(db, {
    customerId,
    userId: actor.id,
    activityType: "contact_removed",
    title: "Contact removed",
    description: `${existing.fullName} was removed from the customer.`,
    metadata: {
      contactId,
      fullName: existing.fullName,
      wasPrimary: existing.isPrimary,
    },
    createdAt: now,
  });
  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: AUDIT_ACTIONS.CUSTOMER_CONTACT_REMOVED,
    customerId,
    ipAddress,
    metadata: { contactId, fullName: existing.fullName },
  });
}

// ---------------------------------------------------------------------------
// Activity and notes
// ---------------------------------------------------------------------------

export async function listCustomerActivitiesForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  query: ListCustomerActivitiesQuery,
): Promise<{ items: CustomerActivityDto[]; total: number }> {
  await getCustomerRowForActor(db, actor, customerId);
  const { rows, total } = await listCustomerActivities(db, {
    customerId,
    activityType: query.activityType,
    page: query.page,
    pageSize: query.pageSize,
  });
  return { items: rows.map(toCustomerActivityDto), total };
}

export async function addCustomerActivityForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  input: CreateCustomerActivityInput,
  ipAddress: string | null,
): Promise<CustomerActivityDto> {
  const existing = await getCustomerRowForActor(db, actor, customerId);
  if (!canManageCustomer(actor, existing.customer)) {
    throw forbidden("You cannot add activity to this customer.");
  }
  if (existing.customer.status === "archived") {
    throw conflict("customer_archived", "Restore this customer before adding activity.");
  }

  let createdAt = nowIso();
  if (input.occurredAt) {
    const parsed = new Date(input.occurredAt);
    if (Number.isNaN(parsed.getTime())) {
      throw badRequest("invalid_occurred_at", "Enter a valid activity time.");
    }
    if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
      throw badRequest(
        "invalid_occurred_at",
        "Activity time cannot be in the future.",
      );
    }
    createdAt = parsed.toISOString();
  }

  const activityType: CustomerActivityType =
    input.activityType === "note" ? "note_added" : input.activityType;
  const label =
    input.activityType === "note"
      ? "Note added"
      : `${MANUAL_CUSTOMER_ACTIVITY_TYPE_LABELS[input.activityType]} logged`;
  const activity = await recordCustomerActivity(db, {
    customerId,
    userId: actor.id,
    activityType,
    title: input.title,
    description: input.description ?? null,
    metadata: { interactionType: input.activityType, occurredAt: createdAt },
    createdAt,
  });

  await recordCustomerAudit(db, {
    actorId: actor.id,
    action:
      activityType === "note_added"
        ? AUDIT_ACTIONS.CUSTOMER_NOTE_ADDED
        : AUDIT_ACTIONS.CUSTOMER_ACTIVITY_LOGGED,
    customerId,
    ipAddress,
    metadata: { activityId: activity.id, type: activityType, label },
  });

  return toCustomerActivityDtoFromRow(activity, actor.fullName);
}

export async function addCustomerNoteForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  input: CreateCustomerNoteInput,
  ipAddress: string | null,
): Promise<CustomerActivityDto> {
  return addCustomerActivityForActor(
    db,
    actor,
    customerId,
    {
      activityType: "note",
      title: "Note added",
      description: input.note,
    },
    ipAddress,
  );
}

// ---------------------------------------------------------------------------
// Leads and conversion
// ---------------------------------------------------------------------------

function convertedLeadActivityTitle(lead: LeadWithRelations["lead"]): string {
  return `Won lead ${lead.leadNumber} converted to a customer`;
}

async function recordLeadLinkedToCustomer(
  db: AppDatabase,
  actor: AuthUserDto,
  customer: CustomerRow,
  lead: LeadWithRelations["lead"],
  converted: boolean,
  ipAddress: string | null,
) {
  const now = nowIso();
  await recordCustomerActivity(db, {
    customerId: customer.id,
    userId: actor.id,
    activityType: converted ? "lead_converted" : "lead_linked",
    title: converted ? "Lead converted to customer" : "Lead linked to customer",
    description: converted
      ? convertedLeadActivityTitle(lead)
      : `${lead.name} (${lead.leadNumber}) was linked to this customer.`,
    leadId: lead.id,
    metadata: {
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      pipelineStage: lead.pipelineStage,
      estimatedValue: lead.estimatedValue,
    },
    createdAt: now,
  });

  await recordLeadActivity(db, {
    leadId: lead.id,
    userId: actor.id,
    activityType: "note",
    title: converted ? "Converted to customer" : "Linked to customer",
    description: `${customer.customerNumber} — ${customer.businessName ?? customer.name}.`,
    createdAt: now,
  });

  await recordCustomerAudit(db, {
    actorId: actor.id,
    action: converted
      ? AUDIT_ACTIONS.CUSTOMER_LEAD_CONVERTED
      : AUDIT_ACTIONS.CUSTOMER_LEAD_LINKED,
    customerId: customer.id,
    ipAddress,
    metadata: {
      customerNumber: customer.customerNumber,
      leadId: lead.id,
      leadNumber: lead.leadNumber,
    },
  });
  await recordAudit(db, {
    userId: actor.id,
    action: converted
      ? AUDIT_ACTIONS.CUSTOMER_LEAD_CONVERTED
      : AUDIT_ACTIONS.CUSTOMER_LEAD_LINKED,
    entityType: "lead",
    entityId: lead.id,
    metadata: {
      leadNumber: lead.leadNumber,
      customerId: customer.id,
      customerNumber: customer.customerNumber,
    },
    ipAddress,
  });
}

export async function linkLeadToCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
  input: LinkCustomerLeadInput,
  ipAddress: string | null,
): Promise<{ customer: CustomerDetailDto; alreadyLinked: boolean }> {
  const customerRow = await getCustomerRowForActor(db, actor, customerId);
  if (!canManageCustomer(actor, customerRow.customer)) {
    throw forbidden("You do not have access to link leads to this customer.");
  }
  if (customerRow.customer.status === "archived") {
    throw conflict(
      "customer_archived",
      "Restore this customer before linking leads.",
    );
  }

  const leadRow = await findLeadById(db, input.leadId);
  if (!leadRow || leadRow.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canViewLead(actor, leadRow.lead)) {
    throw forbidden("You do not have access to this lead.");
  }

  if (leadRow.lead.customerId === customerId) {
    return {
      customer: await getCustomerForActor(db, actor, customerId),
      alreadyLinked: true,
    };
  }
  if (leadRow.lead.customerId) {
    throw conflict(
      "lead_already_linked",
      "This lead is already linked to another customer.",
      { customerId: leadRow.lead.customerId },
    );
  }

  const converted = leadRow.lead.pipelineStage === "won";
  const now = nowIso();
  const claimed = await claimLeadForCustomer(db, {
    leadId: leadRow.lead.id,
    customerId,
    now,
    markConverted: converted,
  });

  if (!claimed) {
    const refreshed = await findLeadById(db, leadRow.lead.id);
    if (refreshed?.lead.customerId === customerId) {
      return {
        customer: await getCustomerForActor(db, actor, customerId),
        alreadyLinked: true,
      };
    }
    if (refreshed?.lead.customerId) {
      throw conflict(
        "lead_already_linked",
        "This lead was linked to another customer.",
        { customerId: refreshed.lead.customerId },
      );
    }
    throw conflict(
      "lead_link_failed",
      "The lead could not be linked. Refresh and try again.",
    );
  }

  await recordLeadLinkedToCustomer(
    db,
    actor,
    customerRow.customer,
    leadRow.lead,
    converted,
    ipAddress,
  );

  return {
    customer: await getCustomerForActor(db, actor, customerId),
    alreadyLinked: false,
  };
}

async function getLinkedCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  customerId: string,
): Promise<CustomerDetailDto> {
  const row = await findCustomerById(db, customerId);
  if (!row) {
    throw notFound("Customer not found.");
  }
  if (!canViewCustomer(actor, row.customer)) {
    throw forbidden("You do not have access to the customer linked to this lead.");
  }
  return getCustomerForActor(db, actor, customerId);
}

export async function convertLeadToCustomerForActor(
  db: AppDatabase,
  actor: AuthUserDto,
  leadId: string,
  input: ConvertLeadSchemaInput,
  ipAddress: string | null,
): Promise<ConvertLeadResultDto> {
  const leadRow = await findLeadById(db, leadId);
  if (!leadRow || leadRow.lead.deletedAt) {
    throw notFound("Lead not found.");
  }
  if (!canViewLead(actor, leadRow.lead)) {
    throw forbidden("You do not have access to this lead.");
  }

  if (leadRow.lead.customerId) {
    return {
      customer: await getLinkedCustomerForActor(
        db,
        actor,
        leadRow.lead.customerId,
      ),
      leadId: leadRow.lead.id,
      alreadyLinked: true,
    };
  }

  if (leadRow.lead.pipelineStage !== "won") {
    throw conflict(
      "lead_not_eligible",
      `Only won leads can be converted. This lead is at ${PIPELINE_STAGE_LABELS[leadRow.lead.pipelineStage]}.`,
    );
  }

  if (input.mode === "link") {
    const customerId = input.customerId;
    if (!customerId) {
      throw badRequest("customer_required", "Choose an existing customer to link.");
    }
    const customerRow = await getCustomerRowForActor(db, actor, customerId);
    if (!canManageCustomer(actor, customerRow.customer)) {
      throw forbidden("You do not have access to link this lead.");
    }
    if (customerRow.customer.status === "archived") {
      throw conflict(
        "customer_archived",
        "Restore this customer before converting the lead.",
      );
    }

    const now = nowIso();
    const claimed = await claimLeadForCustomer(db, {
      leadId: leadRow.lead.id,
      customerId,
      now,
      markConverted: true,
    });
    if (!claimed) {
      const refreshed = await findLeadById(db, leadRow.lead.id);
      if (refreshed?.lead.customerId) {
        return {
          customer: await getLinkedCustomerForActor(
            db,
            actor,
            refreshed.lead.customerId,
          ),
          leadId: leadRow.lead.id,
          alreadyLinked: true,
        };
      }
      throw conflict(
        "lead_link_failed",
        "The lead could not be linked. Refresh and try again.",
      );
    }

    await recordLeadLinkedToCustomer(
      db,
      actor,
      customerRow.customer,
      leadRow.lead,
      true,
      ipAddress,
    );
    return {
      customer: await getCustomerForActor(db, actor, customerId),
      leadId: leadRow.lead.id,
      alreadyLinked: false,
    };
  }

  if (!actor.permissions.includes(PERMISSIONS.CUSTOMERS_CREATE)) {
    throw forbidden("You cannot create customers.");
  }
  if (input.confirmCreate !== true) {
    throw badRequest(
      "confirmation_required",
      "Confirm the new customer details before converting this lead.",
    );
  }

  const requested = input.customer;
  const type =
    requested?.type ?? (leadRow.lead.businessName ? "business" : "individual");
  const name = requested?.name?.trim() || leadRow.lead.name;
  const phone = requested?.phone ?? leadRow.lead.phone;
  const email = requested?.email ?? leadRow.lead.email ?? undefined;
  const assignedTo =
    actor.role === "employee"
      ? actor.id
      : requested?.assignedTo ?? leadRow.lead.assignedTo ?? undefined;

  const createInput: CreateCustomerInput = {
    type,
    name,
    businessName: requested?.businessName ?? leadRow.lead.businessName ?? undefined,
    phone,
    email,
    website: requested?.website,
    industry: requested?.industry,
    addressLine1: requested?.addressLine1,
    addressLine2: requested?.addressLine2,
    city: requested?.city,
    district: requested?.district,
    state: requested?.state,
    postalCode: requested?.postalCode,
    country: requested?.country,
    gstin: requested?.gstin,
    notes: requested?.notes,
    source: requested?.source,
    status: "active",
    assignedTo,
    allowDuplicate: input.allowDuplicate,
  };

  const created = await createCustomerForActor(
    db,
    actor,
    createInput,
    ipAddress,
  );

  const now = nowIso();
  const claimed = await claimLeadForCustomer(db, {
    leadId: leadRow.lead.id,
    customerId: created.id,
    now,
    markConverted: true,
  });

  if (!claimed) {
    const refreshed = await findLeadById(db, leadRow.lead.id);
    if (refreshed?.lead.customerId === created.id) {
      return { customer: created, leadId: leadRow.lead.id, alreadyLinked: true };
    }
    if (refreshed?.lead.customerId) {
      await deleteCustomerById(db, created.id);
      return {
        customer: await getLinkedCustomerForActor(
          db,
          actor,
          refreshed.lead.customerId,
        ),
        leadId: leadRow.lead.id,
        alreadyLinked: true,
      };
    }
    await deleteCustomerById(db, created.id);
    throw conflict(
      "lead_link_failed",
      "The lead could not be linked. Refresh and try again.",
    );
  }

  const createdRow = await findCustomerRowById(db, created.id);
  if (!createdRow) {
    throw notFound("Customer not found.");
  }
  await recordLeadLinkedToCustomer(
    db,
    actor,
    createdRow,
    leadRow.lead,
    true,
    ipAddress,
  );

  return {
    customer: await getCustomerForActor(db, actor, created.id),
    leadId: leadRow.lead.id,
    alreadyLinked: false,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function dashboardMonths(now = new Date()) {
  const todayKey = getCrmDayBounds(now).dateKey;
  const [year, month] = todayKey.split("-").map((value) => Number(value));
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: MONTH_FORMATTER.format(date) };
  });
}

export async function getCustomerDashboardStatsForActor(
  db: AppDatabase,
  actor: AuthUserDto,
): Promise<CustomerDashboardStatsDto> {
  const access = toCustomerAccessScope(actor);
  const months = dashboardMonths();
  const currentMonth = months[months.length - 1]!;
  const startIso = new Date(
    `${months[0]!.key}-01T00:00:00.000+05:30`,
  ).toISOString();
  const monthStartIso = new Date(
    `${currentMonth.key}-01T00:00:00.000+05:30`,
  ).toISOString();
  const now = nowIso();

  const [counts, growth, recent, recentActivity] = await Promise.all([
    getCustomerCounts(db, access, monthStartIso),
    getCustomerMonthlyGrowth(db, access, startIso),
    listCustomers(
      db,
      {
        page: 1,
        pageSize: 5,
        sortBy: "created_at",
        sortDir: "desc",
        includeArchived: false,
      },
      access,
    ),
    listRecentCustomerActivities(db, access, 8),
  ]);

  const contacts = await listContactsForCustomers(
    db,
    recent.rows.map((row) => row.customer.id),
  );
  const contactMap = contactsByCustomer(contacts);
  const growthMap = new Map(growth.map((row) => [row.month, row.count]));
  const monthlyGrowth: CustomerMonthlyGrowthRow[] = months.map((month) => ({
    month: month.key,
    label: month.label,
    count: growthMap.get(month.key) ?? 0,
  }));

  return {
    scope: actor.role === "employee" ? "personal" : "organization",
    counts: {
      total: counts.active + counts.inactive,
      active: counts.active,
      inactive: counts.inactive,
      archived: counts.archived,
      newThisMonth: counts.newThisMonth,
      business: counts.business,
      individual: counts.individual,
    },
    monthlyGrowth,
    recentCustomers: recent.rows.map((row) =>
      toCustomerListItemDto(row, contactMap.get(row.customer.id) ?? []),
    ),
    recentActivity: recentActivity.map(toCustomerActivityDto),
    generatedAt: now,
  };
}


