import type { AppDatabase } from "../db/client";
import { insertAuditLog } from "../db/queries/audit.queries";
import { newId } from "../lib/ids";
import { nowIso } from "../lib/time";

export interface AuditInput {
  userId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAudit(
  db: AppDatabase,
  input: AuditInput,
): Promise<void> {
  await insertAuditLog(db, {
    id: newId(),
    userId: input.userId,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    ipAddress: input.ipAddress ?? null,
    createdAt: nowIso(),
  });
}
