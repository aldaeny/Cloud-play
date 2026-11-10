// Real Admin DOM/browser with explicit API-response fixtures. Not live Nest/DB.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://127.0.0.1:3002';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath();
const browser = await chromium.launch({ executablePath, headless: true, env: process.env });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let denied = true, pulls = 0, failPull = false, empty = false;
const id = '11111111-1111-4111-8111-111111111111';
const provider = { id, name: 'Authorized Fixture', baseUrl: 'https://provider.fixture', username: 'fixture-user', enabled: true, priority: 100, isDefault: true, connectionStatus: 'unknown', lastCheckedAt: null };
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/admin/**', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.endsWith('/login')) return route.fulfill({ status: denied ? 401 : 200, json: denied ? { error: 'denied' } : { accessToken: 'isolated-browser-fixture-token' } });
  assert.equal(req.headers().authorization, 'Bearer isolated-browser-fixture-token');
  if (url.pathname.endsWith('/titles')) return route.fulfill({ json: [] });
  if (url.pathname.endsWith('/catalog-sync/pull')) {
    pulls++; assert.deepEqual(req.postDataJSON(), { authorizationConfirmed: true });
    return route.fulfill({ status: failPull ? 403 : 201, json: failPull ? { error: 'denied' } : { status: 'SUCCEEDED' } });
  }
  if (url.pathname.endsWith('/catalog-sync')) return route.fulfill({ json: { itemCount: 42, lastSuccessAt: '2026-11-01T00:00:00Z', history: [{ status: 'SUCCEEDED', reason: 'OK', at: '2026-11-01T00:00:00Z' }] } });
  return route.fulfill({ json: empty ? [] : [provider] });
});
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByLabel('البريد الإلكتروني').fill('fixture@example.invalid');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.getByRole('alert').waitFor();
  denied = false;
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.getByText('Authorized Fixture', { exact: false }).waitFor();
  const pull = page.getByRole('button', { name: 'مزامنة الكتالوج', exact: true });
  page.once('dialog', dialog => dialog.dismiss()); await pull.click();
  assert.equal(pulls, 0, 'cancelled authorization confirmation must never send pull');
  page.once('dialog', dialog => dialog.accept()); await pull.click();
  await page.getByText('عدد العناصر: 42', { exact: false }).waitFor();
  assert.equal(pulls, 1);
  failPull = true;
  page.once('dialog', dialog => dialog.accept()); await pull.click();
  await page.getByRole('alert').waitFor();
  assert.ok(await page.getByText('عدد العناصر: 42', { exact: false }).isVisible(), 'last good UI snapshot retained on failed pull');
  empty = true; await page.getByRole('button', { name: 'تحديث القائمة', exact: true }).click();
  await page.getByText('لا توجد سيرفرات مضافة حالياً.').waitFor();
  empty = false; await page.getByRole('button', { name: 'تحديث القائمة', exact: true }).click();
  await pull.waitFor();
  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Admin overflows at${width}`);
  }
  assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes('isolated-browser-fixture-token')), false);
  await page.getByRole('button', { name: 'مسح الجلسة من الصفحة', exact: true }).click();
  await page.getByRole('button', { name: 'دخول', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS actual Admin browser: denied login, authorized UI fixture, confirmation cancellation/acceptance, sync success/history, forbidden failure retention, empty/retry,390/820/1280layout, memory-only session clearing');
} catch (error) { console.error(`::error::${String(error.message).replaceAll('\n', ' ')}`); throw error; } finally { await browser.close(); }
