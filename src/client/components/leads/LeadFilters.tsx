import { FilterX } from "lucide-react";
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  LEAD_PRIORITIES,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type ContactStatus,
  type LeadPriority,
  type LeadSource,
  type PipelineStage,
} from "../../../shared/constants/leads";
import { SERVICE_OPTIONS } from "../../../shared/constants/services";
import { Button, Select } from "../ui";

export interface LeadFilterValues {
  pipelineStage: PipelineStage | "";
  contactStatus: ContactStatus | "";
  source: LeadSource | "";
  serviceInterest: string;
  priority: LeadPriority | "";
  assignedTo: string;
  sortBy: "created_at" | "next_follow_up_at";
  sortDir: "asc" | "desc";
}

export function LeadFilters({
  values,
  onChange,
  onClear,
  users,
}: {
  values: LeadFilterValues;
  onChange: (patch: Partial<LeadFilterValues>) => void;
  onClear: () => void;
  users?: Array<{ id: string; fullName: string }>;
}) {
  const hasFilters = Boolean(
    values.pipelineStage ||
      values.contactStatus ||
      values.source ||
      values.serviceInterest ||
      values.priority ||
      values.assignedTo ||
      values.sortBy !== "created_at" ||
      values.sortDir !== "desc",
  );

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Select
        aria-label="Filter by stage"
        value={values.pipelineStage}
        onChange={(event) =>
          onChange({ pipelineStage: event.target.value as PipelineStage | "" })
        }
      >
        <option value="">All stages</option>
        {PIPELINE_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {PIPELINE_STAGE_LABELS[stage]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by contact status"
        value={values.contactStatus}
        onChange={(event) =>
          onChange({ contactStatus: event.target.value as ContactStatus | "" })
        }
      >
        <option value="">All contact statuses</option>
        {CONTACT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {CONTACT_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by source"
        value={values.source}
        onChange={(event) =>
          onChange({ source: event.target.value as LeadSource | "" })
        }
      >
        <option value="">All sources</option>
        {LEAD_SOURCES.map((source) => (
          <option key={source} value={source}>
            {source}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by service"
        value={values.serviceInterest}
        onChange={(event) => onChange({ serviceInterest: event.target.value })}
      >
        <option value="">All services</option>
        {SERVICE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by priority"
        value={values.priority}
        onChange={(event) =>
          onChange({ priority: event.target.value as LeadPriority | "" })
        }
      >
        <option value="">All priorities</option>
        {LEAD_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {LEAD_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </Select>

      {users?.length ? (
        <Select
          aria-label="Filter by owner"
          value={values.assignedTo}
          onChange={(event) => onChange({ assignedTo: event.target.value })}
        >
          <option value="">All owners</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        aria-label="Sort leads"
        value={`${values.sortBy}:${values.sortDir}`}
        onChange={(event) => {
          const [sortBy, sortDir] = event.target.value.split(":") as [
            LeadFilterValues["sortBy"],
            LeadFilterValues["sortDir"],
          ];
          onChange({ sortBy, sortDir });
        }}
      >
        <option value="created_at:desc">Newest first</option>
        <option value="created_at:asc">Oldest first</option>
        <option value="next_follow_up_at:asc">Follow-up soonest</option>
        <option value="next_follow_up_at:desc">Follow-up latest</option>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          leftIcon={<FilterX className="h-3.5 w-3.5" aria-hidden="true" />}
          className="justify-self-start"
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
