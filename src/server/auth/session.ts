import type { AppDatabase } from "../db/client";
import {
  deleteSessionById,
  findSessionWithUser,
  insertSession,
  touchSession,
} from "../db/queries/sessions.queries";
import type { SessionRow, UserRow } from "../db/schema";
import { randomHex, sha256Hex } from "../lib/encoding";
import { newId } from "../lib/ids";
import { isExpired, isOlderThan, isoFromNow, nowIso } from "../lib/time";

const SESSION_TOKEN_BYTES = 32;
const ACTIVITY_WRITE_INTERVAL_MINUTES = 1;

export interface CreatedSession {
  session: SessionRow;
  token: string;
  csrfToken: string;
  expiresAt: string;
}

export async function createSession(
  db: AppDatabase,
  userId: string,
  ttlHours: number,
): Promise<CreatedSession> {
  const token = randomHex(SESSION_TOKEN_BYTES);
  const tokenHash = await sha256Hex(token);
  const now = nowIso();
  const expiresAt = isoFromNow({ hours: ttlHours });

  const session = await insertSession(db, {
    id: newId(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: now,
    lastActivityAt: now,
  });

  return {
    session,
    token,
    csrfToken: randomHex(32),
    expiresAt,
  };
}

export interface ResolvedSession {
  session: SessionRow;
  user: UserRow;
}

export async function resolveSession(
  db: AppDatabase,
  token: string,
  idleMinutes: number,
): Promise<ResolvedSession | null> {
  const tokenHash = await sha256Hex(token);
  const found = await findSessionWithUser(db, tokenHash);

  if (!found) {
    return null;
  }

  const { session, user } = found;

  if (!user.isActive) {
    await deleteSessionById(db, session.id);
    return null;
  }

  if (
    isExpired(session.expiresAt) ||
    isOlderThan(session.lastActivityAt, idleMinutes)
  ) {
    await deleteSessionById(db, session.id);
    return null;
  }

  // Avoid a database write on every request while still keeping an accurate
  // idle timeout.
  if (isOlderThan(session.lastActivityAt, ACTIVITY_WRITE_INTERVAL_MINUTES)) {
    const now = nowIso();
    await touchSession(db, session.id, now);
    session.lastActivityAt = now;
  }

  return { session, user };
}
