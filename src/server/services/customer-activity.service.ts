import { recordAudit } from "./audit.service";
import { insertCustomerActivity } from "../db/queries/customers.queries";
import type { CustomerActivityType } from "../../shared/constants/customers";
import type { AppDatabase } from "../db/client";
import { newId } from "../lib/ids";

export interface RecordCustomerActivityInput {
  customerId: string;
  userId: string | null;
  activityType: CustomerActivityType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  leadId?: string | null;
  contactId?: string | null;
  createdAt?: string;
}

export async function recordCustomerActivity(
  db: AppDatabase,
  input: RecordCustomerActivityInput,
) {
  return insertCustomerActivity(db, {
    id: newId(),
    customerId: input.customerId,
    userId: input.userId,
    activityType: input.activityType,
    title: input.title,
    description: input.description ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    leadId: input.leadId ?? null,
    contactId: input.contactId ?? null,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  });
}

export async function recordCustomerAudit(
  db: AppDatabase,
  options: {
    actorId: string;
    action: string;
    customerId: string;
    ipAddress: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await recordAudit(db, {
    userId: options.actorId,
    action: options.action,
    entityType: "customer",
    entityId: options.customerId,
    ipAddress: options.ipAddress,
    metadata: options.metadata,
  });
}
