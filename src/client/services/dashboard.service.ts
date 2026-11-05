import type { DashboardStatsDto } from "../../shared/types/api";
import { apiRequest } from "../lib/api";

export const dashboardService = {
  stats(): Promise<DashboardStatsDto> {
    return apiRequest<DashboardStatsDto>("/dashboard/stats");
  },
};
