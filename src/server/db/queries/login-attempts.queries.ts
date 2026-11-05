import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { loginAttempts } from "../schema";

export async function insertLoginAttempt(
  db: AppDatabase,
  values: {
    id: string;
    email: string;
    ipAddress: string | null;
    success: boolean;
    createdAt: string;
  },
): Promise<void> {
  await db.insert(loginAttempts).values(values).run();
}

export async function countFailedAttemptsByEmail(
  db: AppDatabase,
  email: string,
  since: string,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email.toLowerCase()),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since),
      ),
    )
    .get();

  return Number(row?.count ?? 0);
}

export async function countFailedAttemptsByIp(
  db: AppDatabase,
  ipAddress: string,
  since: string,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ipAddress, ipAddress),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since),
      ),
    )
    .get();

  return Number(row?.count ?? 0);
}

export async function deleteLoginAttemptsBefore(
  db: AppDatabase,
  cutoff: string,
): Promise<void> {
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff)).run();
}
