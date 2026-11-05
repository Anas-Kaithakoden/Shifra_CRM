export const TASK_TYPES = [
  "internal",
  "follow_up",
  "call",
  "meeting",
  "email",
  "review",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  internal: "Internal Task",
  follow_up: "Follow-up",
  call: "Phone Call",
  meeting: "Meeting",
  email: "Email",
  review: "Review",
};

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const RECURRENCE_TYPES = [
  "daily",
  "weekly",
  "monthly",
  "custom",
] as const;

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export const REMINDER_MINUTES_OPTIONS = [
  { value: 0, label: "At time of event" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
] as const;

export const TASK_ACTIVITY_TYPES = [
  "created",
  "updated",
  "assigned",
  "rescheduled",
  "completed",
  "reopened",
  "cancelled",
] as const;

export type TaskActivityType = (typeof TASK_ACTIVITY_TYPES)[number];

export const TASK_ACTIVITY_TYPE_LABELS: Record<TaskActivityType, string> = {
  created: "Task created",
  updated: "Task updated",
  assigned: "Task assigned",
  rescheduled: "Task rescheduled",
  completed: "Task completed",
  reopened: "Task reopened",
  cancelled: "Task cancelled",
};
