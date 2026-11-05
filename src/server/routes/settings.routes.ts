import { Hono } from "hono";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppEnv } from "../config";
import { createDb } from "../db/client";
import { getClientIp } from "../lib/request";
import { ok } from "../lib/response";
import { parseJson } from "../lib/validation";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { updateSettingsSchema } from "../schemas/settings.schema";
import { getSettings, updateSettings } from "../services/settings.service";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (c) => {
    const db = createDb(c.env.DB);
    const settings = await getSettings(db);
    return ok(c, { settings });
  },
);

settingsRoutes.patch(
  "/",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (c) => {
    const input = await parseJson(c, updateSettingsSchema);
    const db = createDb(c.env.DB);
    const settings = await updateSettings(
      db,
      c.get("user"),
      input,
      getClientIp(c),
    );
    return ok(c, { settings });
  },
);
