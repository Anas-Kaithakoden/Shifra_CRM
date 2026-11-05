export const ROLES = ["owner", "admin", "employee"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  employee: "Employee",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access, including employee administration and system settings.",
  admin: "Manages employees and operational CRM modules.",
  employee: "Access to the dashboard and modules assigned to their role.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
