import { AUDIT_ACTIONS } from "../../shared/constants/audit";
import type { AppSettingsDto, AuthUserDto } from "../../shared/types/api";
import type { UpdateSettingsInput } from "../schemas/settings.schema";
import type { AppDatabase } from "../db/client";
import { listSettings, upsertSetting } from "../db/queries/settings.queries";
import { forbidden } from "../lib/errors";
import { nowIso } from "../lib/time";
import { recordAudit } from "./audit.service";

const DEFAULTS = {
  companyName: "Shifra Nuha Technologies",
  companyEmail: "",
  companyPhone: "",
  companyWebsite: "https://shifranuhatech.com",
  timezone: "UTC",
  currency: "USD",
} as const;

type SettingsKey = keyof typeof DEFAULTS;

const KEY_MAP: Record<SettingsKey, string> = {
  companyName: "company_name",
  companyEmail: "company_email",
  companyPhone: "company_phone",
  companyWebsite: "company_website",
  timezone: "timezone",
  currency: "currency",
};

export async function getSettings(db: AppDatabase): Promise<AppSettingsDto> {
  const rows = await listSettings(db);
  const values: Record<string, string> = {};
  let updatedAt: string | null = null;

  for (const row of rows) {
    values[row.key] = row.value;
    if (!updatedAt || row.updatedAt > updatedAt) {
      updatedAt = row.updatedAt;
    }
  }

  const result = { ...DEFAULTS } as Record<SettingsKey, string>;
  for (const key of Object.keys(KEY_MAP) as SettingsKey[]) {
    const stored = values[KEY_MAP[key]];
    if (stored !== undefined) {
      result[key] = stored;
    }
  }

  return {
    ...result,
    updatedAt,
  };
}

export async function updateSettings(
  db: AppDatabase,
  actor: AuthUserDto,
  input: UpdateSettingsInput,
  ipAddress: string | null,
): Promise<AppSettingsDto> {
  if (actor.role !== "owner") {
    throw forbidden("Only the owner can update CRM settings.");
  }

  const now = nowIso();
  const changedKeys: string[] = [];

  for (const key of Object.keys(input) as SettingsKey[]) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    await upsertSetting(db, {
      key: KEY_MAP[key],
      value,
      updatedAt: now,
      updatedBy: actor.id,
    });
    changedKeys.push(key);
  }

  await recordAudit(db, {
    userId: actor.id,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    entityType: "settings",
    entityId: "app",
    metadata: { fields: changedKeys },
    ipAddress,
  });

  return getSettings(db);
}
