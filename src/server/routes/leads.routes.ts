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
import { convertLeadSchema } from "../schemas/customers.schema";
import {
  assignLeadSchema,
  changeStageSchema,
  createActivitySchema,
  createFollowUpSchema,
  createLeadSchema,
  duplicateLeadQuerySchema,
  listActivitiesQuerySchema,
  listLeadsQuerySchema,
  pipelineQuerySchema,
  updateLeadSchema,
} from "../schemas/leads.schema";
import {
  addLeadActivityForActor,
  archiveLeadForActor,
  assignLeadForActor,
  changeLeadStageForActor,
  checkDuplicateLeadsForActor,
  createLeadForActor,
  deleteLeadPermanentlyForActor,
  getLeadForActor,
  getPipelineForActor,
  listLeadActivitiesForActor,
  listLeadsForActor,
  updateLeadForActor,
} from "../services/leads.service";
import { createFollowUpForActor } from "../services/follow-ups.service";
import { convertLeadToCustomerForActor } from "../services/customers.service";

export const leadsRoutes = new Hono<AppEnv>();

leadsRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.LEADS_READ),
  async (c) => {
    const query = parseQuery(c, listLeadsQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await listLeadsForActor(db, c.get("user"), query);
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

leadsRoutes.get(
  "/check-duplicate",
  requireAuth,
  requirePermission(PERMISSIONS.LEADS_READ),
  async (c) => {
    const query = parseQuery(c, duplicateLeadQuerySchema);
    const db = createDb(c.env.DB);
    const duplicates = await checkDuplicateLeadsForActor(
      db,
      c.get("user"),
      query,
    );
    return ok(c, { duplicates });
  },
);

leadsRoutes.get(
  "/pipeline",
  requireAuth,
  requirePermission(PERMISSIONS.LEADS_READ),
  async (c) => {
    const query = parseQuery(c, pipelineQuerySchema);
    const db = createDb(c.env.DB);
    const pipeline = await getPipelineForActor(db, c.get("user"), query);
    return ok(c, { pipeline });
  },
);

leadsRoutes.post(
  "/",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_CREATE),
  async (c) => {
    const input = await parseJson(c, createLeadSchema);
    const db = createDb(c.env.DB);
    const lead = await createLeadForActor(
      db,
      c.get("user"),
      input,
      getClientIp(c),
    );
    return ok(c, { lead }, 201);
  },
);

leadsRoutes.get(
  "/:id",
  requireAuth,
  requirePermission(PERMISSIONS.LEADS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const lead = await getLeadForActor(db, c.get("user"), id);
    return ok(c, { lead });
  },
);

leadsRoutes.patch(
  "/:id",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, updateLeadSchema);
    const db = createDb(c.env.DB);
    const lead = await updateLeadForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { lead });
  },
);

leadsRoutes.post(
  "/:id/convert-to-customer",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_LINK_LEADS),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, convertLeadSchema);
    const db = createDb(c.env.DB);
    const result = await convertLeadToCustomerForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, result, result.alreadyLinked ? 200 : 201);
  },
);

leadsRoutes.post(
  "/:id/stage",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_STAGE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, changeStageSchema);
    const db = createDb(c.env.DB);
    const lead = await changeLeadStageForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { lead });
  },
);

leadsRoutes.post(
  "/:id/assign",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_ASSIGN),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, assignLeadSchema);
    const db = createDb(c.env.DB);
    const lead = await assignLeadForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { lead });
  },
);

leadsRoutes.get(
  "/:id/activities",
  requireAuth,
  requirePermission(PERMISSIONS.LEADS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const query = parseQuery(c, listActivitiesQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await listLeadActivitiesForActor(
      db,
      c.get("user"),
      id,
      query,
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

leadsRoutes.post(
  "/:id/activities",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, createActivitySchema);
    const db = createDb(c.env.DB);
    const result = await addLeadActivityForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, result, 201);
  },
);

leadsRoutes.post(
  "/:id/follow-ups",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.FOLLOWUPS_CREATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, createFollowUpSchema);
    const db = createDb(c.env.DB);
    const followUp = await createFollowUpForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { followUp }, 201);
  },
);

leadsRoutes.delete(
  "/:id/permanent",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_DELETE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    await deleteLeadPermanentlyForActor(
      db,
      c.get("user"),
      id,
      getClientIp(c),
    );
    return ok(c, { deleted: true });
  },
);

leadsRoutes.delete(
  "/:id",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.LEADS_ARCHIVE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    await archiveLeadForActor(db, c.get("user"), id, getClientIp(c));
    return ok(c, { archived: true });
  },
);
