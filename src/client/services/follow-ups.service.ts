import type { Paginated } from "../../shared/types/api";
import type { FollowUpStatus } from "../../shared/constants/leads";
import type { LeadFollowUpDto } from "../../shared/types/leads";
import { apiRequest } from "../lib/api";

export type FollowUpScope =
  | "all"
  | "today"
  | "upcoming"
  | "overdue"
  | "completed"
  | "cancelled";

export interface FollowUpListParams {
  page?: number;
  pageSize?: number;
  scope?: FollowUpScope;
  status?: FollowUpStatus;
  assignedTo?: string;
  leadId?: string;
  search?: string;
}

export interface FollowUpCounts {
  today: number;
  upcoming: number;
  overdue: number;
  completed: number;
}

export interface FollowUpUpdateInput {
  title?: string;
  notes?: string | null;
  scheduledAt?: string;
  assignedTo?: string | null;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
}

function toQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  return searchParams.toString();
}

export const followUpsService = {
  list(params: FollowUpListParams): Promise<Paginated<LeadFollowUpDto>> {
    return apiRequest<Paginated<LeadFollowUpDto>>(
      `/follow-ups?${toQuery({ ...params })}`,
    );
  },

  counts(): Promise<FollowUpCounts> {
    return apiRequest<{ counts: FollowUpCounts }>("/follow-ups/counts").then(
      (result) => result.counts,
    );
  },

  update(id: string, input: FollowUpUpdateInput): Promise<LeadFollowUpDto> {
    return apiRequest<{ followUp: LeadFollowUpDto }>(`/follow-ups/${id}`, {
      method: "PATCH",
      body: input,
    }).then((result) => result.followUp);
  },

  reschedule(id: string, scheduledAt: string): Promise<LeadFollowUpDto> {
    return apiRequest<{ followUp: LeadFollowUpDto }>(
      `/follow-ups/${id}/reschedule`,
      { method: "POST", body: { scheduledAt } },
    ).then((result) => result.followUp);
  },

  complete(id: string, completedNote?: string): Promise<LeadFollowUpDto> {
    return apiRequest<{ followUp: LeadFollowUpDto }>(
      `/follow-ups/${id}/complete`,
      { method: "POST", body: { completedNote } },
    ).then((result) => result.followUp);
  },

  cancel(id: string, reason?: string): Promise<LeadFollowUpDto> {
    return apiRequest<{ followUp: LeadFollowUpDto }>(
      `/follow-ups/${id}/cancel`,
      { method: "POST", body: { reason } },
    ).then((result) => result.followUp);
  },
};
