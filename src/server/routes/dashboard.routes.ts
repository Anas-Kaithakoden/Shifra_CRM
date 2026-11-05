import { Hono } from "hono";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { AppEnv } from "../config";
import { createDb } from "../db/client";
import { ok } from "../lib/response";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  getDashboardStats,
  getLeadDashboardStats,
} from "../services/dashboard.service";
import { getCustomerDashboardStatsForActor } from "../services/customers.service";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get(
  "/stats",
  requireAuth,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  async (c) => {
    const db = createDb(c.env.DB);
    const stats = await getDashboardStats(db, c.get("user"));
    return ok(c, stats);
  },
);

dashboardRoutes.get(
  "/lead-stats",
  requireAuth,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  async (c) => {
    const db = createDb(c.env.DB);
    const stats = await getLeadDashboardStats(db, c.get("user"));
    return ok(c, stats);
  },
);

dashboardRoutes.get(
  "/customer-stats",
  requireAuth,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  async (c) => {
    const db = createDb(c.env.DB);
    const stats = await getCustomerDashboardStatsForActor(db, c.get("user"));
    return ok(c, stats);
  },
);
