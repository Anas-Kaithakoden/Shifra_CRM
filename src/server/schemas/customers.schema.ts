import { z } from "zod";
import {
  CUSTOMER_ACTIVITY_TYPES,
  CUSTOMER_SERVICE_CATEGORIES,
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  MANUAL_CUSTOMER_ACTIVITY_TYPES,
} from "../../shared/constants/customers";
import { phoneSchema } from "./leads.schema";

const optionalTrimmedText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .optional()
    .transform((value) => (value ? value : undefined));

const nullableTrimmedText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .nullable()
    .transform((value) => (value ? value : null))
    .optional();

const optionalEmailSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address."))
    .pipe(z.string().max(254, "Email is too long."))
    .optional(),
);

const nullableEmailSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address."))
    .pipe(z.string().max(254, "Email is too long."))
    .nullable()
    .optional(),
);

const optionalPhoneSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  phoneSchema.optional(),
);

const nullablePhoneSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  phoneSchema.nullable().optional(),
);

const isoDateTimeSchema = z.iso.datetime({ offset: true });

const websiteSchema = nullableTrimmedText(300, "Website");
const notesSchema = nullableTrimmedText(5000, "Notes");

function optionalAmountSchema(label: string, minimum?: number) {
  const amount = z.coerce.number().finite();
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    (minimum === undefined
      ? amount
      : amount.min(minimum, `${label} cannot be less than ${minimum}.`)
    ).optional(),
  );
}

function nullableAmountSchema(label: string, minimum?: number) {
  const amount = z.coerce.number().finite();
  return z.preprocess(
    (value) => (value === "" ? null : value),
    (minimum === undefined
      ? amount
      : amount.min(minimum, `${label} cannot be less than ${minimum}.`)
    )
      .nullable()
      .optional(),
  );
}

const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.iso.date().optional(),
);

const nullableDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.iso.date().nullable().optional(),
);

export const createCustomerSchema = z.object({
  type: z.enum(CUSTOMER_TYPES).default("individual"),
  name: z
    .string()
    .trim()
    .min(1, "Enter the customer or contact name.")
    .max(160, "Name is too long."),
  businessName: optionalTrimmedText(160, "Business name"),
  phone: phoneSchema,
  email: optionalEmailSchema,
  website: optionalTrimmedText(300, "Website"),
  industry: optionalTrimmedText(120, "Industry"),
  addressLine1: optionalTrimmedText(200, "Address line 1"),
  addressLine2: optionalTrimmedText(200, "Address line 2"),
  city: optionalTrimmedText(120, "City"),
  district: optionalTrimmedText(120, "District"),
  state: optionalTrimmedText(120, "State"),
  postalCode: optionalTrimmedText(20, "Postal code"),
  country: optionalTrimmedText(120, "Country"),
  gstin: optionalTrimmedText(20, "GSTIN"),
  notes: optionalTrimmedText(5000, "Notes"),
  source: optionalTrimmedText(120, "Source"),
  serviceName: optionalTrimmedText(160, "Service name"),
  serviceCategory: z.enum(CUSTOMER_SERVICE_CATEGORIES).optional(),
  totalCost: optionalAmountSchema("Total cost", 0),
  profit: optionalAmountSchema("Profit"),
  serviceDeliveredOn: optionalDateSchema,
  renewalOn: optionalDateSchema,
  status: z.enum(["active", "inactive"]).default("active"),
  assignedTo: z.uuid("Choose a valid employee.").optional(),
  allowDuplicate: z.boolean().optional(),
});

export const updateCustomerSchema = z
  .object({
    type: z.enum(CUSTOMER_TYPES).optional(),
    name: z
      .string()
      .trim()
      .min(1, "Enter the customer or contact name.")
      .max(160, "Name is too long.")
      .optional(),
    businessName: nullableTrimmedText(160, "Business name"),
    phone: phoneSchema.optional(),
    email: nullableEmailSchema,
    website: websiteSchema,
    industry: nullableTrimmedText(120, "Industry"),
    addressLine1: nullableTrimmedText(200, "Address line 1"),
    addressLine2: nullableTrimmedText(200, "Address line 2"),
    city: nullableTrimmedText(120, "City"),
    district: nullableTrimmedText(120, "District"),
    state: nullableTrimmedText(120, "State"),
    postalCode: nullableTrimmedText(20, "Postal code"),
    country: nullableTrimmedText(120, "Country"),
    gstin: nullableTrimmedText(20, "GSTIN"),
    notes: notesSchema,
    source: nullableTrimmedText(120, "Source"),
    serviceName: nullableTrimmedText(160, "Service name"),
    serviceCategory: z.enum(CUSTOMER_SERVICE_CATEGORIES).nullable().optional(),
    totalCost: nullableAmountSchema("Total cost", 0),
    profit: nullableAmountSchema("Profit"),
    serviceDeliveredOn: nullableDateSchema,
    renewalOn: nullableDateSchema,
    status: z.enum(["active", "inactive"]).optional(),
    assignedTo: z.uuid("Choose a valid employee.").nullable().optional(),
    allowDuplicate: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const createCustomerServiceSchema = z.object({
  serviceName: z
    .string()
    .trim()
    .min(1, "Enter a service name.")
    .max(160, "Service name is too long."),
  serviceCategory: z.enum(CUSTOMER_SERVICE_CATEGORIES).optional(),
  totalCost: optionalAmountSchema("Total cost", 0),
  profit: optionalAmountSchema("Profit"),
  serviceDeliveredOn: optionalDateSchema,
  renewalOn: optionalDateSchema,
});

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
  type: z.enum(CUSTOMER_TYPES).optional(),
  assignedTo: z.uuid("Invalid assigned employee.").optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  scope: z.enum(["all", "my"]).default("all"),
  recent: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sortBy: z.enum(CUSTOMER_SORT_FIELDS).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const duplicateCustomerQuerySchema = z
  .object({
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().max(254).optional(),
    businessName: z.string().trim().max(160).optional(),
    excludeId: z.uuid().optional(),
  })
  .refine(
    (data) => Boolean(data.phone || data.email || data.businessName),
    {
      message: "Provide a phone number, email address or business name.",
    },
  );

export const createCustomerContactSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Enter the contact's name.")
      .max(160, "Name is too long."),
    jobTitle: optionalTrimmedText(120, "Job title"),
    phone: optionalPhoneSchema,
    email: optionalEmailSchema,
    isPrimary: z.boolean().optional().default(false),
    notes: optionalTrimmedText(2000, "Notes"),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: "Enter a phone number or email address for this contact.",
    path: ["phone"],
  });

export const updateCustomerContactSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Enter the contact's name.")
      .max(160, "Name is too long.")
      .optional(),
    jobTitle: nullableTrimmedText(120, "Job title"),
    phone: nullablePhoneSchema,
    email: nullableEmailSchema,
    isPrimary: z.boolean().optional(),
    notes: nullableTrimmedText(2000, "Notes"),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const listCustomerActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  activityType: z.enum(CUSTOMER_ACTIVITY_TYPES).optional(),
});

export const listCustomerRenewalsQuerySchema = z.object({
  filter: z
    .enum(["all", "overdue", "due_soon", "upcoming", "next_30"])
    .default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCustomerActivitySchema = z.object({
  activityType: z.enum(MANUAL_CUSTOMER_ACTIVITY_TYPES),
  title: z
    .string()
    .trim()
    .min(1, "Enter a short title.")
    .max(200, "Title is too long."),
  description: optionalTrimmedText(5000, "Description"),
  occurredAt: isoDateTimeSchema.optional(),
});

export const createCustomerNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Enter a note.")
    .max(5000, "Note is too long."),
});

export const linkCustomerLeadSchema = z.object({
  leadId: z.uuid("Choose a valid lead."),
});

export const convertLeadSchema = z
  .object({
    mode: z.enum(["link", "create"]),
    customerId: z.uuid("Choose a valid customer.").optional(),
    confirmCreate: z.boolean().optional(),
    allowDuplicate: z.boolean().optional(),
    customer: z
      .object({
        type: z.enum(CUSTOMER_TYPES).optional(),
        name: z.string().trim().min(1).max(160).optional(),
        businessName: z.string().trim().max(160).optional(),
        phone: phoneSchema.optional(),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email("Enter a valid email address."))
          .pipe(z.string().max(254))
          .optional(),
        website: z.string().trim().max(300).optional(),
        industry: z.string().trim().max(120).optional(),
        addressLine1: z.string().trim().max(200).optional(),
        addressLine2: z.string().trim().max(200).optional(),
        city: z.string().trim().max(120).optional(),
        district: z.string().trim().max(120).optional(),
        state: z.string().trim().max(120).optional(),
        postalCode: z.string().trim().max(20).optional(),
        country: z.string().trim().max(120).optional(),
        gstin: z.string().trim().max(20).optional(),
        notes: z.string().trim().max(5000).optional(),
        source: z.string().trim().max(120).optional(),
        serviceName: z.string().trim().max(160).optional(),
        serviceCategory: z.enum(CUSTOMER_SERVICE_CATEGORIES).optional(),
        totalCost: optionalAmountSchema("Total cost", 0),
        profit: optionalAmountSchema("Profit"),
        serviceDeliveredOn: optionalDateSchema,
        renewalOn: optionalDateSchema,
        assignedTo: z.uuid("Choose a valid employee.").optional(),
      })
      .optional(),
  })
  .refine((data) => data.mode !== "link" || Boolean(data.customerId), {
    message: "Choose an existing customer to link.",
    path: ["customerId"],
  });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateCustomerServiceInput = z.infer<
  typeof createCustomerServiceSchema
>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type DuplicateCustomerQuery = z.infer<
  typeof duplicateCustomerQuerySchema
>;
export type CreateCustomerContactInput = z.infer<
  typeof createCustomerContactSchema
>;
export type UpdateCustomerContactInput = z.infer<
  typeof updateCustomerContactSchema
>;
export type ListCustomerActivitiesQuery = z.infer<
  typeof listCustomerActivitiesQuerySchema
>;
export type ListCustomerRenewalsQuery = z.infer<
  typeof listCustomerRenewalsQuerySchema
>;
export type CreateCustomerActivityInput = z.infer<
  typeof createCustomerActivitySchema
>;
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;
export type LinkCustomerLeadInput = z.infer<typeof linkCustomerLeadSchema>;
export type ConvertLeadSchemaInput = z.infer<typeof convertLeadSchema>;
