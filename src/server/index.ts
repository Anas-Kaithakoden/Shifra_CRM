import { createApp } from "./app";
import type { Env } from "./config";
import { createDb } from "./db/client";
import { processPendingReminders, remindersEnabled } from "./services/telegram";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        if (!remindersEnabled(env)) return;
        const db = createDb(env.DB);
        await processPendingReminders(db, env);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
