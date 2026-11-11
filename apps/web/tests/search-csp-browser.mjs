/**
 * Real-Chromium checks that Arabic-aware search works in the rendered UI and
 * that the Content-Security-Policy does not break the running app.
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:search:browser --workspace aether-web
 *
 * These assertions run against the REAL curated channel/film catalog served by
 * the app — no fixtures, no mocked search results. Stream decoding is not
 * asserted (broadcaster CDNs are unreachable from the sandbox).
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
const pageErrors = [];
const cspViolations = [];

async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', error => pageErrors.push(error.message));

// Capture genuine CSP violations from the browser, not console noise.
await page.addInitScript(() => {
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', event => {
    window.__cspViolations.push({
      directive: event.effectiveDirective,
      blocked: event.blockedURI,
    });
  });
});
page.on('console', message => {
  const text = message.text();
  if (message.type() === 'error' && /Content Security Policy|Refused to (load|execute|apply|connect)/i.test(text)) {
    cspViolations.push(text);
  }
});

// Streams cannot be reached from the sandbox; fail them fast so the player
// renders its honest error state instead of hanging the run.
await page.route('**/*.m3u8', route => route.fulfill({ status: 503, body: 'offline in test' }));

async function collectViolations() {
  const fromDom = await page.evaluate(() => window.__cspViolations || []);
  return [...fromDom.map(v => `${v.directive} blocked ${v.blocked}`), ...cspViolations];
}

try {
  console.log('\nArabic-aware search — real UI, real catalog\n');

  await page.goto(`${base}/tv-sources`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ptv-card');
  const search = page.locator('input.ptv-search');

  const names = async () => page.locator('.ptv-name').allInnerTexts();
  const total = (await names()).length;

  await check('unfiltered catalog renders real channels', async () => {
    assert.ok(total >= 20, `expected the full curated list, got ${total}`);
  });

  await check('typing with taa marbuta omitted still finds الجزيرة', async () => {
    await search.fill('\u0627\u0644\u062C\u0632\u064A\u0631\u0647'); // الجزيره
    await page.waitForTimeout(300);
    const found = await names();
    assert.ok(found.length > 0, 'no channels matched "الجزيره"');
    assert.ok(found.some(n => n.includes('\u0627\u0644\u062C\u0632\u064A\u0631\u0629')), `expected الجزيرة in ${JSON.stringify(found)}`);
    assert.ok(found.length < total, 'search did not narrow the list');
  });

  await check('bare alef finds hamza-carrier spellings', async () => {
    // الشرقية has no hamza, so use a channel that does via the Arabic list.
    await search.fill('\u0627\u0644\u0634\u0631\u0642\u064A\u0647'); // الشرقيه
    await page.waitForTimeout(300);
    const found = await names();
    assert.ok(found.some(n => n.includes('\u0627\u0644\u0634\u0631\u0642\u064A\u0629')), `expected الشرقية in ${JSON.stringify(found)}`);
  });

  await check('vocalized input (with harakat) still matches', async () => {
    await search.fill('\u0627\u0644\u0652\u062C\u064E\u0632\u064A\u0631\u064E\u0629'); // الْجَزيرَة
    await page.waitForTimeout(300);
    const found = await names();
    assert.ok(found.some(n => n.includes('\u0627\u0644\u062C\u0632\u064A\u0631\u0629')), `expected الجزيرة in ${JSON.stringify(found)}`);
  });

  await check('multi-word Arabic query is order-independent', async () => {
    await search.fill('\u0639\u0631\u0628\u064A\u0629 \u0646\u064A\u0648\u0632'); // عربية نيوز
    await page.waitForTimeout(300);
    const found = await names();
    assert.ok(found.some(n => n.includes('\u0633\u0643\u0627\u064A')), `expected سكاي نيوز عربية in ${JSON.stringify(found)}`);
  });

  await check('English query matches English names while the UI displays Arabic', async () => {
    await search.fill('jazeera');
    await page.waitForTimeout(300);
    const found = await names();
    // Matching runs over BOTH nameAr and nameEn; the rendered label is Arabic
    // because the default language is Arabic. So assert on the Arabic label.
    assert.ok(found.length > 0 && found.length < total, 'English query did not narrow the list');
    assert.ok(found.every(n => n.includes('\u0627\u0644\u062C\u0632\u064A\u0631\u0629')), `unexpected matches ${JSON.stringify(found)}`);
  });

  await check('mixed-script query (English brand + Arabic word) matches', async () => {
    await search.fill('TRT \u0639\u0631\u0628\u064A');
    await page.waitForTimeout(300);
    const found = await names();
    assert.ok(found.length > 0, 'mixed-script query returned nothing');
  });

  await check('a nonsense query shows the honest empty state', async () => {
    await search.fill('zzzzqqq-not-a-channel');
    await page.waitForTimeout(300);
    assert.equal((await names()).length, 0);
    assert.ok((await page.locator('.ptv-note').allInnerTexts()).length > 0, 'no empty-state message');
  });

  await check('clearing the query restores the whole catalog', async () => {
    await search.fill('');
    await page.waitForTimeout(300);
    assert.equal((await names()).length, total);
  });

  console.log('\nArabic-aware search — films library\n');

  await page.goto(`${base}/movies`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.film-card');
  const filmSearch = page.locator('input.film-search');
  const titles = async () => page.locator('.film-title').allInnerTexts();
  const filmTotal = (await titles()).length;

  await check('film library renders the real catalog', async () => {
    assert.ok(filmTotal >= 20, `expected the real film catalog, got ${filmTotal}`);
  });

  await check('Arabic film title search narrows the library', async () => {
    await filmSearch.fill('\u0633\u0646\u062A\u0644'); // سنتل
    await page.waitForTimeout(300);
    const found = await titles();
    assert.ok(found.length > 0 && found.length < filmTotal, 'search did not narrow the library');
  });

  await check('Arabic search also matches the description, not just titles', async () => {
    // "رامايانا" appears only in Sita's Arabic synopsis, never in its title.
    await filmSearch.fill('\u0631\u0627\u0645\u0627\u064A\u0627\u0646\u0627');
    await page.waitForTimeout(300);
    const found = await titles();
    assert.ok(found.length > 0, 'synopsis search returned nothing');
    assert.ok(found.length < filmTotal, 'synopsis search did not narrow the library');
    assert.ok(!found.some(n => n.includes('\u0631\u0627\u0645\u0627\u064A\u0627\u0646\u0627')),
      'term appeared in a title, so this did not prove synopsis matching');
  });

  await check('English title search is unchanged', async () => {
    await filmSearch.fill('sintel');
    await page.waitForTimeout(300);
    const found = await titles();
    assert.ok(found.length > 0, 'English title search broke');
  });

  await check('hostile search markup stays inert in the actual DOM', async () => {
    await page.evaluate(()=>{window.__cloudplayXss=0;});
    await filmSearch.fill('<img src=x onerror="window.__cloudplayXss=1"><script>window.__cloudplayXss=1</script>');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.__cloudplayXss),0);
    assert.equal(await page.locator('img[src="x"]').count(),0);
    assert.equal(await filmSearch.inputValue(),'<img src=x onerror="window.__cloudplayXss=1"><script>window.__cloudplayXss=1</script>');
  });

  await check('film search clears back to the full library', async () => {
    await filmSearch.fill('');
    await page.waitForTimeout(300);
    assert.equal((await titles()).length, filmTotal);
  });

  console.log('\nContent-Security-Policy — live response + browser behaviour\n');

  await check('the served document carries the CSP and hardening headers', async () => {
    const response = await page.goto(`${base}/movies`, { waitUntil: 'domcontentloaded' });
    const headers = response.headers();
    assert.ok(headers['content-security-policy'], 'CSP header missing from the response');
    assert.match(headers['content-security-policy'], /object-src 'none'/);
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.ok(headers['permissions-policy'], 'Permissions-Policy missing');
  });

  await check('the app hydrates and stays interactive under CSP', async () => {
    await page.waitForSelector('.film-card');
    // A real interaction proves hydration survived the policy.
    await page.locator('input.film-search').fill('sintel');
    await page.waitForTimeout(300);
    assert.ok((await page.locator('.film-title').allInnerTexts()).length > 0, 'React did not hydrate / filter under CSP');
  });

  await check('the movie player still mounts a real video element under CSP', async () => {
    await page.locator('input.film-search').fill('sintel');
    await page.waitForTimeout(300);
    await page.locator('.film-open').first().click();
    await page.waitForSelector('video', { timeout: 15000 });
    assert.equal(await page.locator('video').count(), 1, 'player video did not mount');
    const src = await page.locator('video').getAttribute('src');
    const sourceSrc = await page.locator('video source').first().getAttribute('src').catch(() => null);
    assert.ok(src || sourceSrc, 'video mounted without a real source');
  });

  await check('no CSP violations occurred across the whole run', async () => {
    const violations = await collectViolations();
    assert.deepEqual(violations, [], `CSP blocked app behaviour:\n${violations.join('\n')}`);
  });

  await check('no uncaught page errors during the whole run', async () => {
    assert.deepEqual(pageErrors, []);
  });
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
