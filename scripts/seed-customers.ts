import type {
  CustomerStatus,
  CustomerType,
} from "../src/shared/constants/customers";
import { normalizeEmail, normalizePhone } from "../src/server/lib/phone";
import { runD1File, runD1Query, sqlJson, sqlString } from "./d1";

/**
 * Local-only demo data for the Customer Management module.
 *
 * The records use deterministic IDs and high customer numbers (SN-CUS-9001 to
 * SN-CUS-9006) so re-running the script can refresh them without colliding with
 * customers created through the application. The customer number sequence is
 * advanced past the demo range so newly created customers stay sequential.
 */

type SeedRole = "owner" | "admin" | "employee";

interface SeedUser {
  id: string;
  fullName: string;
  email: string;
  role: SeedRole;
}

interface SeedActivity {
  type:
    | "call"
    | "whatsapp"
    | "email"
    | "meeting"
    | "note"
    | "note_added"
    | "lead_linked"
    | "lead_converted"
    | "customer_archived";
  title: string;
  description?: string;
  daysAgo: number;
  user: SeedRole;
}

interface SeedContact {
  fullName: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  notes?: string;
}

interface SeedCustomer {
  key: string;
  customerNumber: string;
  type: CustomerType;
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  website?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  status: CustomerStatus;
  statusBeforeArchive?: CustomerStatus;
  archivedDaysAgo?: number;
  assignedTo: SeedRole;
  createdBy: SeedRole;
  createdDaysAgo: number;
  leadId?: string;
  contacts: SeedContact[];
  activities: SeedActivity[];
}

const SEED_USER_EMAILS = [
  "owner@shifranuha.dev",
  "admin@shifranuha.dev",
  "employee@shifranuha.dev",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const isoDaysAgo = (days: number): string =>
  new Date(now - days * DAY_MS).toISOString();

const seedLeadId = (index: number): string =>
  `1d000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

const SEED_CUSTOMERS: SeedCustomer[] = [
  {
    key: "brightline",
    customerNumber: "SN-CUS-9001",
    type: "business",
    name: "Priya Menon",
    businessName: "Brightline Interiors",
    phone: "+91 98470 22118",
    email: "priya@brightlineinteriors.in",
    website: "https://brightlineinteriors.in",
    addressLine1: "42 Marine Drive",
    city: "Kochi",
    state: "Kerala",
    postalCode: "682031",
    country: "India",
    notes:
      "Prefers calls after 5 pm. The partner reviews all website decisions before work starts.",
    status: "active",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 12,
    leadId: seedLeadId(0),
    contacts: [
      {
        fullName: "Priya Menon",
        jobTitle: "Founder",
        phone: "+91 98470 22118",
        email: "priya@brightlineinteriors.in",
        isPrimary: true,
        notes: "Main decision maker for the website refresh.",
      },
      {
        fullName: "Arun Menon",
        jobTitle: "Business Partner",
        phone: "+91 98470 22119",
        email: "arun@brightlineinteriors.in",
        isPrimary: false,
      },
    ],
    activities: [
      {
        type: "call",
        title: "Discovery call completed",
        description:
          "Reviewed the current website, portfolio structure and enquiry flow.",
        daysAgo: 10,
        user: "employee",
      },
      {
        type: "meeting",
        title: "Studio visit and content review",
        description:
          "Reviewed project photography and shortlisted portfolio categories.",
        daysAgo: 8,
        user: "employee",
      },
      {
        type: "note_added",
        title: "Partner review scheduled",
        description:
          "Priya will review the proposal with Arun before the next call.",
        daysAgo: 3,
        user: "employee",
      },
    ],
  },
  {
    key: "paper-lantern",
    customerNumber: "SN-CUS-9002",
    type: "business",
    name: "Sana Khan",
    businessName: "The Paper Lantern",
    phone: "+91 98711 66230",
    email: "sana@thepaperlantern.in",
    website: "https://thepaperlantern.in",
    addressLine1: "18 Hauz Khas Village",
    city: "New Delhi",
    state: "Delhi",
    postalCode: "110016",
    country: "India",
    notes:
      "Full identity refresh won from a walk-in enquiry. Advance payment received; delivery team owns the rollout.",
    status: "active",
    assignedTo: "admin",
    createdBy: "admin",
    createdDaysAgo: 22,
    leadId: seedLeadId(6),
    contacts: [
      {
        fullName: "Sana Khan",
        jobTitle: "Owner",
        phone: "+91 98711 66230",
        email: "sana@thepaperlantern.in",
        isPrimary: true,
      },
    ],
    activities: [
      {
        type: "meeting",
        title: "Brand workshop at the studio",
        description:
          "Mapped the brand story, stationery range and packaging touchpoints.",
        daysAgo: 18,
        user: "admin",
      },
      {
        type: "lead_converted",
        title: "Won lead converted to customer",
        description:
          "Brand identity project won and the advance payment was received.",
        daysAgo: 6,
        user: "admin",
      },
      {
        type: "note_added",
        title: "Project handover scheduled",
        description:
          "Delivery team to take over after the signed scope is filed.",
        daysAgo: 5,
        user: "admin",
      },
    ],
  },
  {
    key: "rao-consulting",
    customerNumber: "SN-CUS-9003",
    type: "business",
    name: "Lakshmi Rao",
    businessName: "Rao Consulting",
    phone: "+91 98860 73204",
    email: "lakshmi@raoconsulting.in",
    website: "https://raoconsulting.in",
    addressLine1: "7 Banjara Hills Road No. 12",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500034",
    country: "India",
    notes:
      "Long-term registration client. Prefers email updates and quarterly check-ins.",
    status: "active",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 40,
    leadId: seedLeadId(14),
    contacts: [
      {
        fullName: "Lakshmi Rao",
        jobTitle: "Managing Partner",
        phone: "+91 98860 73204",
        email: "lakshmi@raoconsulting.in",
        isPrimary: true,
        notes: "Primary contact for compliance and registration work.",
      },
    ],
    activities: [
      {
        type: "call",
        title: "Registration scope confirmed",
        description:
          "Confirmed the two-partner LLP structure and document checklist.",
        daysAgo: 30,
        user: "employee",
      },
      {
        type: "lead_converted",
        title: "Won lead converted to customer",
        description:
          "LLP registration completed and the final invoice was settled.",
        daysAgo: 20,
        user: "employee",
      },
      {
        type: "email",
        title: "Registration documents archived",
        description:
          "Sent the final registration pack to the client and filed a copy.",
        daysAgo: 18,
        user: "employee",
      },
      {
        type: "note_added",
        title: "Quarterly check-in due next month",
        description: "Ask whether any compliance support is needed this quarter.",
        daysAgo: 14,
        user: "employee",
      },
    ],
  },
  {
    key: "nova-dental",
    customerNumber: "SN-CUS-9004",
    type: "business",
    name: "Karan Patel",
    businessName: "Nova Dental Clinic",
    phone: "+91 97250 33409",
    email: "karan@novadentalclinic.com",
    addressLine1: "12 Satellite Road",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380015",
    country: "India",
    notes:
      "Website enquiry is paused while the clinic opens its second location. Revisit after the launch.",
    status: "inactive",
    assignedTo: "admin",
    createdBy: "admin",
    createdDaysAgo: 4,
    leadId: seedLeadId(3),
    contacts: [
      {
        fullName: "Karan Patel",
        jobTitle: "Clinic Director",
        phone: "+91 97250 33409",
        email: "karan@novadentalclinic.com",
        isPrimary: true,
      },
    ],
    activities: [
      {
        type: "call",
        title: "Missed callback",
        description:
          "No answer. Left a voicemail and sent a WhatsApp follow-up.",
        daysAgo: 2,
        user: "admin",
      },
      {
        type: "note_added",
        title: "Enquiry paused until the second clinic opens",
        description:
          "Karan asked us to reconnect after the new location launch.",
        daysAgo: 1,
        user: "admin",
      },
    ],
  },
  {
    key: "singh-motors",
    customerNumber: "SN-CUS-9005",
    type: "business",
    name: "Vikram Singh",
    businessName: "Singh Motors",
    phone: "+91 98110 40786",
    email: "vikram@singhmotors.in",
    addressLine1: "GT Road Industrial Area",
    city: "Ludhiana",
    state: "Punjab",
    postalCode: "141003",
    country: "India",
    notes:
      "Service-centre workflow enquiry. A site walkthrough is planned before the proposal.",
    status: "active",
    assignedTo: "owner",
    createdBy: "owner",
    createdDaysAgo: 5,
    leadId: seedLeadId(7),
    contacts: [
      {
        fullName: "Vikram Singh",
        jobTitle: "Managing Director",
        phone: "+91 98110 40786",
        email: "vikram@singhmotors.in",
        isPrimary: true,
      },
      {
        fullName: "Harpreet Kaur",
        jobTitle: "Service Manager",
        phone: "+91 98110 40787",
        email: "harpreet@singhmotors.in",
        isPrimary: false,
        notes: "Day-to-day contact for job cards and parts inventory.",
      },
    ],
    activities: [
      {
        type: "call",
        title: "Technical scoping call",
        description:
          "Mapped job-card workflow, parts catalogue and reporting requirements.",
        daysAgo: 2,
        user: "owner",
      },
      {
        type: "meeting",
        title: "On-site workflow walkthrough",
        description:
          "Visited the service centre with the workflow questionnaire.",
        daysAgo: 1,
        user: "owner",
      },
    ],
  },
  {
    key: "gupta-textiles",
    customerNumber: "SN-CUS-9006",
    type: "business",
    name: "Rohan Gupta",
    businessName: "Gupta Textiles",
    phone: "+91 98300 55124",
    email: "rohan@guptatextiles.in",
    addressLine1: "27 Burrabazar Main Road",
    city: "Kolkata",
    state: "West Bengal",
    postalCode: "700007",
    country: "India",
    notes:
      "GST support enquiry lost to an in-house accountant. Archived after the decision; history retained.",
    status: "archived",
    statusBeforeArchive: "inactive",
    archivedDaysAgo: 8,
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 18,
    leadId: seedLeadId(5),
    contacts: [
      {
        fullName: "Rohan Gupta",
        jobTitle: "Proprietor",
        phone: "+91 98300 55124",
        email: "rohan@guptatextiles.in",
        isPrimary: true,
      },
    ],
    activities: [
      {
        type: "call",
        title: "Requirement call",
        description:
          "Discussed GST registration and first-year filing support.",
        daysAgo: 15,
        user: "employee",
      },
      {
        type: "note_added",
        title: "Client chose an in-house accountant",
        description:
          "The enquiry was lost before a proposal was accepted. Keep the record for history.",
        daysAgo: 10,
        user: "employee",
      },
      {
        type: "customer_archived",
        title: "Customer archived",
        description: "Archived after the enquiry was formally closed.",
        daysAgo: 8,
        user: "employee",
      },
    ],
  },
];

function fail(message: string): never {
  throw new Error(message);
}

function ensureCustomerTablesExist(): void {
  const rows = runD1Query<{ name: string }>(
    [
      "SELECT name FROM sqlite_master WHERE type = 'table'",
      "AND name IN ('customers', 'customer_contacts', 'customer_activities',",
      "'customer_number_sequence');",
    ].join(" "),
    { local: true },
  );

  if (rows.length < 4) {
    fail(
      [
        "The customer tables do not exist in the local D1 database.",
        "Apply migrations first:",
        "  npm run db:migrate:local",
      ].join("\n"),
    );
  }
}

function loadSeedUsers(): Map<SeedRole, SeedUser> {
  const emailList = SEED_USER_EMAILS.map((email) => sqlString(email)).join(", ");
  const rows = runD1Query<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>(
    `SELECT id, full_name, email, role FROM users WHERE email IN (${emailList});`,
    { local: true },
  );

  const byRole = new Map<SeedRole, SeedUser>();
  for (const row of rows) {
    if (
      row.role === "owner" ||
      row.role === "admin" ||
      row.role === "employee"
    ) {
      byRole.set(row.role, {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
      });
    }
  }

  if (byRole.size < 3) {
    fail(
      [
        "The development seed users are missing.",
        "Run the base seed first:",
        "  npm run db:seed",
      ].join("\n"),
    );
  }

  return byRole;
}

function customerId(index: number): string {
  return `c0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function contactId(index: number): string {
  return `cc000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function activityId(index: number): string {
  return `ca000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function auditId(index: number): string {
  return `ae000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function normalizeBusinessName(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalized.length >= 2 ? normalized : null;
}

function nullable(value: string | null | undefined): string {
  return value === null || value === undefined ? "NULL" : sqlString(value);
}

function userIdFor(
  users: Map<SeedRole, SeedUser>,
  role: SeedRole,
): string {
  const user = users.get(role);
  if (!user) {
    throw new Error(`Missing seed user for role: ${role}`);
  }
  return user.id;
}

function main(): void {
  if (process.argv.includes("--remote")) {
    fail(
      "The customer demo seed is local-only. It refuses to write to a remote database.",
    );
  }

  ensureCustomerTablesExist();
  const users = loadSeedUsers();
  const customerIds = SEED_CUSTOMERS.map((_, index) => customerId(index));
  const customerIdList = customerIds.map((id) => sqlString(id)).join(", ");
  const statements: string[] = [];

  // Refresh only this script's deterministic demo rows. Customers created
  // through the application are never touched. Clear lead links first because
  // SQLite's ALTER TABLE cannot add the customer FK with ON DELETE SET NULL.
  statements.push(
    `UPDATE leads SET customer_id = NULL, converted_to_customer_at = NULL WHERE customer_id IN (${customerIdList});`,
  );
  statements.push(`DELETE FROM customers WHERE id IN (${customerIdList});`);
  statements.push(
    `DELETE FROM audit_logs WHERE id LIKE 'ae000000-0000-4000-8000-%';`,
  );

  let contactCounter = 0;
  let activityCounter = 0;
  let auditCounter = 0;

  SEED_CUSTOMERS.forEach((customer, customerIndex) => {
    const id = customerId(customerIndex);
    const createdAt = isoDaysAgo(customer.createdDaysAgo);
    const archivedAt =
      customer.archivedDaysAgo === undefined
        ? null
        : isoDaysAgo(customer.archivedDaysAgo);
    const updatedAt = archivedAt ?? createdAt;
    const phone = normalizePhone(customer.phone);
    const email = customer.email ? normalizeEmail(customer.email) : null;

    statements.push(
      [
        "INSERT INTO customers (",
        "  id, customer_number, type, name, business_name,",
        "  business_name_normalized, phone, phone_normalized, email,",
        "  email_normalized, website, address_line1, address_line2, city,",
        "  state, postal_code, country, notes, status, status_before_archive,",
        "  archived_at, assigned_to, created_by, created_at, updated_at",
        ") VALUES (",
        [
          sqlString(id),
          sqlString(customer.customerNumber),
          sqlString(customer.type),
          sqlString(customer.name),
          nullable(customer.businessName),
          nullable(normalizeBusinessName(customer.businessName)),
          sqlString(phone.display),
          sqlString(phone.normalized),
          nullable(email),
          nullable(email),
          nullable(customer.website),
          nullable(customer.addressLine1),
          "NULL",
          nullable(customer.city),
          nullable(customer.state),
          nullable(customer.postalCode),
          nullable(customer.country),
          nullable(customer.notes),
          sqlString(customer.status),
          nullable(customer.statusBeforeArchive),
          nullable(archivedAt),
          sqlString(userIdFor(users, customer.assignedTo)),
          sqlString(userIdFor(users, customer.createdBy)),
          sqlString(createdAt),
          sqlString(updatedAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    const primaryContact = customer.contacts.find((contact) => contact.isPrimary);

    customer.contacts.forEach((contact) => {
      const contactKey = contactId(++contactCounter);
      const contactPhone = contact.phone ? normalizePhone(contact.phone) : null;
      const contactEmail = contact.email ? normalizeEmail(contact.email) : null;
      statements.push(
        [
          "INSERT INTO customer_contacts (",
          "  id, customer_id, full_name, job_title, phone, phone_normalized,",
          "  email, email_normalized, is_primary, notes, created_by,",
          "  created_at, updated_at",
          ") VALUES (",
          [
            sqlString(contactKey),
            sqlString(id),
            sqlString(contact.fullName),
            nullable(contact.jobTitle),
            nullable(contactPhone?.display),
            nullable(contactPhone?.normalized),
            nullable(contactEmail),
            nullable(contactEmail),
            contact.isPrimary ? "1" : "0",
            nullable(contact.notes),
            sqlString(userIdFor(users, customer.createdBy)),
            sqlString(createdAt),
            sqlString(createdAt),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    });

    const createdActivityKey = activityId(++activityCounter);
    statements.push(
      [
        "INSERT INTO customer_activities (",
        "  id, customer_id, user_id, activity_type, title, description,",
        "  metadata, lead_id, contact_id, created_at",
        ") VALUES (",
        [
          sqlString(createdActivityKey),
          sqlString(id),
          sqlString(userIdFor(users, customer.createdBy)),
          "'customer_created'",
          "'Customer created'",
          nullable(customer.businessName ?? customer.name),
          sqlJson({ seeded: true }),
          "NULL",
          "NULL",
          sqlString(createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    if (primaryContact) {
      const contactActivityKey = activityId(++activityCounter);
      statements.push(
        [
          "INSERT INTO customer_activities (",
          "  id, customer_id, user_id, activity_type, title, description,",
          "  metadata, lead_id, contact_id, created_at",
          ") VALUES (",
          [
            sqlString(contactActivityKey),
            sqlString(id),
            sqlString(userIdFor(users, customer.createdBy)),
            "'contact_added'",
            sqlString(`Primary contact added: ${primaryContact.fullName}`),
            nullable(primaryContact.phone),
            sqlJson({ seeded: true, isPrimary: true }),
            "NULL",
            "NULL",
            sqlString(createdAt),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    }

    for (const activity of customer.activities) {
      const activityKey = activityId(++activityCounter);
      const createdAtValue = isoDaysAgo(activity.daysAgo);
      const linkedLeadId =
        activity.type === "lead_linked" || activity.type === "lead_converted"
          ? customer.leadId
          : undefined;
      statements.push(
        [
          "INSERT INTO customer_activities (",
          "  id, customer_id, user_id, activity_type, title, description,",
          "  metadata, lead_id, contact_id, created_at",
          ") VALUES (",
          [
            sqlString(activityKey),
            sqlString(id),
            sqlString(userIdFor(users, activity.user)),
            sqlString(activity.type),
            sqlString(activity.title),
            nullable(activity.description),
            sqlJson({ seeded: true }),
            nullable(linkedLeadId),
            "NULL",
            sqlString(createdAtValue),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    }

    const createdAuditKey = auditId(++auditCounter);
    statements.push(
      [
        "INSERT INTO audit_logs (",
        "  id, user_id, action, entity_type, entity_id, metadata,",
        "  ip_address, created_at",
        ") VALUES (",
        [
          sqlString(createdAuditKey),
          sqlString(userIdFor(users, customer.createdBy)),
          "'customer.created'",
          "'customer'",
          sqlString(id),
          sqlJson({
            customerNumber: customer.customerNumber,
            type: customer.type,
            assignedTo: userIdFor(users, customer.assignedTo),
            seeded: true,
          }),
          "NULL",
          sqlString(createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    if (archivedAt) {
      statements.push(
        [
          "INSERT INTO audit_logs (",
          "  id, user_id, action, entity_type, entity_id, metadata,",
          "  ip_address, created_at",
          ") VALUES (",
          [
            sqlString(auditId(++auditCounter)),
            sqlString(userIdFor(users, customer.createdBy)),
            "'customer.archived'",
            "'customer'",
            sqlString(id),
            sqlJson({
              customerNumber: customer.customerNumber,
              reason: "Demo data: enquiry closed",
              seeded: true,
            }),
            "NULL",
            sqlString(archivedAt),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    }

    if (customer.leadId) {
      statements.push(
        [
          "UPDATE leads SET",
          `  customer_id = ${sqlString(id)},`,
          `  converted_to_customer_at = ${nullable(
            customer.status === "active" &&
              customer.activities.some(
                (activity) => activity.type === "lead_converted",
              )
              ? isoDaysAgo(
                  customer.activities.find(
                    (activity) => activity.type === "lead_converted",
                  )?.daysAgo ?? customer.createdDaysAgo,
                )
              : null,
          )}`,
          `WHERE id = ${sqlString(customer.leadId)} AND customer_id IS NULL;`,
        ].join("\n"),
      );
    }
  });

  // Keep app-created customer numbers ahead of the fixed demo range while
  // preserving any larger value already allocated in this local database.
  statements.push(
    [
      "INSERT INTO customer_number_sequence (key, last_value, updated_at)",
      "VALUES ('customer', 9006, " + sqlString(new Date(now).toISOString()) + ")",
      "ON CONFLICT(key) DO UPDATE SET",
      "  last_value = CASE WHEN last_value < 9006 THEN 9006 ELSE last_value END,",
      "  updated_at = excluded.updated_at;",
    ].join("\n"),
  );

  runD1File(statements.join("\n"), { local: true });

  console.log("");
  console.log("Customer demo data seeded into the LOCAL D1 database.");
  console.log("");
  console.log(`  Customers:    ${SEED_CUSTOMERS.length}`);
  console.log(`  Contacts:     ${contactCounter}`);
  console.log(`  Activities:   ${activityCounter}`);
  console.log(`  Audit events: ${auditCounter}`);
  console.log("");
  console.log("Sign in with one of the development accounts to explore the data:");
  console.log("  owner@shifranuha.dev   / Owner#12345!");
  console.log("  admin@shifranuha.dev   / Admin#12345!");
  console.log("  employee@shifranuha.dev / Employee#12345!");
  console.log("");
  console.log(
    "Re-running this script refreshes only these demo customers; app-created customers are untouched.",
  );
  console.log("These records are for local development only.");
}

try {
  main();
} catch (error) {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Customer demo seed failed.",
  );
  process.exitCode = 1;
}
