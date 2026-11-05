import { Hono } from "hono";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppEnv } from "../config";
import { createDb } from "../db/client";
import { listAuditLogs } from "../db/queries/audit.queries";
import { buildPagination, paginated } from "../lib/response";
import { parseQuery } from "../lib/validation";
import { requireAuth, requirePermission } from "../middleware/auth";
import { listAuditLogsQuerySchema } from "../schemas/audit.schema";
import { toAuditLogDto } from "../services/mappers";

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.AUDIT_READ),
  async (c) => {
    const query = parseQuery(c, listAuditLogsQuerySchema);
    const db = createDb(c.env.DB);

    const { rows, total } = await listAuditLogs(db, {
      action: query.action,
      userId: query.userId,
      from: query.from,
      to: query.to,
      page: query.page,
      pageSize: query.pageSize,
    });

    return paginated(
      c,
      rows.map(toAuditLogDto),
      buildPagination(query.page, query.pageSize, total),
    );
  },
);
