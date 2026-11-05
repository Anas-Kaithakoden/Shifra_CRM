import type { AppDatabase } from "../db/client";
import {
  countFailedAttemptsByEmail,
  countFailedAttemptsByIp,
  deleteLoginAttemptsBefore,
  insertLoginAttempt,
} from "../db/queries/login-attempts.queries";
import { AppError } from "../lib/errors";
import { newId } from "../lib/ids";
import { isoBeforeNow, nowIso } from "../lib/time";

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const RETENTION_HOURS = 24 * 7;

export async function assertLoginAllowed(
  db: AppDatabase,
  email: string,
  ipAddress: string | null,
): Promise<void> {
  const since = isoBeforeNow({ minutes: WINDOW_MINUTES });

  const [emailFailures, ipFailures] = await Promise.all([
    countFailedAttemptsByEmail(db, email, since),
    ipAddress
      ? countFailedAttemptsByIp(db, ipAddress, since)
      : Promise.resolve(0),
  ]);

  if (
    emailFailures >= MAX_FAILURES_PER_EMAIL ||
    (ipAddress !== null && ipFailures >= MAX_FAILURES_PER_IP)
  ) {
    throw new AppError(
      429,
      "too_many_attempts",
      "Too many sign-in attempts. Please wait a few minutes and try again.",
      {
        headers: {
          "Retry-After": String(WINDOW_MINUTES * 60),
        },
      },
    );
  }
}

export async function recordLoginAttempt(
  db: AppDatabase,
  email: string,
  ipAddress: string | null,
  success: boolean,
): Promise<void> {
  await insertLoginAttempt(db, {
    id: newId(),
    email: email.toLowerCase(),
    ipAddress,
    success,
    createdAt: nowIso(),
  });

  await deleteLoginAttemptsBefore(db, isoBeforeNow({ hours: RETENTION_HOURS }));
}
