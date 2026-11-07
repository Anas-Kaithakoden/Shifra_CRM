import { z } from "zod";
import {
  ACTIVITY_TYPES,
  CONTACT_STATUSES,
  FOLLOW_UP_STATUSES,
  LEAD_PRIORITIES,
  LEAD_QUICK_FILTERS,
  LEAD_SOURCES,
  MANUAL_ACTIVITY_TYPES,
  PIPELINE_STAGES,
} from "../../shared/constants/leads";
import { SERVICE_OPTIONS } from "../../shared/constants/services";

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

export const phoneSchema = z
  .string()
  .trim()
  .min(5, "Enter a phone number.")
  .max(30, "Phone number is too long.")
  .superRefine((value, ctx) => {
    const allowed = /^[+()\d\s.\-]+$/.test(value);
    const digits = value.replace(/\D/g, "");
    if (!allowed) {
      ctx.addIssue({
        code: "custom",
        message: "Use digits with optional +, spaces, brackets or dashes.",
      });
    }
    if (digits.length < 7) {
      ctx.addIssue({
        code: "custom",
        message: "Enter at least 7 digits.",
      });
    }
    if (digits.length > 15) {
      ctx.addIssue({
        code: "custom",
        message: "Phone numbers cannot exceed 15 digits.",
      });
    }
  });

const serviceInterestSchema = z
  .string()
  .trim()
  .max(160, "Service name is too long.")
  .refine(
    (value) => SERVICE_OPTIONS.some((option) => option.value === value),
    "Choose a service from the catalogue.",
  )
  .optional();

const estimatedValueSchema = z
  .number()
  .nonnegative("Estimated value cannot be negative.")
  .max(1_000_000_000_000, "Estimated value is too large.")
  .nullable()
  .optional();

const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const createLeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the lead's name.")
    .max(160, "Name is too long."),
  phone: phoneSchema,
  email: optionalEmailSchema,
  businessName: optionalTrimmedText(160, "Business name"),
  location: optionalTrimmedText(160, "Location"),
  serviceInterest: serviceInterestSchema,
  source: z.enum(LEAD_SOURCES, "Choose a lead source."),
  estimatedValue: estimatedValueSchema,
  priority: z.enum(LEAD_PRIORITIES).default("medium"),
  assignedTo: z.uuid("Choose a valid employee.").optional(),
  description: optionalTrimmedText(5000, "Description"),
  nextFollowUpAt: isoDateTimeSchema.optional(),
  allowDuplicate: z.boolean().optional(),
});

export const updateLeadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter the lead's name.")
      .max(160, "Name is too long.")
      .optional(),
    phone: phoneSchema.optional(),
    email: nullableEmailSchema,
    businessName: nullableTrimmedText(160, "Business name"),
    location: nullableTrimmedText(160, "Location"),
    serviceInterest: serviceInterestSchema.nullable().optional(),
    source: z.enum(LEAD_SOURCES).optional(),
    estimatedValue: estimatedValueSchema,
    priority: z.enum(LEAD_PRIORITIES).optional(),
    assignedTo: z.uuid("Choose a valid employee.").nullable().optional(),
    description: nullableTrimmedText(5000, "Description"),
    contactStatus: z.enum(CONTACT_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
  contactStatus: z.enum(CONTACT_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  serviceInterest: z.string().trim().max(160).optional(),
  assignedTo: z.uuid("Invalid assigned employee.").optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  quickFilter: z.enum(LEAD_QUICK_FILTERS).default("all"),
  scope: z.enum(["all", "my"]).default("all"),
  sortBy: z.enum(["created_at", "next_follow_up_at"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const pipelineQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  assignedTo: z.uuid("Invalid assigned employee.").optional(),
  scope: z.enum(["all", "my"]).default("all"),
  source: z.enum(LEAD_SOURCES).optional(),
  serviceInterest: z.string().trim().max(160).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  limitPerStage: z.coerce.number().int().min(1).max(200).default(100),
});

export const duplicateLeadQuerySchema = z
  .object({
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().max(254).optional(),
    excludeId: z.uuid().optional(),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: "Provide a phone number or email address to check.",
  });

export const changeStageSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  lostReason: z
    .string()
    .trim()
    .max(1000, "Lost reason is too long.")
    .optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const assignLeadSchema = z.object({
  assignedTo: z.uuid("Choose a valid employee.").nullable(),
});

export const createActivitySchema = z.object({
  activityType: z.enum(MANUAL_ACTIVITY_TYPES),
  title: z
    .string()
    .trim()
    .min(1, "Enter a short title.")
    .max(200, "Title is too long."),
  description: optionalTrimmedText(5000, "Description"),
  contacted: z.boolean().optional(),
  contactStatus: z.enum(CONTACT_STATUSES).optional(),
  occurredAt: isoDateTimeSchema.optional(),
});

export const listActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  activityType: z.enum(ACTIVITY_TYPES).optional(),
});

export const createFollowUpSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a follow-up title.")
    .max(200, "Title is too long."),
  notes: optionalTrimmedText(5000, "Notes"),
  scheduledAt: isoDateTimeSchema,
  assignedTo: z.uuid("Choose a valid employee.").optional(),
  reminderEnabled: z.boolean().default(true),
  reminderMinutesBefore: z.coerce
    .number()
    .int()
    .min(0)
    .max(10080)
    .optional(),
});

export const updateFollowUpSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a follow-up title.")
      .max(200, "Title is too long.")
      .optional(),
    notes: nullableTrimmedText(5000, "Notes"),
    scheduledAt: isoDateTimeSchema.optional(),
    assignedTo: z.uuid("Choose a valid employee.").nullable().optional(),
    reminderEnabled: z.boolean().optional(),
    reminderMinutesBefore: z.coerce
      .number()
      .int()
      .min(0)
      .max(10080)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export const listFollowUpsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  scope: z
    .enum(["all", "today", "upcoming", "overdue", "completed", "cancelled"])
    .default("all"),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
  assignedTo: z.uuid("Invalid assigned employee.").optional(),
  leadId: z.uuid("Invalid lead.").optional(),
  search: z.string().trim().max(120).optional(),
});

export const rescheduleFollowUpSchema = z.object({
  scheduledAt: isoDateTimeSchema,
  reason: optionalTrimmedText(1000, "Reason"),
});

export const completeFollowUpSchema = z.object({
  completedNote: optionalTrimmedText(2000, "Completion note"),
});

export const cancelFollowUpSchema = z.object({
  reason: optionalTrimmedText(1000, "Cancellation reason"),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;
export type DuplicateLeadQuery = z.infer<typeof duplicateLeadQuerySchema>;
export type ChangeStageInput = z.infer<typeof changeStageSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
export type ListFollowUpsQuery = z.infer<typeof listFollowUpsQuerySchema>;
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;
export type CancelFollowUpInput = z.infer<typeof cancelFollowUpSchema>;
