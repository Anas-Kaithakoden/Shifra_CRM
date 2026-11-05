import { createApp } from "./app";
import type { Env } from "./config";

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
