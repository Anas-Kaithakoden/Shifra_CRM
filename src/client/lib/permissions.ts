import type { AuthUserDto, UserDto } from "../../shared/types/api";
import type { Permission } from "../../shared/types/permissions";
import type { Role } from "../../shared/types/roles";

export function hasPermission(
  user: AuthUserDto | null | undefined,
  permission: Permission,
): boolean {
  return Boolean(user?.permissions.includes(permission));
}

/**
 * Mirrors the server target-account policy so the UI does not offer actions the
 * API will reject. The server remains the source of truth.
 */
export function canManageUser(
  actor: AuthUserDto | null | undefined,
  target: UserDto,
): boolean {
  if (!actor) {
    return false;
  }
  if (actor.id === target.id) {
    return false;
  }
  if (target.role === "owner") {
    return false;
  }
  if (actor.role === "owner") {
    return true;
  }
  return actor.role === "admin" && target.role === "employee";
}

export function canChangeUserRole(
  actor: AuthUserDto | null | undefined,
  target: UserDto,
): boolean {
  return actor?.role === "owner" && canManageUser(actor, target);
}

export function assignableRolesFor(actor: AuthUserDto): Role[] {
  if (actor.role === "owner") {
    return ["admin", "employee"];
  }
  if (actor.role === "admin") {
    return ["employee"];
  }
  return [];
}
