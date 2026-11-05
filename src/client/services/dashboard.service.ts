import type { DashboardStatsDto } from "../../shared/types/api";
import type { TaskStatsDto } from "../../shared/types/tasks";
import { apiRequest } from "../lib/api";

export const dashboardService = {
  stats(): Promise<DashboardStatsDto> {
    return apiRequest<DashboardStatsDto>("/dashboard/stats");
  },
  taskStats(): Promise<TaskStatsDto> {
    return apiRequest<TaskStatsDto>("/dashboard/task-stats");
  },
};
