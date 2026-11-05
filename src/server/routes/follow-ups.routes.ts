import { Hono } from "hono";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppEnv } from "../config";
import { createDb } from "../db/client";
import { getClientIp } from "../lib/request";
import { buildPagination, ok, paginated } from "../lib/response";
import { parseJson, parseParams, parseQuery } from "../lib/validation";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { idParamSchema } from "../schemas/common.schema";
import {
  cancelFollowUpSchema,
  completeFollowUpSchema,
  listFollowUpsQuerySchema,
  rescheduleFollowUpSchema,
  updateFollowUpSchema,
} from "../schemas/leads.schema";
import {
  cancelFollowUpForActor,
  completeFollowUpForActor,
  getFollowUpCountsForActor,
  listFollowUpsForActor,
  updateFollowUpForActor,
} from "../services/follow-ups.service";

export const followUpsRoutes = new Hono<AppEnv>();

followUpsRoutes.get(
  "/counts",
  requireAuth,
  requirePermission(PERMISSIONS.FOLLOWUPS_READ),
  async (c) => {
    const db = createDb(c.env.DB);
    const counts = await getFollowUpCountsForActor(db, c.get("user"));
    return ok(c, { counts });
  },
);

followUpsRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.FOLLOWUPS_READ),
  async (c) => {
    const query = parseQuery(c, listFollowUpsQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await listFollowUpsForActor(
      db,
      c.get("user"),
      query,
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

followUpsRoutes.patch(
  "/:id",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.FOLLOWUPS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, updateFollowUpSchema);
    const db = createDb(c.env.DB);
    const followUp = await updateFollowUpForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { followUp });
  },
);

followUpsRoutes.post(
  "/:id/reschedule",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.FOLLOWUPS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, rescheduleFollowUpSchema);
    const db = createDb(c.env.DB);
    const followUp = await updateFollowUpForActor(
      db,
      c.get("user"),
      id,
      { scheduledAt: input.scheduledAt },
      getClientIp(c),
    );
    return ok(c, { followUp });
  },
);

followUpsRoutes.post(
  "/:id/complete",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.FOLLOWUPS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, completeFollowUpSchema);
    const db = createDb(c.env.DB);
    const followUp = await completeFollowUpForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { followUp });
  },
);

followUpsRoutes.post(
  "/:id/cancel",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.FOLLOWUPS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, cancelFollowUpSchema);
    const db = createDb(c.env.DB);
    const followUp = await cancelFollowUpForActor(
      db,
      c.get("user"),
      id,
      input.reason,
      getClientIp(c),
    );
    return ok(c, { followUp });
  },
);
