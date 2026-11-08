/**
 * Real-Chromium layout regression for the Live TV page and the shared bottom dock.
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:layout --workspace aether-web
 *
 * Covers 375 / 390 / 430 px phones, tablet and desktop, RTL + LTR and dark + light.
 * Every assertion measures the live DOM (no snapshots): dock reservation, dock
 * fixedness while scrolling, clearance of ALL interactive content at maximum
 * scroll, category-rail scrolling/clipping, filter grid, empty-state card and
 * page-wide horizontal overflow. Chromium comes from the environment
 * (PLAYWRIGHT_CHROMIUM_EXECUTABLE or @sparticuz/chromium); nothing is bundled.
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
let passed = 0; let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

/** `html { scroll-behavior: smooth }` means focus/anchor scrolling animates. */
async function settleScroll(page) {
  await page.evaluate(() => { window.__cpLastY = window.scrollY; window.__cpStable = 0; });
  await page.waitForFunction(() => {
    const y = window.scrollY;
    if (window.__cpLastY === y) window.__cpStable += 1;
    else { window.__cpStable = 0; window.__cpLastY = y; }
    return window.__cpStable >= 3;
  }, undefined, { polling: 120, timeout: 8000 });
}

/** Geometry of the dock's real visual top (pill, raised active circle and notch). */
const DOCK_TOP = `(() => {
  const bar = document.querySelector('.cp-nav-bar');
  if (!bar) return Infinity;
  const tops = [bar.getBoundingClientRect().top];
  const active = document.querySelector('.cp-nav-btn.cp-nav-active .cp-nav-ico');
  const notch = document.querySelector('.cp-nav-notch:not(.is-hidden)');
  if (active) tops.push(active.getBoundingClientRect().top);
  if (notch) tops.push(notch.getBoundingClientRect().top);
  return Math.min(...tops);
})()`;

const viewports = [
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-430', width: 430, height: 932 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];
const modes = [
  { language: 'ar', theme: 'dark' },
  { language: 'en', theme: 'light' },
  { language: 'ar', theme: 'light' },
  { language: 'en', theme: 'dark' },
];

console.log('\nCloud Play Live layout regression (real Chromium)\n');
const pageErrors = [];

for (const viewport of viewports) {
  for (const mode of modes) {
    // The full 4-way theme/direction matrix on one phone; the two diagonal
    // combinations everywhere else keeps the run fast without losing coverage.
    if (viewport.name !== 'phone-390' && mode.language !== (mode.theme === 'dark' ? 'ar' : 'en')) continue;
    const label = `${viewport.name} ${mode.language}/${mode.theme}`;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.width < 500, hasTouch: viewport.width < 500,
      locale: mode.language === 'ar' ? 'ar-IQ' : 'en-US',
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(`${label}: ${error.message}`));
    await page.addInitScript(([language, theme]) => {
      localStorage.setItem('cloudplay-language', language);
      localStorage.setItem('cloudplay-theme', theme);
      localStorage.setItem('cloudplay-reduce-motion', 'true');
      // The app forces dark once per device (appearance.ts); mark it as already done.
      localStorage.setItem('cloudplay-dark-return-v1', 'done');
    }, [mode.language, mode.theme]);
    const response = await page.goto(`${base}/live`, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, `${label} /live status`);
    await page.waitForSelector('.cp-nav-bar');
    await page.waitForTimeout(250);

    await check(`${label}: direction, theme and no horizontal overflow`, async () => {
      const state = await page.evaluate(() => ({
        dir: document.documentElement.dir,
        lang: document.documentElement.lang,
        light: !!document.querySelector('.site.theme-light'),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }));
      assert.equal(state.dir, mode.language === 'ar' ? 'rtl' : 'ltr');
      assert.equal(state.lang, mode.language);
      assert.equal(state.light, mode.theme === 'light');
      assert.ok(state.overflow <= 1, `page overflow ${state.overflow}px`);
    });

    await check(`${label}: dock labels are not vertically clipped`, async () => {
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.cp-nav-label')]
        .filter(node => node.scrollHeight > node.clientHeight)
        .map(node => `${node.textContent}: ${node.clientHeight}<${node.scrollHeight}`));
      assert.deepEqual(clipped, [], `clipped labels: ${clipped.join(', ')}`);
    });

    await check(`${label}: dock stays fixed while the page scrolls`, async () => {
      const before = await page.evaluate(() => document.querySelector('.cp-nav-bar').getBoundingClientRect().top);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => ({
        top: document.querySelector('.cp-nav-bar').getBoundingClientRect().top,
        position: getComputedStyle(document.querySelector('.cp-global-nav')).position,
        scrolled: window.scrollY,
      }));
      assert.equal(after.position, 'fixed');
      assert.equal(after.top, before, 'dock moved while scrolling');
      assert.ok(after.scrolled > 0 || viewport.height > 1000, 'page did not scroll');
    });

    await check(`${label}: bottom reserve covers the dock incl. raised button`, async () => {
      const reserve = await page.evaluate(dockTop => ({
        padding: parseFloat(getComputedStyle(document.body).paddingBottom),
        dockHeight: window.innerHeight - dockTop,
        scrollPadding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0,
      }), await page.evaluate(DOCK_TOP));
      assert.ok(reserve.padding >= reserve.dockHeight,
        `reserve ${reserve.padding}px < dock ${reserve.dockHeight}px`);
      assert.ok(reserve.scrollPadding >= reserve.dockHeight,
        `scroll-padding ${reserve.scrollPadding}px < dock ${reserve.dockHeight}px`);
    });

    await check(`${label}: no interactive element is covered at maximum scroll`, async () => {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await settleScroll(page);
      const covered = await page.evaluate(dockTop => [...document.querySelectorAll('main.live-page a, main.live-page button, main.live-page select, main.live-page input')]
        .map(node => ({ text: (node.textContent || node.getAttribute('aria-label') || node.tagName).trim().slice(0, 28), bottom: node.getBoundingClientRect().bottom }))
        .filter(item => item.bottom > dockTop + 1)
        .map(item => `${item.text} (${item.bottom.toFixed(1)}px)`), await page.evaluate(DOCK_TOP));
      assert.deepEqual(covered, [], `covered by the dock: ${covered.join(', ')}`);
    });

    await check(`${label}: keyboard focus scrolls clear of the dock`, async () => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await settleScroll(page);
      await page.locator('main.live-page > a.live-button').focus();
      await settleScroll(page);
      const gap = await page.evaluate(dockTop => dockTop - document.querySelector('main.live-page > a.live-button').getBoundingClientRect().bottom,
        await page.evaluate(DOCK_TOP));
      assert.ok(gap >= 0, `focused link sits ${Math.abs(gap).toFixed(1)}px under the dock`);
    });

    await check(`${label}: category rail scrolls, keeps chip size and never clips its ends`, async () => {
      const rail = await page.evaluate(async () => {
        const strip = document.querySelector('.live-categories');
        const chips = [...strip.children];
        const rtl = getComputedStyle(strip).direction === 'rtl';
        const box = () => strip.getBoundingClientRect();
        const overflowBefore = document.documentElement.scrollWidth - window.innerWidth;
        strip.scrollLeft = 0;
        await new Promise(resolve => setTimeout(resolve, 120));
        const first = chips[0].getBoundingClientRect();
        const startInset = rtl ? box().right - first.right : first.left - box().left;
        strip.scrollLeft = rtl ? -strip.scrollWidth : strip.scrollWidth;
        await new Promise(resolve => setTimeout(resolve, 120));
        const last = chips[chips.length - 1].getBoundingClientRect();
        const endInset = rtl ? last.left - box().left : box().right - last.right;
        const moved = strip.scrollLeft !== 0;
        strip.scrollLeft = 0;
        return {
          startInset, endInset, moved, rtl,
          scrollable: strip.scrollWidth > strip.clientWidth,
          shrink: getComputedStyle(chips[0]).flexShrink,
          chipClipped: chips.some(chip => chip.scrollWidth > chip.clientWidth + 1),
          active: chips.filter(chip => chip.getAttribute('aria-pressed') === 'true').length,
          overflowDelta: (document.documentElement.scrollWidth - window.innerWidth) - overflowBefore,
        };
      });
      assert.equal(rail.rtl, mode.language === 'ar');
      assert.ok(rail.scrollable, 'rail is not horizontally scrollable');
      assert.ok(rail.moved, 'rail did not scroll');
      assert.equal(rail.shrink, '0', 'chips are allowed to shrink');
      assert.equal(rail.chipClipped, false, 'a chip clips its own label');
      assert.equal(rail.active, 1, 'active category highlight lost');
      assert.ok(rail.startInset >= 0, `first chip clipped by ${Math.abs(rail.startInset).toFixed(1)}px`);
      assert.ok(rail.endInset >= 0, `last chip clipped by ${Math.abs(rail.endInset).toFixed(1)}px`);
      assert.ok(rail.overflowDelta <= 1, `rail scrolling widened the page by ${rail.overflowDelta}px`);
    });

    await check(`${label}: filter fields stay aligned and legible`, async () => {
      const fields = await page.evaluate(() => [...document.querySelectorAll('.live-filter-row label')].map(node => {
        const box = node.getBoundingClientRect();
        const select = node.querySelector('select');
        return { x: box.x, y: box.y, w: box.width, h: box.height, control: select.getBoundingClientRect().height, right: box.right };
      }));
      assert.equal(fields.length, 3);
      const shell = await page.evaluate(() => document.querySelector('main.live-page').getBoundingClientRect());
      for (const field of fields) {
        assert.ok(field.control >= 44, `select shorter than 44px: ${field.control}`);
        assert.ok(field.x >= shell.x - 1 && field.right <= shell.right + 1, 'filter escapes the content column');
      }
      if (viewport.width <= 650) {
        assert.equal(fields[0].y, fields[1].y, 'country/quality not on one row');
        assert.ok(Math.abs(fields[0].w - fields[1].w) <= 1, 'country/quality widths differ');
        assert.ok(fields[2].y > fields[1].y, 'sort should take the full second row');
        assert.ok(Math.abs(fields[2].w - (fields[0].w * 2 + 10)) <= 1, 'sort is not full width');
      } else {
        assert.equal(fields[0].y, fields[2].y, 'filters not on one row');
        assert.ok(Math.abs(fields[0].w - fields[2].w) <= 1, 'filter widths differ');
      }
    });

    await check(`${label}: empty-state card fits the column and keeps its message`, async () => {
      const card = await page.evaluate(() => {
        const node = document.querySelector('.live-empty');
        if (!node) return null;
        const box = node.getBoundingClientRect();
        const button = node.querySelector('.live-button').getBoundingClientRect();
        const heading = node.querySelector('h2');
        return {
          x: box.x, right: box.right, w: box.width, h: box.height,
          title: heading.textContent.trim(),
          titleFits: heading.scrollWidth <= heading.clientWidth + 1,
          buttonInside: button.left >= box.left && button.right <= box.right && button.bottom <= box.bottom,
          buttonHeight: button.height,
        };
      });
      assert.ok(card, 'empty state missing (operator source must stay unconfigured in tests)');
      assert.equal(card.title, mode.language === 'ar' ? 'لم تُربط قائمة قنوات مرخّصة بعد' : 'No licensed channel list is connected yet');
      const shell = await page.evaluate(() => document.querySelector('main.live-page').getBoundingClientRect());
      assert.ok(card.x >= shell.x - 1 && card.right <= shell.right + 1, 'card escapes the content column');
      assert.equal(card.titleFits, true, 'card title overflows');
      assert.equal(card.buttonInside, true, 'card action escapes the card');
      assert.ok(card.buttonHeight >= 44, 'card action below 44px touch target');
      assert.ok(card.h <= viewport.height * 0.6, `card too tall: ${card.h}px`);
    });

    await context.close();
  }
}

// Populated catalog: test-only interception (production still calls the real
// licensed endpoint). Verifies the Live page no longer inherits the Home page's
// `.live-section` / `.live-panel` rules from globals.css.
for (const width of [375, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 }, isMobile: width < 500, hasTouch: width < 500 });
  const catalog = await ctx.newPage();
  catalog.on('pageerror', error => pageErrors.push(`catalog-${width}: ${error.message}`));
  await catalog.addInitScript(() => {
    localStorage.setItem('cloudplay-language', 'ar');
    localStorage.setItem('cloudplay-theme', 'dark');
    localStorage.setItem('cloudplay-dark-return-v1', 'done');
  });
  await catalog.route('**/api/iptv/licensed', route => route.fulfill({ json: { data: [
    { id: 'layout-1', name: 'قناة اختبار التخطيط الأولى', group: 'Sports', epgId: '', playable: false },
    { id: 'layout-2', name: 'قناة اختبار التخطيط الثانية بعنوان طويل جداً', group: 'News', epgId: '', playable: false },
  ] } }));
  await catalog.route('**/api/iptv/epg', route => route.fulfill({ status: 503, json: { error: 'GUIDE_UNAVAILABLE' } }));

  await check(`catalog ${width}px: category sections keep Live spacing (no Home-style 85px band)`, async () => {
    await catalog.goto(`${base}/live`, { waitUntil: 'networkidle' });
    await catalog.waitForSelector('.live-card');
    const state = await catalog.evaluate(() => ({
      sections: [...document.querySelectorAll('.live-channel-section')].map(node => parseFloat(getComputedStyle(node).paddingBottom)),
      legacy: document.querySelectorAll('main.live-page .live-section').length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cards: [...document.querySelectorAll('.live-card')].map(node => node.scrollWidth - node.clientWidth),
    }));
    assert.ok(state.sections.length >= 1, 'no category sections rendered');
    assert.ok(state.sections.every(value => value === 0), `inherited Home padding: ${state.sections.join(',')}`);
    assert.equal(state.legacy, 0, 'Live still uses the Home class name');
    assert.ok(state.overflow <= 1, `catalog overflow ${state.overflow}px`);
    assert.ok(state.cards.every(value => value <= 1), 'a channel card clips its content');
  });

  await check(`catalog ${width}px: detail panels are stacked blocks, not the Home hero flex row`, async () => {
    await catalog.goto(`${base}/live/layout-1`, { waitUntil: 'networkidle' });
    await catalog.waitForSelector('.live-info-panel');
    const panels = await catalog.evaluate(() => [...document.querySelectorAll('.live-info-panel')].map(node => {
      const cs = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return { display: cs.display, minHeight: cs.minHeight, overflow: cs.overflow, width: box.width, clipped: node.scrollWidth > node.clientWidth + 1 };
    }));
    assert.ok(panels.length >= 2);
    for (const panel of panels) {
      assert.equal(panel.display, 'block', 'detail panel inherited the Home flex row');
      assert.ok(panel.minHeight === '0px' || panel.minHeight === 'auto', `detail panel inherited the Home hero height: ${panel.minHeight}`);
      assert.equal(panel.overflow, 'visible');
      assert.equal(panel.clipped, false, 'detail panel clips its content');
    }
  });
  await ctx.close();
}

// The shared dock and stylesheet must not regress the other sections.
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(`regression: ${error.message}`));
await page.addInitScript(() => { localStorage.setItem('cloudplay-language', 'ar'); localStorage.setItem('cloudplay-theme', 'dark'); });
const dockRoutes = new Set(['/', '/movies', '/series', '/live', '/favorites', '/settings']);
for (const route of ['/', '/movies', '/series', '/my-tv', '/tv-sources', '/settings', '/favorites']) {
  await check(`regression ${route}: renders, dock intact, no overflow, content clear at bottom`, async () => {
    const response = await page.goto(base + route, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200);
    await page.waitForSelector('.cp-nav-bar');
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      labels: [...document.querySelectorAll('.cp-nav-label')].filter(node => node.scrollHeight > node.clientHeight).length,
      raised: !!document.querySelector('.cp-nav-btn.cp-nav-active .cp-nav-ico'),
    }));
    assert.ok(state.overflow <= 1, `${route} overflow ${state.overflow}px`);
    assert.equal(state.labels, 0, `${route} has clipped dock labels`);
    // Only the six dock destinations have an active (raised) item by design.
    assert.equal(state.raised, dockRoutes.has(route), `${route} raised-button state changed`);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await settleScroll(page);
    const covered = await page.evaluate(dockTop => [...document.querySelectorAll('main a, main button')]
      .filter(node => node.getBoundingClientRect().bottom > dockTop + 1 && node.getBoundingClientRect().height > 0)
      .map(node => (node.textContent || node.tagName).trim().slice(0, 30)), await page.evaluate(DOCK_TOP));
    assert.deepEqual(covered, [], `${route} content under the dock at max scroll: ${covered.join(', ')}`);
  });
}
await context.close();

await check('no uncaught page errors during the whole matrix', async () => {
  assert.deepEqual(pageErrors, []);
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
