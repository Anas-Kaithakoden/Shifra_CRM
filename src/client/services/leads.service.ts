import type { Paginated } from "../../shared/types/api";
import type {
  ContactStatus,
  LeadPriority,
  LeadQuickFilter,
  LeadSource,
  ManualActivityType,
  PipelineStage,
} from "../../shared/constants/leads";
import type {
  DuplicateLeadDto,
  LeadActivityDto,
  LeadDto,
  LeadFollowUpDto,
  LeadListItemDto,
  LeadPipelineDto,
} from "../../shared/types/leads";
import { apiRequest } from "../lib/api";

export interface LeadListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  pipelineStage?: PipelineStage;
  contactStatus?: ContactStatus;
  source?: LeadSource;
  serviceInterest?: string;
  assignedTo?: string;
  priority?: LeadPriority;
  quickFilter?: LeadQuickFilter;
  scope?: "all" | "my";
  sortBy?: "created_at" | "next_follow_up_at";
  sortDir?: "asc" | "desc";
  includeArchived?: boolean;
}

export interface LeadCreateInput {
  name: string;
  phone: string;
  email?: string;
  businessName?: string;
  location?: string;
  serviceInterest?: string;
  source: LeadSource;
  estimatedValue?: number | null;
  priority?: LeadPriority;
  assignedTo?: string;
  description?: string;
  nextFollowUpAt?: string;
  allowDuplicate?: boolean;
}

export interface LeadUpdateInput {
  name?: string;
  phone?: string;
  email?: string | null;
  businessName?: string | null;
  location?: string | null;
  serviceInterest?: string | null;
  source?: LeadSource;
  estimatedValue?: number | null;
  priority?: LeadPriority;
  assignedTo?: string | null;
  description?: string | null;
  contactStatus?: ContactStatus;
}

export interface LeadActivityInput {
  activityType: ManualActivityType;
  title: string;
  description?: string;
  contacted?: boolean;
  contactStatus?: ContactStatus;
  occurredAt?: string;
}

export interface LeadStageInput {
  stage: PipelineStage;
  lostReason?: string;
  reason?: string;
}

export interface LeadFollowUpInput {
  title: string;
  notes?: string;
  scheduledAt: string;
  assignedTo?: string;
}

export interface PipelineParams {
  search?: string;
  assignedTo?: string;
  scope?: "all" | "my";
  source?: LeadSource;
  serviceInterest?: string;
  priority?: LeadPriority;
  limitPerStage?: number;
}

function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  return searchParams.toString();
}

export const leadsService = {
  list(params: LeadListParams): Promise<Paginated<LeadListItemDto>> {
    return apiRequest<Paginated<LeadListItemDto>>(
      `/leads?${toQuery({ ...params })}`,
    );
  },

  get(id: string): Promise<LeadDto> {
    return apiRequest<{ lead: LeadDto }>(`/leads/${id}`).then(
      (result) => result.lead,
    );
  },

  create(input: LeadCreateInput): Promise<LeadDto> {
    return apiRequest<{ lead: LeadDto }>("/leads", {
      method: "POST",
      body: input,
    }).then((result) => result.lead);
  },

  update(id: string, input: LeadUpdateInput): Promise<LeadDto> {
    return apiRequest<{ lead: LeadDto }>(`/leads/${id}`, {
      method: "PATCH",
      body: input,
    }).then((result) => result.lead);
  },

  changeStage(id: string, input: LeadStageInput): Promise<LeadDto> {
    return apiRequest<{ lead: LeadDto }>(`/leads/${id}/stage`, {
      method: "POST",
      body: input,
    }).then((result) => result.lead);
  },

  assign(id: string, assignedTo: string | null): Promise<LeadDto> {
    return apiRequest<{ lead: LeadDto }>(`/leads/${id}/assign`, {
      method: "POST",
      body: { assignedTo },
    }).then((result) => result.lead);
  },

  archive(id: string): Promise<void> {
    return apiRequest<{ archived: boolean }>(`/leads/${id}`, {
      method: "DELETE",
    }).then(() => undefined);
  },

  deletePermanently(id: string): Promise<void> {
    return apiRequest<{ deleted: boolean }>(`/leads/${id}/permanent`, {
      method: "DELETE",
    }).then(() => undefined);
  },

  listActivities(
    id: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<LeadActivityDto>> {
    return apiRequest<Paginated<LeadActivityDto>>(
      `/leads/${id}/activities?${toQuery({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
      })}`,
    );
  },

  addActivity(
    id: string,
    input: LeadActivityInput,
  ): Promise<{ activity: LeadActivityDto; lead: LeadDto }> {
    return apiRequest<{ activity: LeadActivityDto; lead: LeadDto }>(
      `/leads/${id}/activities`,
      { method: "POST", body: input },
    );
  },

  createFollowUp(id: string, input: LeadFollowUpInput): Promise<LeadFollowUpDto> {
    return apiRequest<{ followUp: LeadFollowUpDto }>(
      `/leads/${id}/follow-ups`,
      { method: "POST", body: input },
    ).then((result) => result.followUp);
  },

  checkDuplicate(params: {
    phone?: string;
    email?: string;
    excludeId?: string;
  }): Promise<DuplicateLeadDto[]> {
    return apiRequest<{ duplicates: DuplicateLeadDto[] }>(
      `/leads/check-duplicate?${toQuery({ ...params })}`,
    ).then((result) => result.duplicates);
  },

  pipeline(params: PipelineParams = {}): Promise<LeadPipelineDto> {
    return apiRequest<{ pipeline: LeadPipelineDto }>(
      `/leads/pipeline?${toQuery({ ...params })}`,
    ).then((result) => result.pipeline);
  },
};
