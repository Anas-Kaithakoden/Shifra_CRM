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
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "../schemas/users.schema";
import {
  createUserForActor,
  getUserForActor,
  listUsersForActor,
  setUserActiveForActor,
  updateUserForActor,
} from "../services/users.service";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.USERS_READ),
  async (c) => {
    const query = parseQuery(c, listUsersQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await listUsersForActor(db, query);

    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

usersRoutes.get(
  "/:id",
  requireAuth,
  requirePermission(PERMISSIONS.USERS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const user = await getUserForActor(db, c.get("user"), id);
    return ok(c, { user });
  },
);

usersRoutes.post(
  "/",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.USERS_CREATE),
  async (c) => {
    const input = await parseJson(c, createUserSchema);
    const db = createDb(c.env.DB);
    const user = await createUserForActor(
      db,
      c.get("user"),
      input,
      getClientIp(c),
    );
    return ok(c, { user }, 201);
  },
);

usersRoutes.patch(
  "/:id",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.USERS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, updateUserSchema);
    const db = createDb(c.env.DB);
    const user = await updateUserForActor(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { user });
  },
);

usersRoutes.post(
  "/:id/deactivate",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.USERS_DEACTIVATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const user = await setUserActiveForActor(
      db,
      c.get("user"),
      id,
      false,
      getClientIp(c),
    );
    return ok(c, { user });
  },
);

usersRoutes.post(
  "/:id/activate",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.USERS_ACTIVATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const user = await setUserActiveForActor(
      db,
      c.get("user"),
      id,
      true,
      getClientIp(c),
    );
    return ok(c, { user });
  },
);
