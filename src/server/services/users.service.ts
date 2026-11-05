import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import type { UserDto } from "../../shared/types/api";
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from "../schemas/users.schema";
import type { AppDatabase } from "../db/client";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  listUsers,
  updateUserById,
} from "../db/queries/users.queries";
import { deleteSessionsForUser } from "../db/queries/sessions.queries";
import type { UserRow } from "../db/schema";
import { hashPassword } from "../auth/password";
import { assertCanAssignRole, assertCanManageTarget } from "../auth/permissions";
import { conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";
import { toUserDto } from "./mappers";

function isUniqueEmailError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("unique constraint failed: users.email");
}

export async function listUsersForActor(
  db: AppDatabase,
  query: ListUsersQuery,
): Promise<{ items: UserDto[]; total: number }> {
  const { rows, total } = await listUsers(db, {
    search: query.search,
    role: query.role,
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  });

  return { items: rows.map(toUserDto), total };
}

export async function getUserForActor(
  db: AppDatabase,
  actor: UserDto,
  id: string,
): Promise<UserDto> {
  const target = await findUserById(db, id);
  if (!target) {
    throw notFound("Employee not found.");
  }

  if (actor.role === "employee" && actor.id !== target.id) {
    throw forbidden("You can only view your own profile.");
  }

  return toUserDto(target);
}

export async function createUserForActor(
  db: AppDatabase,
  actor: UserDto,
  input: CreateUserInput,
  ipAddress: string | null,
): Promise<UserDto> {
  assertCanAssignRole(actor.role, input.role);

  const existing = await findUserByEmail(db, input.email);
  if (existing) {
    throw conflict("email_in_use", "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const now = nowIso();

  let user: UserRow;
  try {
    user = await insertUser(db, {
      id: newId(),
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });
  } catch (error) {
    if (isUniqueEmailError(error)) {
      throw conflict("email_in_use", "An account with this email already exists.");
    }
    throw error;
  }

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: "user",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    ipAddress,
  });

  return toUserDto(user);
}

export async function updateUserForActor(
  db: AppDatabase,
  actor: UserDto,
  id: string,
  input: UpdateUserInput,
  ipAddress: string | null,
): Promise<UserDto> {
  const target = await findUserById(db, id);
  if (!target) {
    throw notFound("Employee not found.");
  }

  const targetDto = toUserDto(target);
  const updates: Parameters<typeof updateUserById>[2] = { updatedAt: nowIso() };
  const auditEntries: Array<{
    action: string;
    metadata: Record<string, unknown>;
  }> = [];

  if (input.fullName !== undefined && input.fullName !== target.fullName) {
    assertCanManageTarget(actor, targetDto, "update");
    updates.fullName = input.fullName;
    auditEntries.push({
      action: AUDIT_ACTIONS.USER_UPDATED,
      metadata: { email: target.email, fields: ["fullName"] },
    });
  }

  if (input.role !== undefined && input.role !== target.role) {
    assertCanManageTarget(actor, targetDto, "role");
    assertCanAssignRole(actor.role, input.role);
    updates.role = input.role;
    auditEntries.push({
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      metadata: { email: target.email, from: target.role, to: input.role },
    });
  }

  if (auditEntries.length === 0) {
    return targetDto;
  }

  const updated = await updateUserById(db, target.id, updates);
  if (!updated) {
    throw notFound("Employee not found.");
  }

  for (const entry of auditEntries) {
    await recordAudit(db, {
      userId: actor.id,
      action: entry.action,
      entityType: "user",
      entityId: target.id,
      metadata: entry.metadata,
      ipAddress,
    });
  }

  return toUserDto(updated);
}

export async function setUserActiveForActor(
  db: AppDatabase,
  actor: UserDto,
  id: string,
  active: boolean,
  ipAddress: string | null,
): Promise<UserDto> {
  const target = await findUserById(db, id);
  if (!target) {
    throw notFound("Employee not found.");
  }

  const targetDto = toUserDto(target);
  assertCanManageTarget(
    actor,
    targetDto,
    active ? "activate" : "deactivate",
  );

  if (target.isActive === active) {
    return targetDto;
  }

  const updated = await updateUserById(db, target.id, {
    isActive: active,
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw notFound("Employee not found.");
  }

  if (!active) {
    // A deactivated account must not keep a usable session.
    await deleteSessionsForUser(db, target.id);
  }

  await recordAudit(db, {
    userId: actor.id,
    action: active
      ? AUDIT_ACTIONS.USER_ACTIVATED
      : AUDIT_ACTIONS.USER_DEACTIVATED,
    entityType: "user",
    entityId: target.id,
    metadata: { email: target.email },
    ipAddress,
  });

  return toUserDto(updated);
}
