import { Hono } from "hono";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppEnv } from "../config";
import { createDb } from "../db/client";
import { badRequest } from "../lib/errors";
import { ok } from "../lib/response";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { getTelegramStatus, sendTestNotification } from "../services/telegram";

export const notificationsRoutes = new Hono<AppEnv>();

notificationsRoutes.get("/telegram/status", requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const status = await getTelegramStatus(db, c.env);
  return ok(c, { status });
});

notificationsRoutes.post(
  "/telegram/test",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (c) => {
    const user = c.get("user");
    const result = await sendTestNotification(c.env, user.fullName);
    if (!result.ok) {
      throw badRequest("telegram_test_failed", result.error ?? "Failed to send test notification.");
    }
    return ok(c, { success: true, message: "Test notification sent successfully to Telegram." });
  },
);
