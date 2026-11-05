import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import type { ChangePasswordInput, LoginInput } from "../schemas/auth.schema";
import type { AppDatabase } from "../db/client";
import {
  findUserById,
  findUserByEmail,
  updateUserById,
} from "../db/queries/users.queries";
import { deleteSessionsForUser } from "../db/queries/sessions.queries";
import type { UserRow } from "../db/schema";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "../auth/password";
import { createSession } from "../auth/session";
import { badRequest, AppError } from "../lib/errors";
import { nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";
import { assertLoginAllowed, recordLoginAttempt } from "./rate-limit.service";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export interface LoginResult {
  user: UserRow;
  token: string;
  csrfToken: string;
  expiresAt: string;
}

export async function login(
  db: AppDatabase,
  input: LoginInput,
  ipAddress: string | null,
  ttlHours: number,
): Promise<LoginResult> {
  await assertLoginAllowed(db, input.email, ipAddress);

  const user = await findUserByEmail(db, input.email);
  const storedHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordValid = await verifyPassword(input.password, storedHash);

  if (!user || !passwordValid || !user.isActive) {
    const reason = !user
      ? "unknown_account"
      : !passwordValid
        ? "invalid_password"
        : "inactive_account";

    await recordLoginAttempt(db, input.email, ipAddress, false);
    await recordAudit(db, {
      userId: user?.id ?? null,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: "user",
      entityId: user?.id ?? null,
      metadata: { email: input.email, reason },
      ipAddress,
    });

    throw new AppError(401, "invalid_credentials", GENERIC_LOGIN_ERROR);
  }

  await recordLoginAttempt(db, input.email, ipAddress, true);

  const now = nowIso();
  const updated =
    (await updateUserById(db, user.id, {
      lastLoginAt: now,
      updatedAt: now,
    })) ?? user;

  const session = await createSession(db, user.id, ttlHours);

  await recordAudit(db, {
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entityType: "user",
    entityId: user.id,
    ipAddress,
  });

  return {
    user: updated,
    token: session.token,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  };
}

export async function changePassword(
  db: AppDatabase,
  userId: string,
  input: ChangePasswordInput,
  ipAddress: string | null,
  ttlHours: number,
): Promise<LoginResult> {
  const user = await findUserById(db, userId);
  if (!user) {
    throw new AppError(401, "unauthenticated", "Authentication is required.");
  }

  const currentValid = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );
  if (!currentValid) {
    throw badRequest("invalid_current_password", "Current password is incorrect.");
  }

  if (input.currentPassword === input.newPassword) {
    throw badRequest(
      "password_unchanged",
      "Choose a password that is different from your current password.",
    );
  }

  const newHash = await hashPassword(input.newPassword);
  const now = nowIso();

  const updated = await updateUserById(db, user.id, {
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: now,
  });

  if (!updated) {
    throw new AppError(500, "internal_error", "Unable to update the password.");
  }

  // Invalidate every existing session, then issue a fresh one for this browser.
  await deleteSessionsForUser(db, user.id);
  const session = await createSession(db, user.id, ttlHours);

  await recordAudit(db, {
    userId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    entityType: "user",
    entityId: user.id,
    ipAddress,
  });

  return {
    user: updated,
    token: session.token,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  };
}

export async function updateOwnProfile(
  db: AppDatabase,
  userId: string,
  fullName: string,
  ipAddress: string | null,
): Promise<UserRow> {
  const updated = await updateUserById(db, userId, {
    fullName,
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new AppError(404, "not_found", "User not found.");
  }

  await recordAudit(db, {
    userId,
    action: AUDIT_ACTIONS.PROFILE_UPDATED,
    entityType: "user",
    entityId: userId,
    ipAddress,
  });

  return updated;
}

export async function recordLogout(
  db: AppDatabase,
  userId: string,
  ipAddress: string | null,
): Promise<void> {
  await recordAudit(db, {
    userId,
    action: AUDIT_ACTIONS.LOGOUT,
    entityType: "user",
    entityId: userId,
    ipAddress,
  });
}
