import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  'https://book-street-maggot.ngrok-free.dev';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    extraHTTPHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
    // Set PW_CHANNEL=msedge to use system Edge; default is bundled Chromium (`npx playwright install chromium`).
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    ...devices['Desktop Chrome'],
    // Sidebar is `md:flex`; keep width ≥ md so LIVE-004 sees `<nav>` / Operations.
    viewport: { width: 1280, height: 720 },
  },
  timeout: 60_000,
});
