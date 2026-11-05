import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import {
  auditLogs,
  users,
  type AuditLogRow,
  type NewAuditLogRow,
} from "../schema";

export interface AuditActor {
  id: string;
  fullName: string;
  email: string;
}

export interface AuditLogWithActor {
  log: AuditLogRow;
  actor: AuditActor | null;
}

export interface ListAuditLogsFilters {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export async function insertAuditLog(
  db: AppDatabase,
  values: NewAuditLogRow,
): Promise<void> {
  await db.insert(auditLogs).values(values).run();
}

export async function listAuditLogs(
  db: AppDatabase,
  filters: ListAuditLogsFilters,
): Promise<{ rows: AuditLogWithActor[]; total: number }> {
  const conditions = [];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.from) {
    conditions.push(gte(auditLogs.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(auditLogs.createdAt, filters.to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countRow] = await Promise.all([
    db
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.pageSize)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where)
      .get(),
  ]);

  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function listRecentAuditLogs(
  db: AppDatabase,
  options: { limit: number; userId?: string },
): Promise<AuditLogWithActor[]> {
  const where = options.userId ? eq(auditLogs.userId, options.userId) : undefined;

  return db
    .select({
      log: auditLogs,
      actor: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(options.limit)
    .all();
}
