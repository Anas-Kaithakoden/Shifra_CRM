import type { AuditLogDto, Paginated } from "../../shared/types/api";
import { apiRequest } from "../lib/api";

export interface ListAuditLogsParams {
  page: number;
  pageSize: number;
  action?: string;
}

export const auditService = {
  list(params: ListAuditLogsParams): Promise<Paginated<AuditLogDto>> {
    const searchParams = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    });

    if (params.action) {
      searchParams.set("action", params.action);
    }

    return apiRequest<Paginated<AuditLogDto>>(
      `/audit-logs?${searchParams.toString()}`,
    );
  },
};
