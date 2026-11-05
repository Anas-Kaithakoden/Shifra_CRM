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
  assignTaskSchema,
  cancelTaskSchema,
  completeTaskSchema,
  createTaskSchema,
  listTasksQuerySchema,
  rescheduleTaskSchema,
  updateTaskSchema,
} from "../schemas/tasks.schema";
import * as tasksService from "../services/tasks.service";

export const tasksRoutes = new Hono<AppEnv>();

tasksRoutes.get(
  "/my",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const query = parseQuery(c, listTasksQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await tasksService.listTasksForActor(
      db,
      c.get("user"),
      { ...query, scope: "my" },
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

tasksRoutes.get(
  "/today",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const query = parseQuery(c, listTasksQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await tasksService.listTasksForActor(
      db,
      c.get("user"),
      { ...query, scope: "today" },
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

tasksRoutes.get(
  "/upcoming",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const query = parseQuery(c, listTasksQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await tasksService.listTasksForActor(
      db,
      c.get("user"),
      { ...query, scope: "upcoming" },
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

tasksRoutes.get(
  "/overdue",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const query = parseQuery(c, listTasksQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await tasksService.listTasksForActor(
      db,
      c.get("user"),
      { ...query, scope: "overdue" },
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

tasksRoutes.get(
  "/follow-ups",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const query = parseQuery(c, listTasksQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await tasksService.listTasksForActor(
      db,
      c.get("user"),
      { ...query, scope: "follow_up" },
    );
    return paginated(
      c,
      items,
      buildPagination(query.page, query.pageSize, total),
    );
  },
);

tasksRoutes.get(
  "/activities",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const db = createDb(c.env.DB);
    const activities = await tasksService.listRecentActivitiesForActor(
      db,
      c.get("user"),
      30,
    );
    return ok(c, { activities });
  },
);

tasksRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const query = parseQuery(c, listTasksQuerySchema);
    const db = createDb(c.env.DB);
    const { items, total } = await tasksService.listTasksForActor(
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

tasksRoutes.post(
  "/",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_CREATE),
  async (c) => {
    const input = await parseJson(c, createTaskSchema);
    const db = createDb(c.env.DB);
    const task = await tasksService.createTask(
      db,
      c.get("user"),
      input,
      getClientIp(c),
    );
    return ok(c, { task }, 201);
  },
);

tasksRoutes.get(
  "/:id",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const task = await tasksService.getTask(db, c.get("user"), id);
    return ok(c, { task });
  },
);

tasksRoutes.patch(
  "/:id",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, updateTaskSchema);
    const db = createDb(c.env.DB);
    const task = await tasksService.updateTask(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { task });
  },
);

tasksRoutes.post(
  "/:id/complete",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    let input: { completedNote?: string } = { completedNote: undefined };
    try {
      input = await parseJson(c, completeTaskSchema);
    } catch {
      // Body is optional for complete
    }
    const db = createDb(c.env.DB);
    const task = await tasksService.completeTask(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { task });
  },
);

tasksRoutes.post(
  "/:id/reopen",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const task = await tasksService.reopenTask(
      db,
      c.get("user"),
      id,
      getClientIp(c),
    );
    return ok(c, { task });
  },
);

tasksRoutes.post(
  "/:id/cancel",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    let input: { reason?: string } = { reason: undefined };
    try {
      input = await parseJson(c, cancelTaskSchema);
    } catch {
      // Body is optional for cancel
    }
    const db = createDb(c.env.DB);
    const task = await tasksService.cancelTask(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { task });
  },
);

tasksRoutes.post(
  "/:id/reschedule",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, rescheduleTaskSchema);
    const db = createDb(c.env.DB);
    const task = await tasksService.rescheduleTask(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { task });
  },
);

tasksRoutes.post(
  "/:id/assign",
  requireAuth,
  requireCsrf,
  requirePermission(PERMISSIONS.TASKS_UPDATE),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const input = await parseJson(c, assignTaskSchema);
    const db = createDb(c.env.DB);
    const task = await tasksService.assignTask(
      db,
      c.get("user"),
      id,
      input,
      getClientIp(c),
    );
    return ok(c, { task });
  },
);

tasksRoutes.get(
  "/:id/activities",
  requireAuth,
  requirePermission(PERMISSIONS.TASKS_READ),
  async (c) => {
    const { id } = parseParams(c, idParamSchema);
    const db = createDb(c.env.DB);
    const activities = await tasksService.listTaskActivitiesForActor(
      db,
      c.get("user"),
      id,
    );
    return ok(c, { activities });
  },
);
