import { z } from "zod";
import {
  RECURRENCE_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "../../shared/constants/tasks";

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
    .optional()
    .transform((value) => (value ? value : null));

const isoDateTimeSchema = z
  .string()
  .trim()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Choose a valid date and time.",
  );

const nullableIsoDateTimeSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || !Number.isNaN(Date.parse(value)),
    "Choose a valid date and time.",
  );

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a task title.")
    .max(200, "Title is too long."),
  description: nullableTrimmedText(5000, "Description"),
  taskType: z.enum(TASK_TYPES).default("internal"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assignedTo: z.string().trim().uuid("Choose a valid team member.").nullable().optional(),
  leadId: z.string().trim().uuid("Invalid lead ID.").nullable().optional(),
  customerId: z.string().trim().uuid("Invalid customer ID.").nullable().optional(),
  projectId: nullableTrimmedText(100, "Project ID"),
  dueAt: nullableIsoDateTimeSchema,
  reminderEnabled: z.boolean().default(false),
  reminderMinutesBefore: z.coerce.number().int().min(0).max(10080).nullable().optional(),
  recurrenceType: z.enum(RECURRENCE_TYPES).nullable().optional(),
  recurrenceInterval: z.coerce.number().int().min(1).max(365).nullable().optional(),
  recurrenceEndAt: nullableIsoDateTimeSchema,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a task title.").max(200, "Title is too long.").optional(),
    description: nullableTrimmedText(5000, "Description"),
    taskType: z.enum(TASK_TYPES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assignedTo: z.string().trim().uuid("Choose a valid team member.").nullable().optional(),
    leadId: z.string().trim().uuid("Invalid lead ID.").nullable().optional(),
    customerId: z.string().trim().uuid("Invalid customer ID.").nullable().optional(),
    projectId: nullableTrimmedText(100, "Project ID"),
    dueAt: nullableIsoDateTimeSchema,
    reminderEnabled: z.boolean().optional(),
    reminderMinutesBefore: z.coerce.number().int().min(0).max(10080).nullable().optional(),
    recurrenceType: z.enum(RECURRENCE_TYPES).nullable().optional(),
    recurrenceInterval: z.coerce.number().int().min(1).max(365).nullable().optional(),
    recurrenceEndAt: nullableIsoDateTimeSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const rescheduleTaskSchema = z.object({
  dueAt: isoDateTimeSchema,
  reason: optionalTrimmedText(500, "Reschedule reason"),
});

export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;

export const assignTaskSchema = z.object({
  assignedTo: z.string().trim().uuid("Choose a valid team member.").nullable(),
});

export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const completeTaskSchema = z.object({
  completedNote: optionalTrimmedText(1000, "Completion note"),
});

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

export const cancelTaskSchema = z.object({
  reason: optionalTrimmedText(1000, "Cancellation reason"),
});

export type CancelTaskInput = z.infer<typeof cancelTaskSchema>;

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  assignedTo: z.string().trim().uuid().optional(),
  leadId: z.string().trim().uuid().optional(),
  customerId: z.string().trim().uuid().optional(),
  dueFrom: nullableIsoDateTimeSchema,
  dueTo: nullableIsoDateTimeSchema,
  scope: z.enum(["all", "my", "today", "upcoming", "overdue", "follow_up"]).default("all"),
  sortBy: z.enum(["created_at", "due_at", "priority", "status", "title"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
