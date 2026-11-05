import type { Paginated } from "../../shared/types/api";
import type {
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../../shared/constants/tasks";
import type {
  TaskActivityDto,
  TaskDto,
  TaskStatsDto,
} from "../../shared/types/tasks";
import { apiRequest } from "../lib/api";

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TaskStatus | "overdue" | string;
  priority?: TaskPriority;
  taskType?: TaskType;
  assignedTo?: string;
  leadId?: string;
  customerId?: string;
  dueFrom?: string;
  dueTo?: string;
  scope?: "all" | "my" | "today" | "upcoming" | "overdue" | "follow_up";
  sortBy?: "created_at" | "due_at" | "priority" | "status" | "title";
  sortDir?: "asc" | "desc";
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  taskType?: TaskType;
  priority?: TaskPriority;
  assignedTo?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  dueAt?: string | null;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number | null;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  recurrenceEndAt?: string | null;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  taskType?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  dueAt?: string | null;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number | null;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  recurrenceEndAt?: string | null;
}

export const tasksService = {
  async list(params: TaskListParams = {}): Promise<Paginated<TaskDto>> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.priority) query.set("priority", params.priority);
    if (params.taskType) query.set("taskType", params.taskType);
    if (params.assignedTo) query.set("assignedTo", params.assignedTo);
    if (params.leadId) query.set("leadId", params.leadId);
    if (params.customerId) query.set("customerId", params.customerId);
    if (params.dueFrom) query.set("dueFrom", params.dueFrom);
    if (params.dueTo) query.set("dueTo", params.dueTo);
    if (params.scope) query.set("scope", params.scope);
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.sortDir) query.set("sortDir", params.sortDir);

    const qs = query.toString();
    return apiRequest<Paginated<TaskDto>>(`/tasks${qs ? `?${qs}` : ""}`);
  },

  async get(id: string): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}`);
    return data.task;
  },

  async create(input: TaskCreateInput): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>("/tasks", {
      method: "POST",
      body: input,
    });
    return data.task;
  },

  async update(id: string, input: TaskUpdateInput): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}`, {
      method: "PATCH",
      body: input,
    });
    return data.task;
  },

  async complete(id: string, completedNote?: string): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}/complete`, {
      method: "POST",
      body: completedNote ? { completedNote } : {},
    });
    return data.task;
  },

  async reopen(id: string): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}/reopen`, {
      method: "POST",
    });
    return data.task;
  },

  async cancel(id: string, reason?: string): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}/cancel`, {
      method: "POST",
      body: reason ? { reason } : {},
    });
    return data.task;
  },

  async reschedule(id: string, dueAt: string, reason?: string): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}/reschedule`, {
      method: "POST",
      body: { dueAt, reason },
    });
    return data.task;
  },

  async assign(id: string, assignedTo: string | null): Promise<TaskDto> {
    const data = await apiRequest<{ task: TaskDto }>(`/tasks/${id}/assign`, {
      method: "POST",
      body: { assignedTo },
    });
    return data.task;
  },

  async getActivities(id: string): Promise<TaskActivityDto[]> {
    const data = await apiRequest<{ activities: TaskActivityDto[] }>(
      `/tasks/${id}/activities`,
    );
    return data.activities;
  },

  async getRecentActivities(): Promise<any[]> {
    const data = await apiRequest<{ activities: any[] }>("/tasks/activities");
    return data.activities;
  },

  async getStats(): Promise<TaskStatsDto> {
    return apiRequest<TaskStatsDto>("/dashboard/task-stats");
  },
};
