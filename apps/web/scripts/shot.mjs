/** Design-review screenshots: node scripts/shot.mjs [baseUrl] */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const out = 'docs/design-review';
mkdirSync(out, { recursive: true });

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
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
async function shot(name, route, opts = {}) {
  if (only && !only.includes(name)) return;
  const { width = 1440, height = 1000, lang = 'ar', theme = 'dark', full = true, skipIntro = true } = opts;
  const browser = await chromium.launch({ executablePath: executable, headless: true, args, env });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([l, t]) => {
    try {
      localStorage.setItem('cloudplay-language', l);
      localStorage.setItem('cloudplay-theme', t);
      localStorage.setItem('cloudplay-dark-return-v1', 'done'); // readAppearance() otherwise forces dark once
      localStorage.setItem('cloudplay-reduce-motion', 'true'); // no intro, no reveal animations
    } catch {}
  }, [lang, theme]);
  const page = await ctx.newPage();
  const resp = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => ({ status: () => `ERR ${e.message}` }));
  await page.waitForTimeout(600);
  if (skipIntro) { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500); }
  const status = typeof resp?.status === 'function' ? resp.status() : '?';
  console.log(`${name}: ${status}`);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  await ctx.close();
  await browser.close();
}

await shot('01-home-dark-ar', '/');
await shot('02-home-light-ar', '/', { theme: 'light' });
await shot('03-home-dark-en', '/', { lang: 'en' });
await shot('04-movies-dark-ar', '/movies');
await shot('05-live-dark-ar', '/live');
await shot('06-settings-dark-ar', '/settings');
await shot('07-home-mobile-dark', '/', { width: 390, height: 844 });
if (process.env.PART2) await shot('08-movies-light-en', '/movies', { lang: 'en', theme: 'light' });
if (process.env.PART2) await shot('09-about-dark-en', '/about', { lang: 'en' });
if (process.env.PART2) await shot('10-tvsources-dark-ar', '/tv-sources');

console.log('done');
