/**
 * Real-Chromium tests for the compact list, sorting engine and pop-up player.
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:channels:browser --workspace aether-web
 *   MEDIA_FIXTURES=/path/to/fixtures  (enables the real HLS decode assertions)
 *
 * The catalogs below are TEST FIXTURES injected by request interception. They
 * never ship: production still calls the real licensed endpoint, and the app
 * shows its honest "no licensed list connected" state without an operator source.
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
let passed = 0; let failed = 0; const pageErrors = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const COUNTRIES = [['IQ', 'العراق'], ['EG', 'مصر'], ['SA', 'السعودية'], ['', '']];
const GROUPS = ['Sports', 'News', 'Movies', 'General'];
function fixture(index, streamUrl) {
  const [countryCode] = COUNTRIES[index % COUNTRIES.length];
  return {
    id: `test-${index}`,
    name: `قناة اختبار ${String(index).padStart(4, '0')}`,
    group: GROUPS[index % GROUPS.length],
    epgId: countryCode ? `test.${countryCode.toLowerCase()}` : '',
    playable: true,
    streamUrl,
  };
}

async function withCatalog(page, rows) {
  await page.route('**/api/iptv/licensed', route => route.fulfill({ json: { data: rows } }));
  await page.route('**/api/iptv/epg', route => route.fulfill({ status: 503, json: { error: 'GUIDE_UNAVAILABLE' } }));
  if (mediaDir) {
    await page.route('**/__fixtures/**', route => {
      const relative = new URL(route.request().url()).pathname.replace('/__fixtures/', '');
      const file = path.join(mediaDir, relative);
      if (!file.startsWith(mediaDir) || !existsSync(file)) return route.fulfill({ status: 404, body: 'missing fixture' });
      const type = file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : file.endsWith('.vtt') ? 'text/vtt' : file.endsWith('.mpd') ? 'application/dash+xml' : file.endsWith('.mp4') ? 'video/mp4' : 'video/mp2t';
      return route.fulfill({ body: readFileSync(file), headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
    });
  }
}

async function newPage({ width = 390, height = 844, language = 'ar', theme = 'dark' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(([lang, mode]) => {
    localStorage.setItem('cloudplay-language', lang);
    localStorage.setItem('cloudplay-theme', mode);
    localStorage.setItem('cloudplay-dark-return-v1', 'done');
    localStorage.setItem('cloudplay-reduce-motion', 'true');
  }, [language, theme]);
  return { context, page };
}

const streamUrl = `${base}/__fixtures/hls/master.m3u8`;
console.log('\nCloud Play channel UI (real Chromium)\n');

// ---------------------------------------------------------------- compact list
{
  const { context, page } = await newPage();
  await withCatalog(page, Array.from({ length: 12 }, (_, index) => fixture(index, streamUrl)));
  await page.goto(`${base}/live`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.live-card, [data-testid="channel-row"]');

  await check('view toggle switches to the compact list and persists across reloads', async () => {
    assert.equal(await page.locator('.live-card').count(), 12, 'grid should render first (SSR-safe default)');
    await page.getByRole('button', { name: 'قائمة مصغرة' }).click();
    await page.waitForSelector('[data-testid="channel-scroll"]');
    assert.ok(await page.locator('[data-testid="channel-row"]').count() > 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('cloudplay-channel-view')), 'list');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="channel-scroll"]');
    assert.equal(await page.locator('.live-card').count(), 0, 'grid must not flash back after reload');
  });

  await check('compact row is 56px with star, logo, name, quality, country and play', async () => {
    const row = page.locator('[data-testid="channel-row"]').first();
    const box = await row.boundingBox();
    assert.equal(Math.round(box.height), 56);
    assert.equal(await row.locator('button[aria-pressed]').count(), 1, 'favorite star missing');
    assert.equal(await row.locator('button[aria-label^="تشغيل"]').count(), 2, 'row hit target + play button expected');
    const text = await row.innerText();
    assert.match(text, /قناة اختبار/);
    assert.match(text, /العراق|مصر|السعودية|دولة غير محددة/);
  });

  await check('favorite star toggles without opening the player', async () => {
    const star = page.locator('[data-testid="channel-row"]').first().locator('button[aria-pressed]');
    await star.click();
    assert.equal(await star.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-testid="player-modal"]').count(), 0, 'star must not open the player');
    await star.click();
    assert.equal(await star.getAttribute('aria-pressed'), 'false');
  });

  await check('RTL: row content flows right-to-left and the page never overflows horizontally', async () => {
    const geometry = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="channel-row"]');
      const star = row.querySelector('button[aria-pressed]').getBoundingClientRect();
      const play = [...row.querySelectorAll('button')].pop().getBoundingClientRect();
      return { dir: getComputedStyle(row).direction, starX: star.x, playX: play.x, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert.equal(geometry.dir, 'rtl');
    assert.ok(geometry.starX > geometry.playX, 'star must sit to the right of the play button in RTL');
    assert.ok(geometry.overflow <= 1, `horizontal overflow ${geometry.overflow}px`);
  });

  await check('sort dropdown lists the five modes and reorders the list', async () => {
    const trigger = page.locator('.live-toolbar [aria-haspopup="listbox"]');
    await trigger.click();
    const options = page.locator('[role="listbox"] [role="option"]');
    assert.equal(await options.count(), 5);
    const labels = await options.allInnerTexts();
    assert.deepEqual(labels.map(text => text.trim()), ['الافتراضي', 'أبجدي (أ-ي)', 'حسب الدولة', 'حسب الجودة', 'المفضلة أولاً']);
    const before = await page.locator('[data-testid="channel-row"]').first().getAttribute('data-channel-id');
    await options.nth(3).click(); // quality
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => localStorage.getItem('cloudplay-channel-sort')), 'quality-desc');
    const qualityFirst = await page.locator('[data-testid="channel-row"]').first().innerText();
    assert.ok(qualityFirst.length > 0);
    await trigger.click();
    await page.locator('[role="listbox"] [role="option"]').first().click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('[data-testid="channel-row"]').first().getAttribute('data-channel-id'), before, 'default order was not restored');
  });

  await check('favorites-first pins the starred channel to the top', async () => {
    const rows = page.locator('[data-testid="channel-row"]');
    const thirdId = await rows.nth(2).getAttribute('data-channel-id');
    await rows.nth(2).locator('button[aria-pressed]').click();
    await page.locator('.live-toolbar [aria-haspopup="listbox"]').click();
    await page.locator('[role="listbox"] [role="option"]').nth(4).click();
    await page.waitForTimeout(250);
    assert.equal(await rows.first().getAttribute('data-channel-id'), thirdId);
  });

  await check('sort dropdown closes with Escape and keeps focus on its trigger', async () => {
    const trigger = page.locator('.live-toolbar [aria-haspopup="listbox"]');
    await trigger.click();
    await page.waitForSelector('[role="listbox"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="listbox"]', { state: 'detached' });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  });

  await check('clicking anywhere on the row opens the pop-up player', async () => {
    const row = page.locator('[data-testid="channel-row"]').first();
    const box = await row.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('[data-testid="player-modal"]');
    const dialog = page.locator('[data-testid="player-modal"]');
    assert.equal(await dialog.getAttribute('role'), 'dialog');
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    assert.equal(await dialog.locator('video').count(), 1);
    assert.ok(await dialog.getByRole('button', { name: 'إغلاق المشغل' }).isVisible());
    assert.ok(await dialog.getByRole('button', { name: /إضافة إلى المفضلة|إزالة من المفضلة/ }).isVisible());
    assert.ok(await dialog.getByRole('button', { name: 'تصغير المشغل' }).isVisible());
    const backdrop = await page.locator('[data-testid="player-backdrop"]').evaluate(node => getComputedStyle(node).backdropFilter || getComputedStyle(node).webkitBackdropFilter);
    assert.match(backdrop, /blur/);
  });

  await check('modal header shows the channel and a LIVE indicator', async () => {
    const header = await page.locator('[data-testid="player-modal"]').innerText();
    assert.match(header, /قناة اختبار/);
    assert.match(header, /LIVE/);
  });

  await check('favorite can be toggled from inside the player', async () => {
    const star = page.locator('[data-testid="player-modal"]').getByRole('button', { name: /المفضلة/ });
    const before = await star.getAttribute('aria-pressed');
    await star.click();
    assert.notEqual(await star.getAttribute('aria-pressed'), before);
  });

  if (mediaDir) {
    await check('HLS stream really decodes inside the modal (auto-play)', async () => {
      await page.waitForFunction(() => {
        const video = document.querySelector('[data-testid="player-modal"] video');
        return video && video.readyState >= 3 && video.currentTime > 0.3;
      }, null, { timeout: 30000 });
      const state = await page.locator('[data-testid="player-modal"] video').evaluate(video => ({ width: video.videoWidth, paused: video.paused }));
      assert.ok(state.width > 0, 'no video frames decoded');
      assert.equal(state.paused, false, 'auto-play did not start');
    });

    await check('custom controls work: pause, mute and volume', async () => {
      const modal = page.locator('[data-testid="player-modal"]');
      await modal.getByRole('button', { name: 'إيقاف مؤقت' }).click();
      assert.equal(await modal.locator('video').evaluate(video => video.paused), true);
      await modal.getByRole('button', { name: 'كتم الصوت' }).click();
      assert.equal(await modal.locator('video').evaluate(video => video.muted), true);
      await modal.locator('.cp-player-volume').fill('0.4');
      assert.ok(Math.abs(await modal.locator('video').evaluate(video => video.volume) - 0.4) < 0.05);
    });
  } else {
    console.log('  SKIP  HLS decode assertions (set MEDIA_FIXTURES to run them)');
  }

  await check('minimize keeps the stream mounted in a floating card and frees the dock', async () => {
    await page.locator('[data-testid="player-modal"]').getByRole('button', { name: 'تصغير المشغل' }).click();
    await page.waitForTimeout(400);
    const panel = page.locator('[data-testid="player-modal"]');
    assert.equal(await panel.getAttribute('role'), 'region');
    const box = await panel.boundingBox();
    assert.ok(box.width <= 300, `floating card too wide: ${box.width}`);
    assert.equal(await page.locator('[data-testid="player-backdrop"]').isVisible(), false);
    assert.equal(await page.locator('.cp-global-nav').evaluate(node => node.classList.contains('cp-nav-hidden')), false, 'dock must stay usable while browsing');
    assert.equal(await panel.locator('video').count(), 1, 'stream must stay mounted');
    await panel.getByRole('button', { name: 'استعادة المشغل' }).click();
    assert.equal(await panel.getAttribute('role'), 'dialog');
  });

  await check('Escape closes the modal and unmounts the video (bandwidth stops)', async () => {
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
    assert.equal(await page.locator('[data-testid="player-modal"] video').count(), 0);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'page scroll was left locked');
  });

  await check('backdrop click closes the modal', async () => {
    await page.locator('[data-testid="channel-row"]').first().getByRole('button', { name: /^تشغيل/ }).last().click();
    await page.waitForSelector('[data-testid="player-modal"]');
    await page.locator('[data-testid="player-backdrop"]').click({ position: { x: 5, y: 5 } });
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
  });

  await check('X button closes the modal and returns focus to the list', async () => {
    await page.locator('[data-testid="channel-row"]').first().getByRole('button', { name: /^تشغيل/ }).last().click();
    await page.waitForSelector('[data-testid="player-modal"]');
    await page.locator('[data-testid="player-modal"]').getByRole('button', { name: 'إغلاق المشغل' }).click();
    await page.waitForSelector('[data-testid="player-modal"]', { state: 'detached' });
    const focused = await page.evaluate(() => document.activeElement?.closest('[data-testid="channel-row"]')?.getAttribute('data-channel-id') ?? null);
    assert.ok(focused, 'focus was not restored to the originating row');
  });

  await context.close();
}

// ------------------------------------------------------------------ LTR + grid
{
  const { context, page } = await newPage({ width: 1440, height: 900, language: 'en', theme: 'light' });
  await withCatalog(page, Array.from({ length: 8 }, (_, index) => fixture(index, streamUrl)));
  await page.goto(`${base}/live`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.live-card');

  await check('LTR desktop: grid play opens the modal, list flows left-to-right', async () => {
    await page.locator('.live-card-play').first().click();
    await page.waitForSelector('[data-testid="player-modal"]');
    assert.equal(await page.locator('[data-testid="player-modal"]').evaluate(node => node.closest('[dir]').getAttribute('dir')), 'ltr');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Compact list' }).click();
    await page.waitForSelector('[data-testid="channel-row"]');
    const geometry = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="channel-row"]');
      const star = row.querySelector('button[aria-pressed]').getBoundingClientRect();
      const play = [...row.querySelectorAll('button')].pop().getBoundingClientRect();
      return { dir: getComputedStyle(row).direction, starX: star.x, playX: play.x, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert.equal(geometry.dir, 'ltr');
    assert.ok(geometry.starX < geometry.playX);
    assert.ok(geometry.overflow <= 1);
  });

  await check('light theme keeps the new controls readable and inside the column', async () => {
    const bounds = await page.evaluate(() => {
      const shell = document.querySelector('main.live-page').getBoundingClientRect();
      const toolbar = document.querySelector('.live-toolbar').getBoundingClientRect();
      const list = document.querySelector('[data-testid="channel-scroll"]').getBoundingClientRect();
      return { shellLeft: shell.x, shellRight: shell.right, toolbarLeft: toolbar.x, toolbarRight: toolbar.right, listLeft: list.x, listRight: list.right };
    });
    assert.ok(bounds.toolbarLeft >= bounds.shellLeft - 1 && bounds.toolbarRight <= bounds.shellRight + 1);
    assert.ok(bounds.listLeft >= bounds.shellLeft - 1 && bounds.listRight <= bounds.shellRight + 1);
  });

  await context.close();
}

// ------------------------------------------------------------- virtualization
{
  const { context, page } = await newPage({ width: 390, height: 844 });
  await withCatalog(page, Array.from({ length: 7500 }, (_, index) => fixture(index, streamUrl)));
  await page.goto(`${base}/live`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'قائمة مصغرة' }).click();
  await page.waitForSelector('[data-testid="channel-row"]');

  await check('7,500 channels mount only a small window of rows', async () => {
    const stats = await page.evaluate(() => ({
      rows: document.querySelectorAll('[data-testid="channel-row"]').length,
      nodes: document.querySelectorAll('[data-testid="channel-scroll"] *').length,
      height: document.querySelector('[data-testid="channel-scroll"]').firstElementChild.getBoundingClientRect().height,
    }));
    // Bound = visible rows + 2x overscan, and a fixed node budget per row.
    assert.ok(stats.rows <= 40, `too many rows mounted: ${stats.rows}`);
    assert.ok(stats.nodes <= stats.rows * 25, `too many nodes per row: ${stats.nodes} for ${stats.rows} rows`);
    assert.ok(stats.height >= 7500 * 56 - 100, `scroll height does not cover the catalog: ${stats.height}`);
    console.log(`        ${stats.rows} rows / ${stats.nodes} nodes mounted for 7,500 channels (${Math.round(stats.height)}px scroll height)`);
  });

  await check('scrolling to the end reaches the last channel and keeps the DOM small', async () => {
    await page.locator('[data-testid="channel-scroll"]').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({
      rows: document.querySelectorAll('[data-testid="channel-row"]').length,
      ids: [...document.querySelectorAll('[data-testid="channel-row"]')].map(node => node.getAttribute('data-channel-id')),
    }));
    assert.ok(state.rows <= 40, `too many rows after scrolling: ${state.rows}`);
    assert.ok(state.ids.includes('test-7499'), 'last channel is not reachable');
  });

  await check('fast fling scrolling holds the environment frame rate (7,500 rows)', async () => {
    const timing = await page.locator('[data-testid="channel-scroll"]').evaluate(async node => {
      // Baseline rAF rate of this (headless, software-rendered) environment.
      const baselineStart = performance.now();
      for (let step = 0; step < 30; step++) await new Promise(resolve => requestAnimationFrame(resolve));
      const baselineFrameMs = (performance.now() - baselineStart) / 30;
      const longTasks = [];
      const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) longTasks.push(entry.duration); });
      try { observer.observe({ entryTypes: ['longtask'] }); } catch { /* not supported */ }
      const start = performance.now();
      let frames = 0;
      for (let step = 0; step < 60; step++) {
        node.scrollTop = step * 336; // ~6 rows per frame: a fast real fling
        await new Promise(resolve => requestAnimationFrame(() => { frames++; resolve(); }));
      }
      const elapsed = performance.now() - start;
      observer.disconnect();
      return { elapsed, frames, baselineFrameMs, worstTask: longTasks.length ? Math.max(...longTasks) : 0 };
    });
    const scrollFrameMs = timing.elapsed / timing.frames;
    assert.ok(timing.frames >= 55, `dropped frames: only ${timing.frames}/60`);
    assert.ok(scrollFrameMs <= timing.baselineFrameMs * 1.35, `scrolling slower than the environment baseline: ${scrollFrameMs.toFixed(1)}ms vs ${timing.baselineFrameMs.toFixed(1)}ms per frame`);
    assert.ok(timing.worstTask < 250, `long task of ${Math.round(timing.worstTask)}ms`);
    console.log(`        scroll ${scrollFrameMs.toFixed(1)}ms/frame vs baseline ${timing.baselineFrameMs.toFixed(1)}ms/frame, worst long task ${Math.round(timing.worstTask)}ms`);
  });

  await check('extreme jumps across the catalog stay bounded and never block the main thread', async () => {
    const stress = await page.locator('[data-testid="channel-scroll"]').evaluate(async node => {
      const longTasks = [];
      const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) longTasks.push(entry.duration); });
      try { observer.observe({ entryTypes: ['longtask'] }); } catch { /* unsupported */ }
      let maxRows = 0;
      for (let step = 0; step < 25; step++) {
        node.scrollTop = Math.round((node.scrollHeight - node.clientHeight) * (step / 24));
        await new Promise(resolve => requestAnimationFrame(resolve));
        maxRows = Math.max(maxRows, document.querySelectorAll('[data-testid="channel-row"]').length);
      }
      observer.disconnect();
      return { maxRows, worstTask: longTasks.length ? Math.max(...longTasks) : 0 };
    });
    assert.ok(stress.maxRows <= 40, `DOM grew to ${stress.maxRows} rows during jumps`);
    assert.ok(stress.worstTask < 250, `long task of ${Math.round(stress.worstTask)}ms`);
    console.log(`        25 full-catalog jumps: max ${stress.maxRows} rows mounted, worst long task ${Math.round(stress.worstTask)}ms`);
  });

  await check('search narrows 7,500 channels without breaking virtualization', async () => {
    await page.getByRole('searchbox').fill('0042');
    await page.waitForTimeout(400);
    const rows = await page.locator('[data-testid="channel-row"]').count();
    assert.ok(rows >= 1 && rows <= 5, `unexpected match count: ${rows}`);
    assert.match(await page.locator('[data-testid="channel-row"]').first().innerText(), /0042/);
  });

  await context.close();
}

// ------------------------------------------------- isolation from legacy pages
{
  const { context, page } = await newPage({ width: 390, height: 844 });
  await check('scoped Tailwind does not restyle the existing pages', async () => {
    for (const route of ['/', '/movies', '/series', '/settings']) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      const state = await page.evaluate(() => ({
        tw: document.querySelectorAll('[class*="tw-"]').length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        bodyMargin: getComputedStyle(document.body).margin,
        headingFont: getComputedStyle(document.querySelector('h1,h2')).fontWeight,
      }));
      assert.equal(state.tw, 0, `${route} picked up Tailwind utilities`);
      assert.ok(state.overflow <= 1, `${route} overflows horizontally`);
      assert.equal(state.bodyMargin, '0px', `${route} base reset changed`);
      assert.ok(state.headingFont, `${route} lost its heading styles`);
    }
  });
  await context.close();
}

await check('no uncaught page errors during the whole run', async () => { assert.deepEqual(pageErrors, []); });

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
