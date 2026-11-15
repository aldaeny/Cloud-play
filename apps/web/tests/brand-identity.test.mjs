/**
 * Brand identity — static regression (no browser required).
 *
 * The identity board is server-rendered, so the most valuable cheap guard is:
 * every part of the lockup, the three appearances, the four platforms and the
 * four content scenes exist in the served HTML, and the OLED appearance is a
 * real theme (tokens + boot script + native enums), not a label in a menu.
 *
 * Run against a production build:
 *   BASE_URL=http://127.0.0.1:3001 node tests/brand-identity.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const base = (process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

let passed = 0;
const failures = [];

async function check(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = path => readFileSync(join(web, path), 'utf8');

console.log('\nCloud Play — brand identity\n');

const response = await fetch(`${base}/brand`);
const html = await response.text();

await check('GET /brand answers 200 with the identity board', async () => {
  assert(response.status === 200, `status ${response.status}`);
  assert(html.includes('cp-brand-board'), 'identity board missing');
  assert(html.includes('cp-brand-plate'), 'primary lockup missing');
});

await check('the lockup carries the mark, wordmark and tagline', async () => {
  assert(html.includes('ENTERTAINMENT ANYWHERE'), 'wordmark tagline missing');
  assert(html.includes('كل ما تحب مشاهدته في مكان واحد'), 'Arabic tagline missing');
  assert(html.includes('أفلام • مسلسلات • قنوات • بث مباشر'), 'pillars missing');
  assert(html.includes('cp-play-head'), 'logo gradient missing');
});

await check('appearance offers dark, OLED black and light', async () => {
  for (const label of ['داكن', 'أسود', 'فاتح']) {
    assert(html.includes(`>${label}<`), `missing appearance ${label}`);
  }
});

await check('platforms list the four targets', async () => {
  for (const label of ['الويب', 'آيفون', 'أندرويد', 'webOS']) {
    assert(html.includes(label), `missing platform ${label}`);
  }
  assert(html.includes('أنت هنا'), 'no “you are here” platform marker');
});

await check('actions cover intro, identity, sound and copy', async () => {
  assert(html.includes('إعادة الانترو'), 'intro action missing');
  assert(html.includes('عرض شاشة الهوية'), 'identity action missing');
  assert(html.includes('الصوت مفعّل'), 'sound state missing');
  assert(html.includes('نسخ'), 'copy action missing');
});

await check('palette shows five token swatches with hex values', async () => {
  assert(html.includes('cp-brand-swatches'), 'palette missing');
  assert(html.includes('#d01b7f'), 'accent hex missing');
  assert(html.includes('#08090d'), 'dark canvas hex missing');
  const source = read('src/components/brand/BrandIdentity.tsx');
  assert(source.includes("black: '#000000'"), 'OLED canvas is not part of the palette');
});

await check('four content scenes render with real copy', async () => {
  assert(html.includes('cp-brand-scene-grid'), 'scene grid missing');
  for (const title of ['أفق السحاب: المهمة الأخيرة', 'ليالي القاهرة الرقمية', 'باقة السينما والوثائقيات', 'نهائي دوري أبطال أوروبا']) {
    assert(html.includes(title), `missing scene ${title}`);
  }
});

await check('the identity overlay and intro are wired', async () => {
  const component = read('src/components/brand/BrandIntro.tsx');
  assert(component.includes("role=\"dialog\""), 'overlay lacks a dialog role');
  assert(component.includes('AudioContext'), 'no synthesised chime');
  assert(component.includes("mode === 'identity'"), 'identity mode missing');
  assert(component.includes('prefers-reduced-motion') || component.includes('reduceMotion'), 'motion preference ignored');
});

await check('OLED black is a real theme, not a menu label', async () => {
  const theme = read('src/styles/theme.css');
  assert(theme.includes("[data-theme='black']"), 'no black token block');
  assert(theme.includes('--cp-bg: #000000'), 'canvas is not true black');
  const boot = read('src/lib/boot.ts');
  assert(boot.includes("mode!=='black'"), 'boot script rejects black');
  const appearance = read('src/lib/appearance.ts');
  assert(appearance.includes("'black'"), 'appearance model lacks black');
});

await check('native appearances round-trip the stored value', async () => {
  const swift = read('../../mobile/ios/Aether/DesignSystem/CloudPlayTheme.swift');
  const kotlin = read('../../mobile/android/app/src/main/java/com/aether/android/designsystem/CloudPlayTheme.kt');
  assert(swift.includes('case system, dark, black, light'), 'iOS enum missing black');
  assert(kotlin.includes('BLACK("أسود", "Black")'), 'Android enum missing black');
});

await check('the identity board is reachable from the site', async () => {
  const footer = read('src/components/layout/SiteFooter.tsx');
  const settings = read('src/components/settings/SettingsCards.tsx');
  assert(footer.includes('href="/brand"'), 'footer has no identity link');
  assert(settings.includes('href="/brand"'), 'settings has no identity link');
});

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
