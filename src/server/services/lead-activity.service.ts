import type { ActivityType, PipelineStage } from "../../shared/constants/leads";
import type { AppDatabase } from "../db/client";
import { insertLeadActivity } from "../db/queries/leads.queries";
import type { LeadActivityRow } from "../db/schema";
import { newId } from "../lib/ids";
import { nowIso } from "../lib/time";

export interface RecordLeadActivityInput {
  leadId: string;
  userId: string | null;
  activityType: ActivityType;
  title: string;
  description?: string | null;
  previousStage?: PipelineStage | null;
  newStage?: PipelineStage | null;
  createdAt?: string;
}

export async function recordLeadActivity(
  db: AppDatabase,
  input: RecordLeadActivityInput,
): Promise<LeadActivityRow> {
  return insertLeadActivity(db, {
    id: newId(),
    leadId: input.leadId,
    userId: input.userId,
    activityType: input.activityType,
    title: input.title,
    description: input.description ?? null,
    previousStage: input.previousStage ?? null,
    newStage: input.newStage ?? null,
    createdAt: input.createdAt ?? nowIso(),
  });
}
