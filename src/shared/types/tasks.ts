import type {
  RecurrenceType,
  TaskActivityType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../constants/tasks";

export interface TaskDto {
  id: string;
  taskNumber: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  createdBy: string | null;
  leadId: string | null;
  customerId: string | null;
  projectId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number | null;
  reminderSentAt: string | null;
  reminderAttemptedAt: string | null;
  reminderStatus: "pending" | "sent" | "failed" | "skipped";
  reminderError: string | null;
  recurrenceType: RecurrenceType | null;
  recurrenceInterval: number | null;
  recurrenceEndAt: string | null;
  recurrenceGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  assignedUser?: {
    id: string;
    fullName: string;
    email: string;
    role?: string;
  } | null;
  createdByUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  lead?: {
    id: string;
    leadNumber: string;
    name: string;
    phone: string;
    businessName?: string | null;
  } | null;
  customer?: {
    id: string;
    customerNumber: string;
    name: string;
    phone: string;
    businessName?: string | null;
  } | null;
}

export interface TaskActivityDto {
  id: string;
  taskId: string;
  userId: string | null;
  activityType: TaskActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface TaskStatsDto {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  upcomingTasks: number;
  followUpTasks: number;
  byPriority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  scope: "organization" | "personal";
}

export interface TelegramStatusDto {
  configured: boolean;
  status: "configured" | "not_configured" | "error";
  lastSuccessAt: string | null;
  failedCount: number;
  chatIdMasked: string | null;
  botUsername?: string | null;
  error?: string | null;
}
