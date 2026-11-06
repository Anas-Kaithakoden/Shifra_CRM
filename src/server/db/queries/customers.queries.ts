import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  CUSTOMER_NUMBER_SEQUENCE_KEY,
  type CustomerActivityType,
  type CustomerSortField,
  type CustomerStatus,
  type CustomerType,
} from "../../../shared/constants/customers";
import type { PipelineStage } from "../../../shared/constants/leads";
import { digitsOnly } from "../../lib/phone";
import type { AppDatabase } from "../client";
import {
  customerActivities,
  customerContacts,
  customerNumberSequence,
  customers,
  leads,
  users,
  type CustomerActivityRow,
  type CustomerContactRow,
  type CustomerRow,
  type NewCustomerActivityRow,
  type NewCustomerContactRow,
  type NewCustomerRow,
} from "../schema";

const assignedUser = alias(users, "customer_assigned_user");
const createdByUser = alias(users, "customer_created_by_user");
const leadAssignedUser = alias(users, "customer_lead_assigned_user");

export interface CustomerAccessScope {
  userId: string;
  role: string;
}

export interface CustomerUserRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface CustomerWithRelations {
  customer: CustomerRow;
  assignedUser: CustomerUserRow | null;
  createdByUser: CustomerUserRow | null;
  contactCount: number;
  enquiryCount: number;
  wonCount: number;
  lastActivityAt: string | null;
}

export interface ListCustomersFilters {
  search?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  assignedTo?: string;
  city?: string;
  state?: string;
  scope?: "all" | "my";
  recentlyAdded?: boolean;
  sortBy?: CustomerSortField;
  sortDir?: "asc" | "desc";
  includeArchived?: boolean;
  page: number;
  pageSize: number;
}

export interface CustomerActivityWithUser {
  activity: CustomerActivityRow;
  user: CustomerUserRow | null;
}

export interface CustomerLeadWithUser {
  lead: {
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
    convertedAt: string | null;
    convertedToCustomerAt: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
  assignedUser: CustomerUserRow | null;
}

export interface CustomerCountsRow {
  active: number;
  inactive: number;
  archived: number;
  business: number;
  individual: number;
  newThisMonth: number;
}

export function customerScopeConditions(access: CustomerAccessScope): SQL[] {
  if (access.role === "employee") {
    return [
      or(
        eq(customers.assignedTo, access.userId),
        eq(customers.createdBy, access.userId),
      )!,
    ];
  }
  return [];
}

function searchCondition(search: string) {
  const pattern = `%${search.toLowerCase()}%`;
  const digits = digitsOnly(search);
  const phonePattern = digits ? `%${digits}%` : null;

  return or(
    sql`lower(${customers.name}) like ${pattern}`,
    sql`lower(coalesce(${customers.businessName}, '')) like ${pattern}`,
    sql`lower(${customers.customerNumber}) like ${pattern}`,
    sql`lower(coalesce(${customers.email}, '')) like ${pattern}`,
    sql`lower(coalesce(${customers.city}, '')) like ${pattern}`,
    sql`lower(coalesce(${customers.state}, '')) like ${pattern}`,
    sql`lower(coalesce(${customers.district}, '')) like ${pattern}`,
    sql`lower(coalesce(${customers.industry}, '')) like ${pattern}`,
    sql`lower(coalesce(${customers.gstin}, '')) like ${pattern}`,
    phonePattern
      ? sql`${customers.phoneNormalized} like ${phonePattern}`
      : undefined,
  )!;
}

function buildConditions(
  filters: ListCustomersFilters,
  access: CustomerAccessScope,
) {
  const conditions: SQL[] = [...customerScopeConditions(access)];

  if (filters.status === "archived") {
    conditions.push(eq(customers.status, "archived"));
  } else if (filters.status) {
    conditions.push(eq(customers.status, filters.status));
  } else if (!filters.includeArchived) {
    conditions.push(ne(customers.status, "archived"));
  }

  if (filters.scope === "my") {
    conditions.push(eq(customers.assignedTo, access.userId));
  }
  if (filters.search) {
    conditions.push(searchCondition(filters.search));
  }
  if (filters.type) {
    conditions.push(eq(customers.type, filters.type));
  }
  if (filters.assignedTo) {
    conditions.push(eq(customers.assignedTo, filters.assignedTo));
  }
  if (filters.city) {
    conditions.push(sql`lower(${customers.city}) = ${filters.city.toLowerCase()}`);
  }
  if (filters.state) {
    conditions.push(
      sql`lower(${customers.state}) = ${filters.state.toLowerCase()}`,
    );
  }
  if (filters.recentlyAdded) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    conditions.push(gte(customers.createdAt, since));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function customerSelection() {
  return {
    customer: customers,
    assignedUser: {
      id: assignedUser.id,
      fullName: assignedUser.fullName,
      email: assignedUser.email,
      role: assignedUser.role,
    },
    createdByUser: {
      id: createdByUser.id,
      fullName: createdByUser.fullName,
      email: createdByUser.email,
      role: createdByUser.role,
    },
    contactCount:
      sql<number>`(select count(*) from customer_contacts where customer_contacts.customer_id = ${customers.id})`,
    enquiryCount:
      sql<number>`(select count(*) from leads where leads.customer_id = ${customers.id})`,
    wonCount:
      sql<number>`(select count(*) from leads where leads.customer_id = ${customers.id} and leads.pipeline_stage = 'won')`,
    lastActivityAt:
      sql<string | null>`(select max(customer_activities.created_at) from customer_activities where customer_activities.customer_id = ${customers.id})`,
  };
}

function baseCustomerQuery(db: AppDatabase) {
  return db
    .select(customerSelection())
    .from(customers)
    .leftJoin(assignedUser, eq(customers.assignedTo, assignedUser.id))
    .leftJoin(createdByUser, eq(customers.createdBy, createdByUser.id));
}

function orderBy(filters: ListCustomersFilters) {
  const direction = filters.sortDir === "asc" ? asc : desc;
  switch (filters.sortBy) {
    case "name":
      return [direction(sql`lower(${customers.name})`), desc(customers.id)];
    case "customer_number":
      return [direction(customers.customerNumber), asc(customers.id)];
    case "updated_at":
      return [direction(customers.updatedAt), desc(customers.id)];
    default:
      return [direction(customers.createdAt), desc(customers.id)];
  }
}

export async function listCustomers(
  db: AppDatabase,
  filters: ListCustomersFilters,
  access: CustomerAccessScope,
): Promise<{ rows: CustomerWithRelations[]; total: number }> {
  const where = buildConditions(filters, access);
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countRow] = await Promise.all([
    baseCustomerQuery(db)
      .where(where)
      .orderBy(...orderBy(filters))
      .limit(filters.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function findCustomerById(
  db: AppDatabase,
  id: string,
): Promise<CustomerWithRelations | undefined> {
  return baseCustomerQuery(db).where(eq(customers.id, id)).get();
}

export async function findCustomerRowById(
  db: AppDatabase,
  id: string,
): Promise<CustomerRow | undefined> {
  return db.select().from(customers).where(eq(customers.id, id)).get();
}

export async function findDuplicateCustomers(
  db: AppDatabase,
  options: {
    phoneNormalized?: string;
    emailNormalized?: string;
    businessNameNormalized?: string;
    excludeId?: string;
  },
): Promise<CustomerWithRelations[]> {
  const matches: SQL[] = [];
  if (options.phoneNormalized) {
    matches.push(eq(customers.phoneNormalized, options.phoneNormalized));
  }
  if (options.emailNormalized) {
    matches.push(eq(customers.emailNormalized, options.emailNormalized));
  }
  if (options.businessNameNormalized) {
    matches.push(
      eq(customers.businessNameNormalized, options.businessNameNormalized),
    );
  }
  if (matches.length === 0) {
    return [];
  }

  const conditions: SQL[] = [
    ne(customers.status, "archived"),
    or(...matches)!,
  ];
  if (options.excludeId) {
    conditions.push(sql`${customers.id} != ${options.excludeId}`);
  }

  return baseCustomerQuery(db)
    .where(and(...conditions))
    .orderBy(desc(customers.createdAt))
    .limit(10)
    .all();
}

export async function insertCustomer(
  db: AppDatabase,
  values: NewCustomerRow,
): Promise<CustomerRow> {
  const row = await db.insert(customers).values(values).returning().get();
  if (!row) {
    throw new Error("Failed to insert customer.");
  }
  return row;
}

export async function updateCustomerById(
  db: AppDatabase,
  id: string,
  values: Partial<NewCustomerRow>,
): Promise<CustomerRow | undefined> {
  return db
    .update(customers)
    .set(values)
    .where(eq(customers.id, id))
    .returning()
    .get();
}

export async function deleteCustomerById(
  db: AppDatabase,
  id: string,
): Promise<void> {
  await db.delete(customers).where(eq(customers.id, id)).run();
}

export async function unlinkLeadsFromCustomer(
  db: AppDatabase,
  customerId: string,
): Promise<void> {
  await db
    .update(leads)
    .set({ customerId: null })
    .where(eq(leads.customerId, customerId))
    .run();
}

export async function allocateCustomerNumber(
  db: AppDatabase,
  now: string,
): Promise<number> {
  const row = await db
    .insert(customerNumberSequence)
    .values({
      key: CUSTOMER_NUMBER_SEQUENCE_KEY,
      lastValue: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: customerNumberSequence.key,
      set: {
        lastValue: sql`${customerNumberSequence.lastValue} + 1`,
        updatedAt: now,
      },
    })
    .returning()
    .get();

  if (!row) {
    throw new Error("Failed to allocate a customer number.");
  }
  return Number(row.lastValue);
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function listCustomerContacts(
  db: AppDatabase,
  customerId: string,
): Promise<CustomerContactRow[]> {
  return db
    .select()
    .from(customerContacts)
    .where(eq(customerContacts.customerId, customerId))
    .orderBy(desc(customerContacts.isPrimary), asc(customerContacts.createdAt))
    .all();
}

export async function listContactsForCustomers(
  db: AppDatabase,
  customerIds: string[],
): Promise<CustomerContactRow[]> {
  if (customerIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(customerContacts)
    .where(inArray(customerContacts.customerId, customerIds))
    .orderBy(desc(customerContacts.isPrimary), asc(customerContacts.createdAt))
    .all();
}

export async function findCustomerContactById(
  db: AppDatabase,
  customerId: string,
  contactId: string,
): Promise<CustomerContactRow | undefined> {
  return db
    .select()
    .from(customerContacts)
    .where(
      and(
        eq(customerContacts.id, contactId),
        eq(customerContacts.customerId, customerId),
      ),
    )
    .get();
}

export async function insertCustomerContact(
  db: AppDatabase,
  values: NewCustomerContactRow,
): Promise<CustomerContactRow> {
  const row = await db
    .insert(customerContacts)
    .values(values)
    .returning()
    .get();
  if (!row) {
    throw new Error("Failed to insert customer contact.");
  }
  return row;
}

export async function updateCustomerContactById(
  db: AppDatabase,
  customerId: string,
  contactId: string,
  values: Partial<NewCustomerContactRow>,
): Promise<CustomerContactRow | undefined> {
  return db
    .update(customerContacts)
    .set(values)
    .where(
      and(
        eq(customerContacts.id, contactId),
        eq(customerContacts.customerId, customerId),
      ),
    )
    .returning()
    .get();
}

export async function deleteCustomerContactById(
  db: AppDatabase,
  customerId: string,
  contactId: string,
): Promise<boolean> {
  const result = await db
    .delete(customerContacts)
    .where(
      and(
        eq(customerContacts.id, contactId),
        eq(customerContacts.customerId, customerId),
      ),
    )
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function clearPrimaryContacts(
  db: AppDatabase,
  customerId: string,
  exceptContactId?: string,
): Promise<void> {
  await db
    .update(customerContacts)
    .set({ isPrimary: false, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
    .where(
      and(
        eq(customerContacts.customerId, customerId),
        eq(customerContacts.isPrimary, true),
        exceptContactId
          ? sql`${customerContacts.id} != ${exceptContactId}`
          : undefined,
      ),
    )
    .run();
}

export async function countCustomerContacts(
  db: AppDatabase,
  customerId: string,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerContacts)
    .where(eq(customerContacts.customerId, customerId))
    .get();
  return Number(row?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function insertCustomerActivity(
  db: AppDatabase,
  values: NewCustomerActivityRow,
): Promise<CustomerActivityRow> {
  const row = await db
    .insert(customerActivities)
    .values(values)
    .returning()
    .get();
  if (!row) {
    throw new Error("Failed to insert customer activity.");
  }
  return row;
}

export async function listCustomerActivities(
  db: AppDatabase,
  options: {
    customerId: string;
    activityType?: CustomerActivityType;
    page: number;
    pageSize: number;
  },
): Promise<{ rows: CustomerActivityWithUser[]; total: number }> {
  const conditions: SQL[] = [
    eq(customerActivities.customerId, options.customerId),
  ];
  if (options.activityType) {
    conditions.push(eq(customerActivities.activityType, options.activityType));
  }
  const where = and(...conditions);
  const offset = (options.page - 1) * options.pageSize;

  const [rows, countRow] = await Promise.all([
    db
      .select({
        activity: customerActivities,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
        },
      })
      .from(customerActivities)
      .leftJoin(users, eq(customerActivities.userId, users.id))
      .where(where)
      .orderBy(desc(customerActivities.createdAt), desc(customerActivities.id))
      .limit(options.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customerActivities)
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function listRecentCustomerActivities(
  db: AppDatabase,
  access: CustomerAccessScope,
  limit: number,
): Promise<CustomerActivityWithUser[]> {
  const conditions: SQL[] = [
    ne(customers.status, "archived"),
    ...customerScopeConditions(access),
  ];

  return db
    .select({
      activity: customerActivities,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      },
    })
    .from(customerActivities)
    .innerJoin(customers, eq(customerActivities.customerId, customers.id))
    .leftJoin(users, eq(customerActivities.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(customerActivities.createdAt), desc(customerActivities.id))
    .limit(limit)
    .all();
}

// ---------------------------------------------------------------------------
// Linked leads
// ---------------------------------------------------------------------------

function leadSelection() {
  return {
    lead: {
      id: leads.id,
      leadNumber: leads.leadNumber,
      name: leads.name,
      phone: leads.phone,
      email: leads.email,
      businessName: leads.businessName,
      serviceInterest: leads.serviceInterest,
      source: leads.source,
      pipelineStage: leads.pipelineStage,
      lostReason: leads.lostReason,
      estimatedValue: leads.estimatedValue,
      assignedTo: leads.assignedTo,
      convertedAt: leads.convertedAt,
      convertedToCustomerAt: leads.convertedToCustomerAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      deletedAt: leads.deletedAt,
    },
    assignedUser: {
      id: leadAssignedUser.id,
      fullName: leadAssignedUser.fullName,
      email: leadAssignedUser.email,
      role: leadAssignedUser.role,
    },
  };
}

export async function listCustomerLeads(
  db: AppDatabase,
  customerId: string,
): Promise<CustomerLeadWithUser[]> {
  return db
    .select(leadSelection())
    .from(leads)
    .leftJoin(leadAssignedUser, eq(leads.assignedTo, leadAssignedUser.id))
    .where(eq(leads.customerId, customerId))
    .orderBy(desc(leads.createdAt))
    .all();
}

export async function countCustomerLeads(
  db: AppDatabase,
  customerId: string,
): Promise<{ leadCount: number; wonLeadCount: number; openLeadCount: number }> {
  const row = await db
    .select({
      leadCount: sql<number>`count(*)`,
      wonLeadCount: sql<number>`coalesce(sum(case when ${leads.pipelineStage} = 'won' then 1 else 0 end), 0)`,
      openLeadCount: sql<number>`coalesce(sum(case when ${leads.pipelineStage} not in ('won', 'lost') then 1 else 0 end), 0)`,
    })
    .from(leads)
    .where(eq(leads.customerId, customerId))
    .get();

  return {
    leadCount: Number(row?.leadCount ?? 0),
    wonLeadCount: Number(row?.wonLeadCount ?? 0),
    openLeadCount: Number(row?.openLeadCount ?? 0),
  };
}

export async function claimLeadForCustomer(
  db: AppDatabase,
  options: {
    leadId: string;
    customerId: string;
    now: string;
    markConverted: boolean;
  },
): Promise<boolean> {
  const values: {
    customerId: string;
    updatedAt: string;
    convertedToCustomerAt?: string;
  } = {
    customerId: options.customerId,
    updatedAt: options.now,
  };
  if (options.markConverted) {
    values.convertedToCustomerAt = options.now;
  }

  const result = await db
    .update(leads)
    .set(values)
    .where(and(eq(leads.id, options.leadId), isNull(leads.customerId)))
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function detachLeadFromCustomer(
  db: AppDatabase,
  customerId: string,
  leadId: string,
): Promise<void> {
  await db
    .update(leads)
    .set({
      customerId: null,
      convertedToCustomerAt: null,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(
      and(eq(leads.id, leadId), eq(leads.customerId, customerId)),
    )
    .run();
}

// ---------------------------------------------------------------------------
// Dashboard aggregates
// ---------------------------------------------------------------------------

export async function getCustomerCounts(
  db: AppDatabase,
  access: CustomerAccessScope,
  monthStart: string,
): Promise<CustomerCountsRow> {
  const where = and(...customerScopeConditions(access));
  const row = await db
    .select({
      active: sql<number>`coalesce(sum(case when ${customers.status} = 'active' then 1 else 0 end), 0)`,
      inactive: sql<number>`coalesce(sum(case when ${customers.status} = 'inactive' then 1 else 0 end), 0)`,
      archived: sql<number>`coalesce(sum(case when ${customers.status} = 'archived' then 1 else 0 end), 0)`,
      business: sql<number>`coalesce(sum(case when ${customers.type} = 'business' and ${customers.status} != 'archived' then 1 else 0 end), 0)`,
      individual: sql<number>`coalesce(sum(case when ${customers.type} = 'individual' and ${customers.status} != 'archived' then 1 else 0 end), 0)`,
      newThisMonth: sql<number>`coalesce(sum(case when ${customers.createdAt} >= ${monthStart} and ${customers.status} != 'archived' then 1 else 0 end), 0)`,
    })
    .from(customers)
    .where(where)
    .get();

  return {
    active: Number(row?.active ?? 0),
    inactive: Number(row?.inactive ?? 0),
    archived: Number(row?.archived ?? 0),
    business: Number(row?.business ?? 0),
    individual: Number(row?.individual ?? 0),
    newThisMonth: Number(row?.newThisMonth ?? 0),
  };
}

export async function getCustomerMonthlyGrowth(
  db: AppDatabase,
  access: CustomerAccessScope,
  startIso: string,
): Promise<Array<{ month: string; count: number }>> {
  const conditions: SQL[] = [
    ne(customers.status, "archived"),
    sql`${customers.createdAt} >= ${startIso}`,
    ...customerScopeConditions(access),
  ];

  const rows = await db
    .select({
      month: sql<string>`substr(${customers.createdAt}, 1, 7)`,
      count: sql<number>`count(*)`,
    })
    .from(customers)
    .where(and(...conditions))
    .groupBy(sql`substr(${customers.createdAt}, 1, 7)`)
    .all();

  return rows.map((row) => ({
    month: row.month,
    count: Number(row.count),
  }));
}
