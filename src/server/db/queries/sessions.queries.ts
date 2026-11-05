import { and, eq, lt, ne } from "drizzle-orm";
import type { AppDatabase } from "../client";
import {
  sessions,
  users,
  type NewSessionRow,
  type SessionRow,
  type UserRow,
} from "../schema";

export async function insertSession(
  db: AppDatabase,
  values: NewSessionRow,
): Promise<SessionRow> {
  const row = await db.insert(sessions).values(values).returning().get();
  if (!row) {
    throw new Error("Failed to insert session");
  }
  return row;
}

export async function findSessionWithUser(
  db: AppDatabase,
  tokenHash: string,
): Promise<{ session: SessionRow; user: UserRow } | undefined> {
  return db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .get();
}

export async function touchSession(
  db: AppDatabase,
  sessionId: string,
  lastActivityAt: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ lastActivityAt })
    .where(eq(sessions.id, sessionId))
    .run();
}

export async function deleteSessionById(
  db: AppDatabase,
  sessionId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export async function deleteSessionsForUser(
  db: AppDatabase,
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  const where = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
    : eq(sessions.userId, userId);

  await db.delete(sessions).where(where).run();
}

export async function deleteExpiredSessions(
  db: AppDatabase,
  now: string,
): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}
