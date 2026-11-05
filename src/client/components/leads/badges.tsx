import {
  CONTACT_STATUS_LABELS,
  LEAD_PRIORITY_LABELS,
  PIPELINE_STAGE_LABELS,
  type ContactStatus,
  type LeadPriority,
  type PipelineStage,
} from "../../../shared/constants/leads";
import { Badge } from "../ui";

const STAGE_VARIANTS: Record<
  PipelineStage,
  "neutral" | "brand" | "success" | "danger" | "warning" | "info"
> = {
  new: "info",
  contacted: "brand",
  qualified: "brand",
  proposal_sent: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return <Badge variant={STAGE_VARIANTS[stage]}>{PIPELINE_STAGE_LABELS[stage]}</Badge>;
}

const CONTACT_VARIANTS: Record<
  ContactStatus,
  "neutral" | "success" | "warning"
> = {
  not_contacted: "neutral",
  attempted: "warning",
  contacted: "success",
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return (
    <Badge variant={CONTACT_VARIANTS[status]}>
      {CONTACT_STATUS_LABELS[status]}
    </Badge>
  );
}

const PRIORITY_VARIANTS: Record<
  LeadPriority,
  "neutral" | "info" | "danger"
> = {
  low: "neutral",
  medium: "info",
  high: "danger",
};

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANTS[priority]}>
      {LEAD_PRIORITY_LABELS[priority]} priority
    </Badge>
  );
}
