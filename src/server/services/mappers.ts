import type {
  AuditLogDto,
  AuthUserDto,
  UserDto,
} from "../../shared/types/api";
import { getPermissionsForRole } from "../../shared/types/permissions";
import type { AuditLogWithActor } from "../db/queries/audit.queries";
import type { UserRow } from "../db/schema";

export function toUserDto(user: UserRow): UserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function toAuthUserDto(user: UserRow): AuthUserDto {
  return {
    ...toUserDto(user),
    permissions: getPermissionsForRole(user.role),
  };
}

function parseMetadata(
  raw: string | null,
): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function toAuditLogDto(row: AuditLogWithActor): AuditLogDto {
  return {
    id: row.log.id,
    userId: row.log.userId,
    actor: row.actor
      ? {
          id: row.actor.id,
          fullName: row.actor.fullName,
          email: row.actor.email,
        }
      : null,
    action: row.log.action,
    entityType: row.log.entityType,
    entityId: row.log.entityId,
    metadata: parseMetadata(row.log.metadata),
    ipAddress: row.log.ipAddress,
    createdAt: row.log.createdAt,
  };
}
