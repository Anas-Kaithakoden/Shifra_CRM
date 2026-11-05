import { eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { appSettings, type AppSettingRow } from "../schema";

export async function listSettings(db: AppDatabase): Promise<AppSettingRow[]> {
  return db.select().from(appSettings).all();
}

export async function upsertSetting(
  db: AppDatabase,
  values: {
    key: string;
    value: string;
    updatedAt: string;
    updatedBy: string;
  },
): Promise<void> {
  await db
    .insert(appSettings)
    .values(values)
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: values.value,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
      },
    })
    .run();
}

export async function deleteSetting(
  db: AppDatabase,
  key: string,
): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key)).run();
}
