/**
 * Real-Chromium checks for the CHANNELS page (/tv-sources):
 *   • the «وين أشاهد» rights guide is gone
 *   • clicking a channel opens the shared POP-UP player, not an inline block
 *   • minimize / restore / Escape / backdrop all behave, and closing unmounts
 *     the video so the stream stops
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:popup --workspace aether-web
 *
 * Stream decode is NOT asserted here: the curated sources are real broadcaster
 * CDNs that the sandbox cannot reach. These checks cover the player UI contract
 * against the real curated list served by the app.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
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
let passed = 0; let failed = 0; const pageErrors = [];

async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', error => pageErrors.push(error.message));

// The stream itself is unreachable from the sandbox; fail it fast and quietly so
// the player renders its honest error state instead of hanging the assertions.
await page.route('**/*.m3u8', route => route.fulfill({ status: 503, body: 'offline in test' }));

try {
  await page.goto(`${base}/tv-sources`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ptv-card');

  console.log('\nChannels page — pop-up player\n');

  await check('the rights guide is no longer rendered', async () => {
    assert.equal(await page.locator('.rg').count(), 0, '.rg section still present');
    assert.equal(await page.locator('#rg-heading').count(), 0, 'rights heading still present');
    const text = await page.locator('body').innerText();
    assert.ok(!text.includes('وين أشاهد'), '«وين أشاهد» still visible');
    assert.ok(!text.includes('دليل الحقوق الرسمي'), 'rights guide subtitle still visible');
  });

  await check('the satellite reference is still available', async () => {
    assert.equal(await page.locator('.fta').count(), 1, 'satellite reference was removed by mistake');
  });

  await check('no inline player block exists before opening', async () => {
    assert.equal(await page.locator('.ptv-player').count(), 0, 'old inline player still mounted');
    assert.equal(await page.locator('[data-testid="player-modal"]').count(), 0);
  });

  await check('the star toggles a favorite without opening the player', async () => {
    await page.locator('.ptv-card').first().locator('.ptv-fav').click();
    assert.equal(await page.locator('[data-testid="player-modal"]').count(), 0, 'favorite click opened the player');
    await page.locator('.ptv-card').first().locator('.ptv-fav').click();
  });

  await check('clicking a channel opens a modal dialog', async () => {
    await page.locator('.ptv-card').first().locator('.ptv-open').click();
    await page.waitForSelector('[data-testid="player-modal"]');
    const dialog = page.locator('[data-testid="player-modal"]');
    assert.equal(await dialog.getAttribute('role'), 'dialog');
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
  });

  await check('the pop-up is portalled to body, not nested in the grid', async () => {
    const nested = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="player-modal"]');
      return Boolean(modal?.closest('.ptv-grid') || modal?.closest('.ptv'));
    });
    assert.equal(nested, false, 'modal must not render inside the channel grid');
  });

  await check('the dialog shows the channel name and a LIVE badge', async () => {
    const header = await page.locator('[data-testid="player-modal"]').innerText();
    assert.ok(header.includes('LIVE'), 'LIVE badge missing');
    const name = await page.locator('.ptv-card').first().locator('.ptv-name').innerText();
    assert.ok(header.includes(name.trim()), `header does not name the channel (${name})`);
  });

  await check('a real video element is mounted inside the dialog', async () => {
    assert.equal(await page.locator('[data-testid="player-modal"] video').count(), 1);
  });

  await check('page scroll is locked while expanded', async () => {
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  });

  await check('focus moves into the dialog', async () => {
    const inside = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="player-modal"]');
      return Boolean(modal && modal.contains(document.activeElement));
    });
    assert.equal(inside, true, 'focus stayed outside the dialog');
  });

  await check('minimize keeps the same video mounted and unlocks scroll', async () => {
    await page.locator('[data-testid="player-modal"]').getByRole('button', { name: 'تصغير المشغل' }).click();
    const panel = page.locator('[data-testid="player-modal"]');
    await page.waitForFunction(() => document.querySelector('[data-mini-player]')?.getAttribute('data-mini-player') === 'true');
    assert.equal(await panel.getAttribute('role'), 'region', 'minimized panel should not stay a modal dialog');
    assert.equal(await page.locator('[data-testid="player-modal"] video').count(), 1, 'minimize must not remount the video');
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
  });

  await check('restore returns to the expanded dialog', async () => {
    await page.locator('[data-testid="player-modal"]').getByRole('button', { name: 'استعادة المشغل' }).click();
    await page.waitForFunction(() => document.querySelector('[data-mini-player]')?.getAttribute('data-mini-player') === 'false');
    assert.equal(await page.locator('[data-testid="player-modal"]').getAttribute('role'), 'dialog');
  });

  await check('Escape closes and unmounts the video', async () => {
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
    assert.equal(await page.locator('[data-testid="player-modal"] video').count(), 0, 'video still mounted after close');
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'scroll stayed locked');
  });

  await check('the backdrop closes the player too', async () => {
    await page.locator('.ptv-card').nth(1).locator('.ptv-open').click();
    await page.waitForSelector('[data-testid="player-backdrop"]');
    await page.locator('[data-testid="player-backdrop"]').click({ position: { x: 5, y: 5 } });
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
  });

  await check('the close button closes the player', async () => {
    await page.locator('.ptv-card').first().locator('.ptv-open').click();
    await page.waitForSelector('[data-testid="player-modal"]');
    await page.locator('[data-testid="player-modal"]').getByRole('button', { name: 'إغلاق المشغل' }).click();
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
  });

  await check('the favorite star inside the dialog syncs with the card', async () => {
    const card = page.locator('.ptv-card').first();
    const before = await card.locator('.ptv-fav').getAttribute('aria-pressed');
    await card.locator('.ptv-open').click();
    await page.waitForSelector('[data-testid="player-modal"]');
    await page.locator('[data-testid="player-modal"]').getByRole('button', { name: /المفضلة/ }).click();
    const starPressed = await page.locator('[data-testid="player-modal"]').getByRole('button', { name: /المفضلة/ }).getAttribute('aria-pressed');
    assert.notEqual(starPressed, before, 'dialog star did not toggle');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
    assert.equal(await card.locator('.ptv-fav').getAttribute('aria-pressed'), starPressed, 'card star did not sync');
    await card.locator('.ptv-fav').click();
  });

  await check('the player works on a narrow mobile viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.ptv-card').first().locator('.ptv-open').click();
    await page.waitForSelector('[data-testid="player-modal"]');
    const box = await page.locator('[data-testid="player-modal"]').boundingBox();
    assert.ok(box && box.width <= 390, `modal overflows the viewport: ${box?.width}`);
    assert.ok(box && box.x >= 0 && box.y >= 0, 'modal positioned off-screen');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  await check('no uncaught page errors', async () => {
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
  });
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
