// Remove local-only files that the Cloudflare Vite plugin copies into the
// build output. `dist/` is deployable and must never contain `.dev.vars`.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const distRoot = resolve(process.cwd(), "dist");

if (existsSync(distRoot)) {
  const candidates = readdirSync(distRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(distRoot, entry.name, ".dev.vars"));

  for (const file of candidates) {
    if (existsSync(file)) {
      rmSync(file, { force: true });
      console.log(`Removed local secrets file from build output: ${file}`);
    }
  }
}
