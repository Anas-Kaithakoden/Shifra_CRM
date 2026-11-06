import { Hono } from "hono";
import { z } from "zod";
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
  createCustomerActivitySchema,
  createCustomerContactSchema,
  createCustomerNoteSchema,
  createCustomerServiceSchema,
  createCustomerSchema,
  duplicateCustomerQuerySchema,
  linkCustomerLeadSchema,
  listCustomerActivitiesQuerySchema,
  listCustomerRenewalsQuerySchema,
  listCustomersQuerySchema,
  updateCustomerContactSchema,
  updateCustomerSchema,
} from "../schemas/customers.schema";
import {
  addCustomerActivityForActor,
  addCustomerContactForActor,
  addCustomerNoteForActor,
  addCustomerServiceForActor,
  archiveCustomerForActor,
  checkDuplicateCustomersForActor,
  createCustomerForActor,
  deleteCustomerPermanentlyForActor,
  getCustomerForActor,
  linkLeadToCustomerForActor,
  listCustomerActivitiesForActor,
  listCustomerRenewalsForActor,
  listCustomersForActor,
  removeCustomerContactForActor,
  restoreCustomerForActor,
  updateCustomerContactForActor,
  updateCustomerForActor,
} from "../services/customers.service";

const contactParamsSchema = z.object({
  id: z.uuid("Invalid customer identifier."),
  contactId: z.uuid("Invalid contact identifier."),
});

export const customersRoutes = new Hono<AppEnv>();

customersRoutes.get(
  "/renewals",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const query = parseQuery(c, listCustomerRenewalsQuerySchema);
    const db = createDb(c.env.DB);
    const result = await listCustomerRenewalsForActor(
      db,
      c.get("user"),
      query,
    );
    return ok(c, {
      items: result.items,
      counts: result.counts,
      pagination: buildPagination(query.page, query.pageSize, result.total),
    });
  },
);

customersRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const query = parseQuery(c, listCustomersQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await listCustomersForActor(
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

customersRoutes.get(
  "/duplicates",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const query = parseQuery(c, duplicateCustomerQuerySchema);
    const db = createDb(c.env.DB);
    const duplicates = await checkDuplicateCustomersForActor(
      db,
      c.get("user"),
      query,
    );
    return ok(c, { duplicates });
  },
);

customersRoutes.post(
  "/",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  async (c) => {
    const input = await parseJson(c, createCustomerSchema);
    const db = createDb(c.env.DB);
    const customer = await createCustomerForActor(
      db,
      c.get("user"),
      input,
      getClientIp(c),
    );
    return ok(c, { customer }, 201);
  },
);

customersRoutes.get(
  "/:id",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const customer = await getCustomerForActor(db, c.get("user"), id);
    return ok(c, { customer });
  },
);

customersRoutes.patch(
  "/:id",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, updateCustomerSchema);
    const db = createDb(c.env.DB);
    const customer = await updateCustomerForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { customer });
  },
);

customersRoutes.delete(
  "/:id/permanent",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    await deleteCustomerPermanentlyForActor(
      db,
      c.get("user"),
      id,
      getClientIp(c),
    );
    return ok(c, { deleted: true });
  },
);

customersRoutes.post(
  "/:id/archive",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_ARCHIVE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const customer = await archiveCustomerForActor(
      db,
      c.get("user"),
      id,
      getClientIp(c),
    );
    return ok(c, { customer });
  },
);

customersRoutes.post(
  "/:id/restore",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_ARCHIVE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const customer = await restoreCustomerForActor(
      db,
      c.get("user"),
      id,
      getClientIp(c),
    );
    return ok(c, { customer });
  },
);

customersRoutes.get(
  "/:id/contacts",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const customer = await getCustomerForActor(db, c.get("user"), id);
    return ok(c, { contacts: customer.contacts });
  },
);

customersRoutes.post(
  "/:id/contacts",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_CONTACTS),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, createCustomerContactSchema);
    const db = createDb(c.env.DB);
    const contact = await addCustomerContactForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { contact }, 201);
  },
);

customersRoutes.patch(
  "/:id/contacts/:contactId",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_CONTACTS),
  async (c) => {
    const { id, contactId } = parseParams(c, contactParamsSchema);
    const input = await parseJson(c, updateCustomerContactSchema);
    const db = createDb(c.env.DB);
    const contact = await updateCustomerContactForActor(
      db,
      c.get("user"),
      id,
      contactId,
      input,
      getClientIp(c),
    );
    return ok(c, { contact });
  },
);

customersRoutes.delete(
  "/:id/contacts/:contactId",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_CONTACTS),
  async (c) => {
    const { id, contactId } = parseParams(c, contactParamsSchema);
    const db = createDb(c.env.DB);
    await removeCustomerContactForActor(
      db,
      c.get("user"),
      id,
      contactId,
      getClientIp(c),
    );
    return ok(c, { removed: true });
  },
);

customersRoutes.get(
  "/:id/activities",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const query = parseQuery(c, listCustomerActivitiesQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await listCustomerActivitiesForActor(
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

customersRoutes.post(
  "/:id/services",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, createCustomerServiceSchema);
    const db = createDb(c.env.DB);
    const service = await addCustomerServiceForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { service }, 201);
  },
);

customersRoutes.post(
  "/:id/activities",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_NOTES),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, createCustomerActivitySchema);
    const db = createDb(c.env.DB);
    const activity = await addCustomerActivityForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { activity }, 201);
  },
);

customersRoutes.post(
  "/:id/notes",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_NOTES),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, createCustomerNoteSchema);
    const db = createDb(c.env.DB);
    const activity = await addCustomerNoteForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { note: activity }, 201);
  },
);

customersRoutes.get(
  "/:id/leads",
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const customer = await getCustomerForActor(db, c.get("user"), id);
    return ok(c, { leads: customer.leads });
  },
);

customersRoutes.post(
  "/:id/leads",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.CUSTOMERS_LINK_LEADS),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, linkCustomerLeadSchema);
    const db = createDb(c.env.DB);
    const result = await linkLeadToCustomerForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, result, result.alreadyLinked ? 200 : 201);
  },
);
