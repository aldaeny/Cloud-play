/**
 * Universal Liquid Glass — cross-surface design regression.
 *
 *   BASE_URL=http://127.0.0.1:3001 npm run test:design --workspace aether-web
 *
 * Everything is measured from the live DOM: direction, language, resolved
 * appearance, horizontal overflow, runtime switching (no reload), focus rings,
 * reduced motion, control metrics and the player surface. No snapshots.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
let executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '';
let args = [];
let env = { ...process.env };
if (!executable) {
  try {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    executable = await sparticuz.executablePath();
    args = [...sparticuz.args, '--disable-gpu', '--disable-dev-shm-usage'].filter(arg => arg !== '--single-process');
    if (existsSync('/tmp/al2023/lib')) env = { ...env, LD_LIBRARY_PATH: '/tmp/al2023/lib', FONTCONFIG_PATH: '/tmp/fonts' };
  } catch { executable = chromium.executablePath(); }
}

const browser = await chromium.launch({ executablePath: executable, headless: true, args, env });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
let passed = 0; let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

async function open(path, lang = 'ar', theme = 'system') {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(([l, t]) => {
    window.localStorage.setItem('cloudplay-language', l);
    window.localStorage.setItem('cloudplay-theme', t);
    window.__cpMarker = Math.random().toString(36);
  }, [lang, theme]);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return { page, errors };
}

const ROUTES = ['/', '/movies', '/series', '/live', '/favorites', '/search', '/settings', '/about'];
const ID = 'bunny';

// One page for the whole matrix: dozens of pages on one Chromium instance made
// the renderer run out of memory in constrained CI containers.
const matrixPage = await context.newPage();
for (const [width, height, label] of [[1440, 900, 'desktop'], [834, 1112, 'tablet'], [390, 844, 'phone']]) {
  await matrixPage.setViewportSize({ width, height });
  for (const lang of ['ar', 'en']) {
    for (const theme of ['dark', 'light']) {
      await check(`${label} ${lang}/${theme}: direction, theme and overflow on ${ROUTES.length} routes`, async () => {
        await matrixPage.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await matrixPage.evaluate(([l, t]) => {
          window.localStorage.setItem('cloudplay-language', l);
          window.localStorage.setItem('cloudplay-theme', t);
        }, [lang, theme]);
        for (const route of ROUTES) {
          await matrixPage.goto(base + route, { waitUntil: 'networkidle' });
          await matrixPage.waitForTimeout(120);
          const state = await matrixPage.evaluate(() => {
            const html = document.documentElement;
            const dock = document.querySelector('.cp-nav-bar');
            const header = document.querySelector('.app-header');
            return {
              lang: html.lang, dir: html.dir, theme: html.dataset.theme,
              docWidth: document.documentElement.scrollWidth, winWidth: window.innerWidth,
              bodyBg: getComputedStyle(document.body).backgroundColor,
              dock: !!dock && getComputedStyle(dock).display !== 'none',
              header: !!header,
              title: (document.querySelector('h1')?.textContent || '').trim(),
            };
          });
          assert.equal(state.lang, lang, `${route}: html lang`);
          assert.equal(state.dir, lang === 'ar' ? 'rtl' : 'ltr', `${route}: html dir`);
          assert.equal(state.theme, theme, `${route}: resolved theme`);
          assert.ok(state.docWidth <= state.winWidth + 1, `${route}: horizontal overflow ${state.docWidth} > ${state.winWidth}`);
          assert.ok(state.header, `${route}: shared header missing`);
          if (width < 900) assert.ok(state.dock, `${route}: floating dock missing`);
          assert.ok(state.title.length > 0, `${route}: no h1`);
          const [r, g, b] = state.bodyBg.match(/\d+/g).map(Number);
          const luminance = (r + g + b) / 3;
          assert.ok(theme === 'dark' ? luminance < 90 : luminance > 180, `${route}: body background does not match theme (${state.bodyBg})`);
        }
      });
    }
  }
}
await matrixPage.close();

await check('language switches at runtime without a reload', async () => {
  const { page } = await open('/movies/sintel', 'ar', 'dark');
  const marker = await page.evaluate(() => window.__cpMarker);
  await page.locator('.app-lang-pill').click();
  await page.locator('[role="menuitemradio"]', { hasText: 'English' }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({
    marker: window.__cpMarker,
    dir: document.documentElement.dir,
    nav: Array.from(document.querySelectorAll('.cp-nav-bar a')).map(a => a.textContent?.trim()).join('|'),
    body: document.body.innerText,
  }));
  assert.equal(state.marker, marker, 'page reloaded instead of switching in place');
  assert.equal(state.dir, 'ltr');
  assert.match(state.nav, /Movies/);
  assert.ok(!state.body.includes('متابعة المشاهدة'), 'Arabic labels still rendered after switching to English');
  await page.close();
});

await check('appearance switches at runtime and persists', async () => {
  const { page } = await open('/', 'en', 'dark');
  await page.locator('.app-theme-btn').click();
  await page.locator('[role="menuitemradio"]', { hasText: 'Light' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = background.match(/\d+/g).map(Number);
  assert.ok((r + g + b) / 3 > 180, `light theme body stayed dark: ${background}`);
  const stored = await page.evaluate(() => window.localStorage.getItem('cloudplay-theme'));
  assert.equal(stored, 'light');
  // A fresh page (no init script) proves the preference survives a reload.
  const reopened = await context.newPage();
  await reopened.goto(base + '/', { waitUntil: 'networkidle' });
  assert.equal(await reopened.evaluate(() => document.documentElement.dataset.theme), 'light');
  await reopened.close();
  await page.close();
});

await check('system mode follows the OS colour scheme', async () => {
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('cloudplay-theme', 'system'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.close();
});

await check('Arabic typography and bidi isolation', async () => {
  const { page } = await open('/', 'ar', 'dark');
  const state = await page.evaluate(() => {
    const h1 = document.querySelector('.cp-hero h1');
    const brand = document.querySelector('.app-header-brand');
    const sub = document.querySelector('.cp-hero__sub');
    const numbers = document.querySelectorAll('.cp-hero__stats dd');
    return {
      tracking: getComputedStyle(h1).letterSpacing,
      brandDir: getComputedStyle(brand).direction,
      subDir: getComputedStyle(sub).direction,
      numeral: numbers.length ? numbers[0].textContent.trim() : '',
      font: getComputedStyle(h1).fontFamily,
    };
  });
  assert.ok(['normal', '0px'].includes(state.tracking), `Arabic display tracking must be neutral, got ${state.tracking}`);
  assert.equal(state.brandDir, 'ltr', 'Latin brand must stay isolated from RTL flow');
  assert.equal(state.subDir, 'rtl');
  assert.match(state.font, /Noto Sans Arabic|IBM Plex Sans Arabic/i);
  assert.match(state.numeral, /^[0-9,٬]+$/, `expected localised numerals, got ${state.numeral}`);
  await page.close();
});

await check('focus rings are visible on keyboard navigation', async () => {
  const { page } = await open('/', 'en', 'dark');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { tag: el.tagName, style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  assert.notEqual(outline.style, 'none', `no focus ring on ${outline.tag}`);
  assert.ok(parseFloat(outline.width) >= 2, `focus ring too thin: ${outline.width}`);
  await page.close();
});

await check('reduced motion collapses the transition timings', async () => {
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => window.localStorage.setItem('cloudplay-language', 'en'));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const durations = await page.evaluate(() => {
    const site = document.querySelector('.site');
    const hero = document.querySelector('.cp-hero');
    return [getComputedStyle(site), getComputedStyle(hero)].map(style => style.transitionDuration + '|' + style.animationDuration);
  });
  for (const value of durations) {
    const seconds = value.split('|').flatMap(part => part.split(',')).map(part => Number.parseFloat(part));
    assert.ok(seconds.every(part => !Number.isFinite(part) || part <= 0.01), `motion not reduced: ${value}`);
  }
  await page.close();
});

await check('every interactive control meets the touch target', async () => {
  const { page } = await open('/settings', 'ar', 'dark');
  const small = await page.evaluate(() => {
    const offenders = [];
    for (const el of document.querySelectorAll('button, a, [role="switch"], input[type="range"], select')) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      // Inline text links and the hidden native checkbox inside a switch label
      // are measured through their visible control instead.
      if (getComputedStyle(el).display === 'inline') continue;
      if (el.matches('input[type="checkbox"], input[type="radio"]')) continue;
      if (rect.height < 30 || rect.width < 30) offenders.push(`${el.tagName}.${el.className}`.slice(0, 60) + ` ${Math.round(rect.width)}×${Math.round(rect.height)}`);
    }
    return offenders.slice(0, 8);
  });
  assert.deepEqual(small, [], `controls below 32px: ${small.join(', ')}`);
  await page.close();
});

await check('player surface is wired and localised', async () => {
  const { page } = await open(`/movies/${ID}`, 'en', 'dark');
  await page.waitForSelector('.cp-player', { timeout: 20000 }).catch(async () => {
    await page.locator('.film-play, .cp-btn').first().click();
    await page.waitForSelector('.cp-player', { timeout: 20000 });
  });
  const state = await page.evaluate(() => {
    const player = document.querySelector('.cp-player');
    const bar = player.querySelector('.cp-player-bar');
    return {
      dir: getComputedStyle(player).direction,
      keys: bar ? bar.querySelectorAll('button').length : 0,
      seek: !!player.querySelector('.cp-player-seek, .cp-player-volume'),
      label: player.getAttribute('aria-label'),
      live: !!player.querySelector('.cp-player-top strong'),
    };
  });
  assert.equal(state.dir, 'ltr', 'playback controls must not mirror the RTL page');
  assert.ok(state.keys >= 4, `control bar has only ${state.keys} buttons`);
  assert.ok(state.seek, 'player has no slider');
  assert.ok(state.label && !/[\u0600-\u06FF]/.test(state.label), `player label not localised: ${state.label}`);
  await page.close();
});

await check('the page never throws while switching everything at once', async () => {
  const { page, errors } = await open('/', 'ar', 'dark');
  await page.locator('.app-lang-pill').click();
  await page.locator('[role="menuitemradio"]', { hasText: 'English' }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.locator('.app-theme-btn').click();
  await page.locator('[role="menuitemradio"]', { hasText: 'Light' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.locator('.cp-nav-bar a[href="/live"]').click();
  await page.waitForURL('**/live');
  await page.waitForTimeout(600);
  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  await page.close();
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
