import type { AuthUserDto } from "../../shared/types/api";
import type { CustomerRow } from "../db/schema";
import type { CustomerAccessScope } from "../db/queries/customers.queries";

export function toCustomerAccessScope(
  actor: AuthUserDto,
): CustomerAccessScope {
  return { userId: actor.id, role: actor.role };
}

/** Owner and admin see every customer; employees see assigned or created records. */
export function canViewCustomer(
  actor: AuthUserDto,
  customer: CustomerRow,
): boolean {
  if (actor.role === "owner" || actor.role === "admin") {
    return true;
  }
  return customer.assignedTo === actor.id || customer.createdBy === actor.id;
}

/**
 * Employees may update customers they are assigned to or created. Assignment
 * and archival remain separately permission-gated for owner/admin.
 */
export function canManageCustomer(
  actor: AuthUserDto,
  customer: CustomerRow,
): boolean {
  return canViewCustomer(actor, customer);
}
