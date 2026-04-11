#!/usr/bin/env node
/**
 * Local browser E2E: use `next start` (not `next dev`) on :3001 and Laravel on :8000.
 *   npm run build && npx next start -H 127.0.0.1 -p 3001
 *   php artisan serve --host=127.0.0.1 --port=8000
 *   npm run test:e2e:local
 */
import { spawnSync } from "node:child_process";

process.env.PLAYWRIGHT_BASE_URL ??= "http://127.0.0.1:3001";
process.env.PLAYWRIGHT_API_BASE_URL ??= "http://127.0.0.1:8000";

const r = spawnSync("npx", ["playwright", "test", "e2e/smoke.spec.js"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(r.status ?? 1);
