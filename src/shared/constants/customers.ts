/**
 * Shared customer domain vocabulary.
 *
 * These values are persisted in D1. Changing a stored value requires a data
 * migration; labels can change freely.
 */

export const CUSTOMER_TYPES = ["individual", "business"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Individual",
  business: "Business",
};

export const CUSTOMER_SERVICE_CATEGORIES = [
  "business_solutions",
  "digital_solutions",
  "branding_creative",
] as const;

export type CustomerServiceCategory =
  (typeof CUSTOMER_SERVICE_CATEGORIES)[number];

export const CUSTOMER_SERVICE_CATEGORY_LABELS: Record<
  CustomerServiceCategory,
  string
> = {
  business_solutions: "Business Solutions",
  digital_solutions: "Digital Solutions",
  branding_creative: "Branding & Creative",
};

export const CUSTOMER_STATUSES = ["active", "inactive", "archived"] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

/** Usable statuses before a customer is archived. */
export const ACTIVE_CUSTOMER_STATUSES = ["active", "inactive"] as const;

export const CUSTOMER_ACTIVITY_TYPES = [
  "customer_created",
  "customer_updated",
  "status_changed",
  "assignment_changed",
  "contact_added",
  "contact_updated",
  "contact_removed",
  "primary_contact_changed",
  "note_added",
  "interaction_logged",
  "call",
  "whatsapp",
  "email",
  "meeting",
  "lead_linked",
  "lead_converted",
  "customer_archived",
  "customer_restored",
] as const;

export type CustomerActivityType = (typeof CUSTOMER_ACTIVITY_TYPES)[number];

export const CUSTOMER_ACTIVITY_TYPE_LABELS: Record<
  CustomerActivityType,
  string
> = {
  customer_created: "Customer Created",
  customer_updated: "Customer Updated",
  status_changed: "Status Changed",
  assignment_changed: "Assignment Changed",
  contact_added: "Contact Added",
  contact_updated: "Contact Updated",
  contact_removed: "Contact Removed",
  primary_contact_changed: "Primary Contact Changed",
  note_added: "Note Added",
  interaction_logged: "Interaction Logged",
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  lead_linked: "Lead Linked",
  lead_converted: "Lead Converted",
  customer_archived: "Customer Archived",
  customer_restored: "Customer Restored",
};

/** Interaction types an employee can log manually from the customer UI. */
export const MANUAL_CUSTOMER_ACTIVITY_TYPES = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "note",
] as const;

export type ManualCustomerActivityType =
  (typeof MANUAL_CUSTOMER_ACTIVITY_TYPES)[number];

export const MANUAL_CUSTOMER_ACTIVITY_TYPE_LABELS: Record<
  ManualCustomerActivityType,
  string
> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export const CUSTOMER_QUICK_FILTERS = [
  "all",
  "active",
  "inactive",
  "recent",
  "my",
  "archived",
] as const;

export type CustomerQuickFilter = (typeof CUSTOMER_QUICK_FILTERS)[number];

export const CUSTOMER_QUICK_FILTER_LABELS: Record<CustomerQuickFilter, string> =
  {
    all: "All Customers",
    active: "Active",
    inactive: "Inactive",
    recent: "Recently Added",
    my: "My Customers",
    archived: "Archived",
  };

export const CUSTOMER_RECENT_DAYS = 30;
export const DEFAULT_CUSTOMER_COUNTRY = "India";

export const CUSTOMER_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "name",
  "customer_number",
] as const;

export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export const CUSTOMER_NUMBER_PREFIX = "SN-CUS-";
export const CUSTOMER_NUMBER_SEQUENCE_KEY = "customer";

export function formatCustomerNumber(sequence: number): string {
  return `${CUSTOMER_NUMBER_PREFIX}${String(Math.max(0, sequence)).padStart(4, "0")}`;
}

export function isCustomerType(value: unknown): value is CustomerType {
  return (
    typeof value === "string" &&
    (CUSTOMER_TYPES as readonly string[]).includes(value)
  );
}

export function isCustomerStatus(value: unknown): value is CustomerStatus {
  return (
    typeof value === "string" &&
    (CUSTOMER_STATUSES as readonly string[]).includes(value)
  );
}

export function isCustomerActivityType(
  value: unknown,
): value is CustomerActivityType {
  return (
    typeof value === "string" &&
    (CUSTOMER_ACTIVITY_TYPES as readonly string[]).includes(value)
  );
}
