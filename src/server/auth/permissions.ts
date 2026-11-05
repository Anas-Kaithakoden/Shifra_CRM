import { forbidden } from "../lib/errors";
import type { Role } from "../../shared/types/roles";
import type { UserDto } from "../../shared/types/api";

/**
 * Centralised target-account policy, independent of the route layer.
 *
 * - The owner account cannot be changed through employee-management endpoints.
 * - Admins may only act on regular employees and may not act on themselves.
 * - No one may change their own role or deactivate themselves.
 */
export function assertCanManageTarget(
  actor: UserDto,
  target: UserDto,
  action: "update" | "role" | "deactivate" | "activate",
): void {
  if (actor.id === target.id) {
    throw forbidden("You cannot perform this action on your own account.");
  }

  if (target.role === "owner") {
    throw forbidden("The owner account cannot be modified here.");
  }

  if (actor.role === "admin" && target.role !== "employee") {
    throw forbidden("Administrators can only manage regular employee accounts.");
  }

  if (action === "role" && actor.role !== "owner") {
    throw forbidden("Only the owner can change employee roles.");
  }
}

export function assertCanAssignRole(actorRole: Role, role: Role): void {
  if (role === "owner") {
    throw forbidden("Ownership cannot be assigned through the API.");
  }

  if (actorRole === "admin" && role !== "employee") {
    throw forbidden("Administrators can only create or assign employee accounts.");
  }

  if (actorRole === "employee") {
    throw forbidden("Employees cannot manage accounts.");
  }
}
