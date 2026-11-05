import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Role } from "../../../shared/types/roles";
import type { AppDatabase } from "../client";
import { users, type NewUserRow, type UserRow } from "../schema";

export interface ListUsersFilters {
  search?: string;
  role?: Role;
  status?: "active" | "inactive";
  page: number;
  pageSize: number;
}

export async function findUserById(
  db: AppDatabase,
  id: string,
): Promise<UserRow | undefined> {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export async function findUserByEmail(
  db: AppDatabase,
  email: string,
): Promise<UserRow | undefined> {
  return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
}

export async function insertUser(
  db: AppDatabase,
  values: NewUserRow,
): Promise<UserRow> {
  const row = await db.insert(users).values(values).returning().get();
  if (!row) {
    throw new Error("Failed to insert user");
  }
  return row;
}

export async function updateUserById(
  db: AppDatabase,
  id: string,
  values: Partial<
    Pick<
      UserRow,
      | "fullName"
      | "email"
      | "passwordHash"
      | "role"
      | "isActive"
      | "mustChangePassword"
      | "updatedAt"
      | "lastLoginAt"
    >
  >,
): Promise<UserRow | undefined> {
  return db.update(users).set(values).where(eq(users.id, id)).returning().get();
}

export async function listUsers(
  db: AppDatabase,
  filters: ListUsersFilters,
): Promise<{ rows: UserRow[]; total: number }> {
  const conditions = [];

  if (filters.search) {
    const pattern = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${users.fullName}) like ${pattern}`,
        sql`lower(${users.email}) like ${pattern}`,
      ),
    );
  }
  if (filters.role) {
    conditions.push(eq(users.role, filters.role));
  }
  if (filters.status) {
    conditions.push(eq(users.isActive, filters.status === "active"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(filters.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function countUsers(db: AppDatabase): Promise<{
  total: number;
  active: number;
}> {
  const row = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`coalesce(sum(case when ${users.isActive} = 1 then 1 else 0 end), 0)`,
    })
    .from(users)
    .get();

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
  };
}

export async function countUsersByRole(
  db: AppDatabase,
): Promise<Array<{ role: Role; count: number }>> {
  const rows = await db
    .select({ role: users.role, count: sql<number>`count(*)` })
    .from(users)
    .groupBy(users.role)
    .all();

  return rows.map((row) => ({ role: row.role, count: Number(row.count) }));
}
