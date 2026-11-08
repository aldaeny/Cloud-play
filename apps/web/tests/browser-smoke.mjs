/**
 * Real Chromium smoke tests against a running Cloud Play web server.
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:browser --workspace aether-web
 *
 * Optional local media fixtures (never shipped as catalog data):
 *   MEDIA_FIXTURES=/path/to/dir npm run test:browser --workspace aether-web
 * The directory must contain hls/master.m3u8, manifest.mpd and sample.mp4.
 * Chromium is supplied by the environment (PLAYWRIGHT_CHROMIUM_EXECUTABLE or
 * @sparticuz/chromium when installed alongside the repo). No browser is bundled.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const mediaDir = process.env.MEDIA_FIXTURES || '';
let executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '';
let args = [];
let env = { ...process.env };
if (!executable) {
  try {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    executable = await sparticuz.executablePath();
    args = sparticuz.args;
    if (existsSync('/tmp/al2023/lib')) env = { ...env, LD_LIBRARY_PATH: '/tmp/al2023/lib', FONTCONFIG_PATH: '/tmp/fonts' };
  } catch { executable = chromium.executablePath(); }
}
const browser = await chromium.launch({ executablePath: executable, headless: true, args, env });
let passed = 0; let failed = 0;
const pageErrors = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(error.message));
async function goto(route) {
  const response = await page.goto(base + route, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, route);
  await page.waitForTimeout(350);
  return response;
}
async function noOverflow(label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${label} horizontal overflow ${overflow}px`);
}
console.log('\nCloud Play real-browser smoke\n');
for (const route of ['/', '/movies', '/series', '/live', '/my-tv', '/tv-sources', '/settings', '/favorites']) {
  await check(`GET ${route} renders with persistent navigation`, async () => {
    await goto(route);
    assert.equal(await page.locator('.cp-nav-bar').count(), 1);
    assert.ok((await page.locator('h1').first().textContent())?.trim().length > 0);
    await noOverflow(route);
  });
}
await check('Live without operator configuration shows honest setup state', async () => {
  await goto('/live');
  assert.ok(await page.getByText('لم تُربط قائمة قنوات مرخّصة بعد').isVisible());
  assert.equal(await page.locator('.live-card').count(), 0);
});
await check('unknown channel has a not-found state and back link', async () => {
  await goto('/live/does-not-exist');
  assert.ok(await page.getByText('القناة غير موجودة').isVisible());
  assert.ok(await page.getByRole('link', { name: 'العودة إلى القنوات' }).isVisible());
});
await check('theme and language persist across the hybrid router boundary', async () => {
  await goto('/movies');
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.locator('.cp-nav-bar a[href="/live"]').click();
  await page.waitForURL('**/live');
  await page.waitForTimeout(700);
  assert.ok(await page.locator('.site.theme-light').count());
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.ok(await page.getByText('No licensed channel list is connected yet').isVisible());
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
  await page.waitForTimeout(300);
});
await check('main navigation keeps working after returning to Pages Router', async () => {
  await page.locator('.cp-nav-bar a[href="/movies"]').click();
  await page.waitForURL('**/movies');
  await page.waitForTimeout(700);
  assert.ok(await page.getByRole('heading', { name: 'الأفلام', exact: true }).isVisible());
  assert.equal(await page.locator('.cp-nav-bar').count(), 1);
});
for (const [name, width, height] of [['mobile', 390, 844], ['tablet', 820, 1180], ['tv', 1920, 1080]]) {
  await check(`${name} viewport ${width}x${height}: Home/Live/Movies have no horizontal overflow`, async () => {
    await page.setViewportSize({ width, height });
    for (const route of ['/', '/live', '/movies']) { await goto(route); await noOverflow(`${name} ${route}`); }
    const nav = await page.locator('.cp-nav-bar').boundingBox();
    assert.ok(nav && nav.x >= 0 && nav.x + nav.width <= width + 1, 'navigation dock outside viewport');
  });
}
await page.setViewportSize({ width: 1440, height: 1000 });

if (mediaDir) {
  await page.evaluate(() => { localStorage.setItem('cloudplay-language', 'ar'); localStorage.setItem('cloudplay-theme', 'dark'); });
  const fixtureRows = [
    { id: 'fixture-hls', name: 'Local HLS Fixture 1080p', group: 'Sports', epgId: 'fixture.iq', playable: true, streamUrl: `${base}/__fixtures/hls/master.m3u8` },
    { id: 'fixture-dash', name: 'Local DASH Fixture', group: 'Movies', epgId: '', playable: true, streamUrl: `${base}/__fixtures/manifest.mpd` },
    { id: 'fixture-mp4', name: 'Local MP4 Fixture', group: 'News', epgId: '', playable: true, streamUrl: `${base}/__fixtures/sample.mp4` },
    { id: 'fixture-broken', name: 'Unavailable Fixture', group: 'General', epgId: '', playable: false },
  ];
  // Test-only interception: production code still calls the real licensed endpoint.
  await page.route('**/api/iptv/licensed', route => route.fulfill({ json: { data: fixtureRows } }));
  await page.route('**/api/iptv/epg', route => route.fulfill({ status: 503, json: { error: 'GUIDE_UNAVAILABLE' } }));
  await page.route('**/__fixtures/**', route => {
    const relative = new URL(route.request().url()).pathname.replace('/__fixtures/', '');
    const file = path.join(mediaDir, relative);
    if (!file.startsWith(mediaDir) || !existsSync(file)) return route.fulfill({ status: 404, body: 'missing fixture' });
    const type = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : file.endsWith('.mpd') ? 'application/dash+xml' : file.endsWith('.vtt') ? 'text/vtt' : file.endsWith('.mp4') ? 'video/mp4' : 'video/mp2t';
    return route.fulfill({ body: readFileSync(file), headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
  });
  await check('licensed fixture catalog renders filters, favorites and detail navigation', async () => {
    await goto('/live');
    assert.equal(await page.locator('.live-card').count(), 4);
    await page.getByRole('searchbox').fill('HLS');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.live-card').count(), 1);
    await page.locator('.live-card-fav').click();
    assert.equal(await page.locator('.live-card-fav').getAttribute('aria-pressed'), 'true');
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'المفضلة فقط' }).click();
    assert.equal(await page.locator('.live-card').count(), 1);
    await page.getByRole('button', { name: 'المفضلة فقط' }).click();
    await page.getByRole('button', { name: 'تشغيل: Local HLS Fixture 1080p' }).click();
    await page.waitForURL('**/live/fixture-hls');
  });
  await check('HLS fixture actually decodes; quality/audio/subtitle tracks are real', async () => {
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.readyState >= 3; }, null, { timeout: 30000 });
    if (await page.locator('.cp-player').getAttribute('data-playback-status') === 'blocked') await page.locator('.cp-player-status button').click();
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.currentTime > 0.3; }, null, { timeout: 15000 });
    await page.getByRole('button', { name: 'إعدادات الجودة والصوت والترجمة' }).click();
    const selects = page.locator('.cp-player-settings select');
    assert.equal(await selects.count(), 3);
    assert.equal(await selects.nth(0).locator('option').count(), 3);
    assert.equal(await selects.nth(1).locator('option').count(), 2);
    await selects.nth(0).selectOption('0');
    await selects.nth(1).selectOption('1');
    await selects.nth(2).selectOption('0');
    await page.waitForTimeout(1200);
    const state = await page.locator('.cp-player video').evaluate(v => ({ time: v.currentTime, width: v.videoWidth, textTracks: v.textTracks.length, paused: v.paused }));
    assert.ok(state.time > 0.3 && state.width > 0 && !state.paused);
    assert.ok(state.textTracks >= 1);
    await page.getByRole('button', { name: 'كتم الصوت' }).click();
    assert.equal(await page.locator('.cp-player video').evaluate(v => v.muted), true);
    await page.getByRole('button', { name: 'إيقاف مؤقت' }).click();
    assert.equal(await page.locator('.cp-player video').evaluate(v => v.paused), true);
  });
  await check('EPG failure is independent and retryable; unavailable channel is disabled', async () => {
    assert.ok(await page.getByText('دليل البرامج غير متاح حالياً. يمكنك الاستمرار في مشاهدة القناة.').isVisible());
    assert.ok(await page.getByRole('button', { name: 'إعادة تحميل الدليل' }).isVisible());
    await goto('/live/fixture-broken');
    assert.ok(await page.getByText('هذه القناة غير متاحة للتشغيل').isVisible());
    assert.equal(await page.locator('.cp-player').count(), 0);
  });
  await check('DASH fixture actually decodes through dash.js', async () => {
    await goto('/live/fixture-dash');
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.readyState >= 3; }, null, { timeout: 30000 });
    if (await page.locator('.cp-player').getAttribute('data-playback-status') === 'blocked') await page.locator('.cp-player-status button').click();
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.currentTime > 0.3; }, null, { timeout: 15000 });
    assert.ok(await page.locator('.cp-player video').evaluate(v => v.videoWidth > 0));
  });
  await check('MP4 fixture decodes and transport controls work', async () => {
    await goto('/live/fixture-mp4');
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.readyState >= 3; }, null, { timeout: 30000 });
    if (await page.locator('.cp-player').getAttribute('data-playback-status') === 'blocked') await page.locator('.cp-player-status button').click();
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.currentTime > 0.3; }, null, { timeout: 15000 });
    await page.getByRole('button', { name: 'إيقاف مؤقت' }).click();
    assert.equal(await page.locator('.cp-player video').evaluate(v => v.paused), true);
    await page.getByRole('button', { name: 'تشغيل', exact: true }).click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.cp-player video').evaluate(v => v.paused), false);
  });
  await check('broken stream shows error and retry re-attaches without reloading page', async () => {
    await page.route('**/__fixtures/hls/master.m3u8', route => route.fulfill({ status: 500, body: 'fixture outage' }));
    await goto('/live/fixture-hls');
    await page.waitForSelector('.cp-player[data-playback-status="error"]', { timeout: 30000 });
    const marker = await page.evaluate(() => { window.__retryMarker = 42; return window.__retryMarker; });
    await page.unroute('**/__fixtures/hls/master.m3u8');
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await page.waitForFunction(() => { const v = document.querySelector('.cp-player video'); return v && v.readyState >= 3; }, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__retryMarker), marker);
  });
  await check('keyboard controls are scoped to the focused player', async () => {
    await page.locator('.cp-player').focus();
    await page.keyboard.press('m');
    const before = await page.locator('.cp-player video').evaluate(v => v.muted);
    await page.keyboard.press('m');
    assert.notEqual(await page.locator('.cp-player video').evaluate(v => v.muted), before);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.cp-player video').evaluate(v => v.paused), true);
  });
  await page.unroute('**/api/iptv/licensed');
  await page.unroute('**/api/iptv/epg');
  await page.unroute('**/__fixtures/**');
} else {
  console.log('  SKIP  media decoding fixtures (set MEDIA_FIXTURES to run HLS/DASH/MP4 tests)');
}
await check('no uncaught browser errors across the run', () => assert.deepEqual(pageErrors, []));
await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
