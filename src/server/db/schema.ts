import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  CUSTOMER_ACTIVITY_TYPES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
} from "../../shared/constants/customers";
import {
  ACTIVITY_TYPES,
  CONTACT_STATUSES,
  FOLLOW_UP_STATUSES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  PIPELINE_STAGES,
} from "../../shared/constants/leads";
import { ROLES } from "../../shared/types/roles";

const nowSql = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ROLES }).notNull().default("employee"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(nowSql),
    updatedAt: text("updated_at").notNull().default(nowSql),
    lastLoginAt: text("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    // Exactly one owner may exist. Ownership transfer is not supported.
    uniqueIndex("users_single_owner")
      .on(table.role)
      .where(sql`${table.role} = 'owner'`),
    index("users_role_idx").on(table.role),
    index("users_active_idx").on(table.isActive),
    index("users_created_at_idx").on(table.createdAt),
    check("users_role_check", sql`${table.role} in ('owner', 'admin', 'employee')`),
    check(
      "users_email_lowercase_check",
      sql`${table.email} = lower(${table.email})`,
    ),
    check(
      "users_full_name_length_check",
      sql`length(${table.fullName}) between 1 and 120`,
    ),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(nowSql),
    lastActivityAt: text("last_activity_at").notNull().default(nowSql),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    ipAddress: text("ip_address"),
    createdAt: text("created_at").notNull().default(nowSql),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    check(
      "audit_logs_metadata_json_check",
      sql`${table.metadata} is null or json_valid(${table.metadata})`,
    ),
  ],
);

/**
 * Persistent login throttling. Kept separate from audit logs so the security
 * audit trail can be retained while old throttling records are pruned.
 */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    ipAddress: text("ip_address"),
    success: integer("success", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(nowSql),
  },
  (table) => [
    index("login_attempts_email_created_idx").on(
      table.email,
      table.createdAt,
    ),
    index("login_attempts_ip_created_idx").on(
      table.ipAddress,
      table.createdAt,
    ),
    index("login_attempts_created_at_idx").on(table.createdAt),
  ],
);

export const appSettings = sqliteTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull().default(nowSql),
    updatedBy: text("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("app_settings_updated_by_idx").on(table.updatedBy)],
);

const customerTypeSql = sql.raw(
  CUSTOMER_TYPES.map((type) => `'${type}'`).join(", "),
);
const customerStatusSql = sql.raw(
  CUSTOMER_STATUSES.map((status) => `'${status}'`).join(", "),
);
const customerActivityTypeSql = sql.raw(
  CUSTOMER_ACTIVITY_TYPES.map((type) => `'${type}'`).join(", "),
);

/**
 * Atomic, database-backed sequence for human-readable customer numbers.
 * Numbers are never reused, even after a customer is archived.
 */
export const customerNumberSequence = sqliteTable("customer_number_sequence", {
  key: text("key").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(nowSql),
});

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    customerNumber: text("customer_number").notNull(),
    type: text("type", { enum: CUSTOMER_TYPES }).notNull().default("individual"),
    name: text("name").notNull(),
    businessName: text("business_name"),
    /** Normalized for potential business-name duplicate detection. */
    businessNameNormalized: text("business_name_normalized"),
    phone: text("phone").notNull(),
    phoneNormalized: text("phone_normalized").notNull(),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    website: text("website"),
    industry: text("industry"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    district: text("district"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country").default("India"),
    gstin: text("gstin"),
    notes: text("notes"),
    source: text("source"),
    status: text("status", { enum: CUSTOMER_STATUSES })
      .notNull()
      .default("active"),
    statusBeforeArchive: text("status_before_archive", {
      enum: CUSTOMER_STATUSES,
    }),
    archivedAt: text("archived_at"),
    assignedTo: text("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(nowSql),
    updatedAt: text("updated_at").notNull().default(nowSql),
  },
  (table) => [
    uniqueIndex("customers_customer_number_unique").on(table.customerNumber),
    index("customers_phone_normalized_idx").on(table.phoneNormalized),
    index("customers_email_normalized_idx").on(table.emailNormalized),
    index("customers_business_name_normalized_idx").on(
      table.businessNameNormalized,
    ),
    index("customers_status_idx").on(table.status),
    index("customers_type_idx").on(table.type),
    index("customers_assigned_to_idx").on(table.assignedTo),
    index("customers_created_by_idx").on(table.createdBy),
    index("customers_created_at_idx").on(table.createdAt),
    index("customers_updated_at_idx").on(table.updatedAt),
    index("customers_archived_at_idx").on(table.archivedAt),
    index("customers_city_idx").on(table.city),
    index("customers_state_idx").on(table.state),
    index("customers_gstin_idx").on(table.gstin),
    check("customers_type_check", sql`${table.type} in (${customerTypeSql})`),
    check(
      "customers_status_check",
      sql`${table.status} in (${customerStatusSql})`,
    ),
    check(
      "customers_name_length_check",
      sql`length(${table.name}) between 1 and 160`,
    ),
    check(
      "customers_phone_length_check",
      sql`length(${table.phoneNormalized}) between 5 and 20`,
    ),
    check(
      "customers_email_lowercase_check",
      sql`${table.email} is null or ${table.email} = lower(${table.email})`,
    ),
    check(
      "customers_archived_at_check",
      sql`(${table.status} = 'archived' and ${table.archivedAt} is not null) or (${table.status} != 'archived' and ${table.archivedAt} is null)`,
    ),
  ],
);

export const customerContacts = sqliteTable(
  "customer_contacts",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(nowSql),
    updatedAt: text("updated_at").notNull().default(nowSql),
  },
  (table) => [
    index("customer_contacts_customer_id_idx").on(table.customerId),
    index("customer_contacts_phone_normalized_idx").on(table.phoneNormalized),
    index("customer_contacts_email_normalized_idx").on(table.emailNormalized),
    index("customer_contacts_primary_idx").on(
      table.customerId,
      table.isPrimary,
    ),
    // At most one primary contact per customer, enforced by the database.
    uniqueIndex("customer_contacts_primary_unique")
      .on(table.customerId)
      .where(sql`${table.isPrimary} = 1`),
    check(
      "customer_contacts_full_name_length_check",
      sql`length(${table.fullName}) between 1 and 160`,
    ),
    check(
      "customer_contacts_email_lowercase_check",
      sql`${table.email} is null or ${table.email} = lower(${table.email})`,
    ),
    check(
      "customer_contacts_phone_length_check",
      sql`${table.phoneNormalized} is null or length(${table.phoneNormalized}) between 5 and 20`,
    ),
  ],
);

const pipelineStageSql = sql.raw(
  PIPELINE_STAGES.map((stage) => `'${stage}'`).join(", "),
);
const contactStatusSql = sql.raw(
  CONTACT_STATUSES.map((status) => `'${status}'`).join(", "),
);
const leadPrioritySql = sql.raw(
  LEAD_PRIORITIES.map((priority) => `'${priority}'`).join(", "),
);
const leadSourceSql = sql.raw(
  LEAD_SOURCES.map((source) => `'${source.replace(/'/g, "''")}'`).join(", "),
);
const activityTypeSql = sql.raw(
  ACTIVITY_TYPES.map((type) => `'${type}'`).join(", "),
);
const followUpStatusSql = sql.raw(
  FOLLOW_UP_STATUSES.map((status) => `'${status}'`).join(", "),
);

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    leadNumber: text("lead_number").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    /**
     * Digits-only representation used for duplicate detection and search.
     * The display value remains in `phone`.
     */
    phoneNormalized: text("phone_normalized").notNull(),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    businessName: text("business_name"),
    location: text("location"),
    serviceInterest: text("service_interest"),
    serviceCategory: text("service_category"),
    source: text("source", { enum: LEAD_SOURCES }).notNull(),
    pipelineStage: text("pipeline_stage", { enum: PIPELINE_STAGES })
      .notNull()
      .default("new"),
    contactStatus: text("contact_status", { enum: CONTACT_STATUSES })
      .notNull()
      .default("not_contacted"),
    assignedTo: text("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    estimatedValue: real("estimated_value"),
    priority: text("priority", { enum: LEAD_PRIORITIES })
      .notNull()
      .default("medium"),
    description: text("description"),
    lostReason: text("lost_reason"),
    nextFollowUpAt: text("next_follow_up_at"),
    lastContactedAt: text("last_contacted_at"),
    convertedAt: text("converted_at"),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    convertedToCustomerAt: text("converted_to_customer_at"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(nowSql),
    updatedAt: text("updated_at").notNull().default(nowSql),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("leads_lead_number_unique").on(table.leadNumber),
    index("leads_phone_normalized_idx").on(table.phoneNormalized),
    index("leads_email_normalized_idx").on(table.emailNormalized),
    index("leads_customer_id_idx").on(table.customerId),
    index("leads_converted_to_customer_at_idx").on(
      table.convertedToCustomerAt,
    ),
    index("leads_pipeline_stage_idx").on(table.pipelineStage),
    index("leads_contact_status_idx").on(table.contactStatus),
    index("leads_assigned_to_idx").on(table.assignedTo),
    index("leads_next_follow_up_at_idx").on(table.nextFollowUpAt),
    index("leads_created_at_idx").on(table.createdAt),
    index("leads_source_idx").on(table.source),
    index("leads_service_interest_idx").on(table.serviceInterest),
    index("leads_priority_idx").on(table.priority),
    index("leads_deleted_at_idx").on(table.deletedAt),
    index("leads_assigned_stage_idx").on(
      table.assignedTo,
      table.pipelineStage,
    ),
    check(
      "leads_pipeline_stage_check",
      sql`${table.pipelineStage} in (${pipelineStageSql})`,
    ),
    check(
      "leads_contact_status_check",
      sql`${table.contactStatus} in (${contactStatusSql})`,
    ),
    check(
      "leads_priority_check",
      sql`${table.priority} in (${leadPrioritySql})`,
    ),
    check("leads_source_check", sql`${table.source} in (${leadSourceSql})`),
    check(
      "leads_estimated_value_check",
      sql`${table.estimatedValue} is null or ${table.estimatedValue} >= 0`,
    ),
    check(
      "leads_name_length_check",
      sql`length(${table.name}) between 1 and 160`,
    ),
    check(
      "leads_phone_length_check",
      sql`length(${table.phoneNormalized}) between 5 and 20`,
    ),
  ],
);

export const leadActivities = sqliteTable(
  "lead_activities",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    activityType: text("activity_type", { enum: ACTIVITY_TYPES }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    previousStage: text("previous_stage", { enum: PIPELINE_STAGES }),
    newStage: text("new_stage", { enum: PIPELINE_STAGES }),
    createdAt: text("created_at").notNull().default(nowSql),
  },
  (table) => [
    index("lead_activities_lead_id_idx").on(table.leadId),
    index("lead_activities_user_id_idx").on(table.userId),
    index("lead_activities_created_at_idx").on(table.createdAt),
    index("lead_activities_type_idx").on(table.activityType),
    index("lead_activities_lead_created_idx").on(
      table.leadId,
      table.createdAt,
    ),
    check(
      "lead_activities_type_check",
      sql`${table.activityType} in (${activityTypeSql})`,
    ),
    check(
      "lead_activities_previous_stage_check",
      sql`${table.previousStage} is null or ${table.previousStage} in (${pipelineStageSql})`,
    ),
    check(
      "lead_activities_new_stage_check",
      sql`${table.newStage} is null or ${table.newStage} in (${pipelineStageSql})`,
    ),
  ],
);

export const leadFollowUps = sqliteTable(
  "lead_follow_ups",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    assignedTo: text("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    notes: text("notes"),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status", { enum: FOLLOW_UP_STATUSES })
      .notNull()
      .default("pending"),
    completedAt: text("completed_at"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(nowSql),
    updatedAt: text("updated_at").notNull().default(nowSql),
  },
  (table) => [
    index("lead_follow_ups_lead_id_idx").on(table.leadId),
    index("lead_follow_ups_assigned_to_idx").on(table.assignedTo),
    index("lead_follow_ups_scheduled_at_idx").on(table.scheduledAt),
    index("lead_follow_ups_status_idx").on(table.status),
    index("lead_follow_ups_status_scheduled_idx").on(
      table.status,
      table.scheduledAt,
    ),
    index("lead_follow_ups_created_by_idx").on(table.createdBy),
    check(
      "lead_follow_ups_status_check",
      sql`${table.status} in (${followUpStatusSql})`,
    ),
    check(
      "lead_follow_ups_title_length_check",
      sql`length(${table.title}) between 1 and 200`,
    ),
    check(
      "lead_follow_ups_completed_at_check",
      sql`${table.status} != 'completed' or ${table.completedAt} is not null`,
    ),
  ],
);

export const customerActivities = sqliteTable(
  "customer_activities",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    activityType: text("activity_type", {
      enum: CUSTOMER_ACTIVITY_TYPES,
    }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** JSON metadata preserving previous values and link context. */
    metadata: text("metadata"),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => customerContacts.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(nowSql),
  },
  (table) => [
    index("customer_activities_customer_id_idx").on(table.customerId),
    index("customer_activities_user_id_idx").on(table.userId),
    index("customer_activities_type_idx").on(table.activityType),
    index("customer_activities_created_at_idx").on(table.createdAt),
    index("customer_activities_customer_created_idx").on(
      table.customerId,
      table.createdAt,
    ),
    index("customer_activities_lead_id_idx").on(table.leadId),
    check(
      "customer_activities_type_check",
      sql`${table.activityType} in (${customerActivityTypeSql})`,
    ),
    check(
      "customer_activities_metadata_json_check",
      sql`${table.metadata} is null or json_valid(${table.metadata})`,
    ),
    check(
      "customer_activities_title_length_check",
      sql`length(${table.title}) between 1 and 200`,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;
export type LoginAttemptRow = typeof loginAttempts.$inferSelect;
export type AppSettingRow = typeof appSettings.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type LeadActivityRow = typeof leadActivities.$inferSelect;
export type NewLeadActivityRow = typeof leadActivities.$inferInsert;
export type LeadFollowUpRow = typeof leadFollowUps.$inferSelect;
export type NewLeadFollowUpRow = typeof leadFollowUps.$inferInsert;
export type CustomerRow = typeof customers.$inferSelect;
export type NewCustomerRow = typeof customers.$inferInsert;
export type CustomerContactRow = typeof customerContacts.$inferSelect;
export type NewCustomerContactRow = typeof customerContacts.$inferInsert;
export type CustomerActivityRow = typeof customerActivities.$inferSelect;
export type NewCustomerActivityRow = typeof customerActivities.$inferInsert;
export type CustomerNumberSequenceRow =
  typeof customerNumberSequence.$inferSelect;
