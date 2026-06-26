import { test, expect } from '@playwright/test';

/**
 * Browser E2E (TEST_PLAN §9 LIVE-*).
 * If `next dev` serves broken chunks (500 on `/_next/static/*`), use production:
 *   npm run build && npx next start -H 127.0.0.1 -p 3001
 * then `npm run test:e2e:local` (defaults to :3001 + API :8000).
 *
 * Laravel API for Playwright `request` login (browser still uses Next `/api` rewrites when base URL is this app).
 */
const API_BASE =
  process.env.PLAYWRIGHT_API_BASE_URL ??
  'https://diploma-magnitude-attention-gone.trycloudflare.com';

const NGROK = { 'ngrok-skip-browser-warning': 'true' };

function apiHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (API_BASE.includes('ngrok') || API_BASE.includes('trycloudflare')) {
    Object.assign(h, NGROK);
  }
  return h;
}

test.describe('LIVE smoke (TEST_PLAN §9)', () => {
  test('LIVE-FE: login page renders (Welcome back, Sign in)', async ({
    page,
  }) => {
    // Avoid `networkidle` on Next dev (HMR keeps connections open).
    await page.goto('/login', { waitUntil: 'load' });
    await page.getByText('Welcome back', { exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('LIVE-004: dashboard loads in browser (auth via API + token)', async ({
    page,
    request,
  }) => {
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'admin', password: 'HavenStay123!' },
      headers: apiHeaders(),
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      test.skip(
        true,
        `API login unavailable (${loginRes.status()}): ${body.slice(0, 200)} — start Laravel (e.g. php artisan serve) or set PLAYWRIGHT_API_BASE_URL.`
      );
    }
    const { token } = await loginRes.json();
    expect(token).toBeTruthy();

    await page.goto('/login', { waitUntil: 'load' });
    await page.evaluate((t) => {
      localStorage.setItem('havenstay_token', t);
      document.cookie = `havenstay_token=${encodeURIComponent(t)}; Path=/; Max-Age=2592000; SameSite=Lax`;
    }, token);

    await page.goto('/dashboard', { waitUntil: 'load' });
    // Stays on /dashboard once auth resolves; 401 + clearAuthToken would send user to /login (waitForURL times out).
    await page.waitForURL(/\/dashboard$|\/dashboard\?/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible(
      {
        timeout: 30_000,
      }
    );
  });
});
