import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  lt,
  lte,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type {
  CustomerRenewalCounts,
  RenewalFilter,
} from "../../../shared/types/customers";
import type { AppDatabase } from "../client";
import {
  customerServices,
  customers,
  users,
  type CustomerRow,
  type CustomerServiceRow,
  type NewCustomerServiceRow,
} from "../schema";
import {
  customerScopeConditions,
  type CustomerAccessScope,
} from "./customers.queries";

const renewalAssignedUser = alias(users, "renewal_assigned_user");

export interface RenewalWithCustomer {
  service: CustomerServiceRow;
  customer: CustomerRow;
  assignedUser: {
    id: string | null;
    fullName: string | null;
    email: string | null;
    role: string | null;
  } | null;
}

export interface RenewalListFilters {
  filter: RenewalFilter;
  todayKey: string;
  soonEndKey: string;
  next30EndKey: string;
  page: number;
  pageSize: number;
}

export async function listCustomerServices(
  db: AppDatabase,
  customerId: string,
): Promise<CustomerServiceRow[]> {
  return db
    .select()
    .from(customerServices)
    .where(eq(customerServices.customerId, customerId))
    .orderBy(asc(customerServices.createdAt), asc(customerServices.id))
    .all();
}

export async function findCustomerServiceById(
  db: AppDatabase,
  customerId: string,
  serviceId: string,
): Promise<CustomerServiceRow | undefined> {
  return db
    .select()
    .from(customerServices)
    .where(
      and(
        eq(customerServices.id, serviceId),
        eq(customerServices.customerId, customerId),
      ),
    )
    .get();
}

export async function insertCustomerService(
  db: AppDatabase,
  values: NewCustomerServiceRow,
): Promise<CustomerServiceRow> {
  return db.insert(customerServices).values(values).returning().get();
}

export async function updateCustomerServiceById(
  db: AppDatabase,
  customerId: string,
  serviceId: string,
  values: Partial<NewCustomerServiceRow>,
): Promise<CustomerServiceRow | undefined> {
  return db
    .update(customerServices)
    .set(values)
    .where(
      and(
        eq(customerServices.id, serviceId),
        eq(customerServices.customerId, customerId),
      ),
    )
    .returning()
    .get();
}

export async function deleteCustomerServiceById(
  db: AppDatabase,
  customerId: string,
  serviceId: string,
): Promise<boolean> {
  const result = await db
    .delete(customerServices)
    .where(
      and(
        eq(customerServices.id, serviceId),
        eq(customerServices.customerId, customerId),
      ),
    )
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

function renewalConditions(
  filters: RenewalListFilters,
  access: CustomerAccessScope,
): SQL[] {
  const conditions: SQL[] = [
    isNotNull(customerServices.renewalOn),
    ne(customers.status, "archived"),
    ...customerScopeConditions(access),
  ];

  switch (filters.filter) {
    case "overdue":
      conditions.push(lt(customerServices.renewalOn, filters.todayKey));
      break;
    case "due_soon":
      conditions.push(
        gte(customerServices.renewalOn, filters.todayKey),
        lte(customerServices.renewalOn, filters.soonEndKey),
      );
      break;
    case "upcoming":
      conditions.push(gte(customerServices.renewalOn, filters.todayKey));
      break;
    case "next_30":
      conditions.push(
        gte(customerServices.renewalOn, filters.todayKey),
        lte(customerServices.renewalOn, filters.next30EndKey),
      );
      break;
    case "all":
    default:
      break;
  }

  return conditions;
}

export async function listRenewals(
  db: AppDatabase,
  filters: RenewalListFilters,
  access: CustomerAccessScope,
): Promise<{
  rows: RenewalWithCustomer[];
  total: number;
  counts: CustomerRenewalCounts;
}> {
  const conditions = renewalConditions(filters, access);
  const where = and(...conditions);
  const offset = (filters.page - 1) * filters.pageSize;

  const baseConditions: SQL[] = [
    isNotNull(customerServices.renewalOn),
    ne(customers.status, "archived"),
    ...customerScopeConditions(access),
  ];
  const baseWhere = and(...baseConditions);

  const [rows, countRow, countsRow] = await Promise.all([
    db
      .select({
        service: customerServices,
        customer: customers,
        assignedUser: {
          id: renewalAssignedUser.id,
          fullName: renewalAssignedUser.fullName,
          email: renewalAssignedUser.email,
          role: renewalAssignedUser.role,
        },
      })
      .from(customerServices)
      .innerJoin(
        customers,
        eq(customerServices.customerId, customers.id),
      )
      .leftJoin(
        renewalAssignedUser,
        eq(customers.assignedTo, renewalAssignedUser.id),
      )
      .where(where)
      .orderBy(
        asc(customerServices.renewalOn),
        asc(customers.name),
        asc(customerServices.id),
      )
      .limit(filters.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customerServices)
      .innerJoin(customers, eq(customerServices.customerId, customers.id))
      .where(where)
      .get(),
    db
      .select({
        overdue: sql<number>`coalesce(sum(case when ${customerServices.renewalOn} < ${filters.todayKey} then 1 else 0 end), 0)`,
        dueSoon: sql<number>`coalesce(sum(case when ${customerServices.renewalOn} >= ${filters.todayKey} and ${customerServices.renewalOn} <= ${filters.soonEndKey} then 1 else 0 end), 0)`,
        upcoming: sql<number>`coalesce(sum(case when ${customerServices.renewalOn} >= ${filters.todayKey} then 1 else 0 end), 0)`,
        total: sql<number>`count(*)`,
      })
      .from(customerServices)
      .innerJoin(customers, eq(customerServices.customerId, customers.id))
      .where(baseWhere)
      .get(),
  ]);

  return {
    rows,
    total: Number(countRow?.count ?? 0),
    counts: {
      overdue: Number(countsRow?.overdue ?? 0),
      dueSoon: Number(countsRow?.dueSoon ?? 0),
      upcoming: Number(countsRow?.upcoming ?? 0),
      total: Number(countsRow?.total ?? 0),
    },
  };
}
