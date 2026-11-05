import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { HealthDto } from "../shared/types/api";
import type { AppEnv } from "./config";
import { getEnvironmentLabel } from "./config";
import { AppError } from "./lib/errors";
import { ok } from "./lib/response";
import { nowIso } from "./lib/time";
import { originGuard, securityHeaders } from "./middleware/security";
import { auditRoutes } from "./routes/audit.routes";
import { authRoutes } from "./routes/auth.routes";
import { customersRoutes } from "./routes/customers.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { followUpsRoutes } from "./routes/follow-ups.routes";
import { leadsRoutes } from "./routes/leads.routes";
import { notificationsRoutes } from "./routes/notifications.routes";
import { settingsRoutes } from "./routes/settings.routes";
import { tasksRoutes } from "./routes/tasks.routes";
import { usersRoutes } from "./routes/users.routes";

export function createApp() {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", securityHeaders);
  app.use("*", originGuard);

  app.get("/health", (c) => {
    const body: HealthDto = {
      status: "ok",
      environment: getEnvironmentLabel(c.env),
      timestamp: nowIso(),
    };
    return ok(c, body);
  });

  app.route("/auth", authRoutes);
  app.route("/users", usersRoutes);
  app.route("/dashboard", dashboardRoutes);
  app.route("/customers", customersRoutes);
  app.route("/leads", leadsRoutes);
  app.route("/follow-ups", followUpsRoutes);
  app.route("/audit-logs", auditRoutes);
  app.route("/settings", settingsRoutes);
  app.route("/tasks", tasksRoutes);
  app.route("/notifications", notificationsRoutes);

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "not_found",
          message: "The requested API endpoint was not found.",
        },
      },
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof AppError) {
      if (error.headers) {
        for (const [name, value] of Object.entries(error.headers)) {
          c.header(name, value);
        }
      }

      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined
              ? { details: error.details }
              : {}),
          },
        },
        error.status,
      );
    }

    if (error instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "validation_error",
            message: "Please correct the highlighted fields.",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        400,
      );
    }

    if (error instanceof HTTPException) {
      return c.json(
        {
          error: {
            code: "http_error",
            message: error.message || "Request failed.",
          },
        },
        error.status,
      );
    }

    console.error(
      "Unhandled API error:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );

    return c.json(
      {
        error: {
          code: "internal_error",
          message: "An unexpected error occurred. Please try again.",
        },
      },
      500,
    );
  });

  return app;
}
