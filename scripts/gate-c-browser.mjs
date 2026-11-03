/**
 * GATE C browser proof.
 *
 * Loads the real Next.js app in headless Chromium, drives the Live UI exactly as
 * a user would (open /live, wait for the catalogue, click a channel), and then
 * measures the <video> element: readyState, decoded frame count, currentTime
 * advancing, and a screenshot as visual evidence.
 *
 * A channel only counts as "playing" when ALL of these hold:
 *   readyState >= 3 (HAVE_FUTURE_DATA), videoWidth > 0,
 *   getVideoPlaybackQuality().totalVideoFrames > 0, and currentTime advanced.
 * HTTP 200 is explicitly NOT accepted as proof.
 *
 * Usage (inside the repo so the ESM deps resolve):
 *   node scripts/gate-c-browser.mjs
 * Env:
 *   LIVE_BASE              default http://127.0.0.1:3001
 *   CHANNEL_MATCH          substring of the channel name to click (default "Afaq")
 *   ARTIFACT_DIR           where to write screenshots/logs (default /home/user/evidence/gate-c)
 */
import fs from 'node:fs';
import path from 'node:path';
import chromiumBundle from '@sparticuz/chromium';
import { chromium } from 'playwright-core';

const BASE = (process.env.LIVE_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
const MATCH = process.env.CHANNEL_MATCH || 'Afaq';
const ART = process.env.ARTIFACT_DIR || '/home/user/evidence/gate-c';
fs.mkdirSync(ART, { recursive: true });

const log = [];
function note(message, data) {
  const line = { at: new Date().toISOString(), message, ...(data ? { data } : {}) };
  log.push(line);
  console.log(`[${line.at}] ${message}${data ? ` ${JSON.stringify(data)}` : ''}`);
}

const executablePath = await chromiumBundle.executablePath();
note('chromium ready', { executablePath, size: fs.statSync(executablePath).size });

const browser = await chromium.launch({
  executablePath,
  args: [...chromiumBundle.args, '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'],
  headless: true,
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  locale: 'ar-IQ',
  // The GATE C provider uses a self-signed certificate; the app under test is
  // plain http on localhost, so nothing else is affected by this.
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText}`));

const result = {
  base: BASE,
  channel: null,
  catalog: null,
  playback: null,
  verdict: 'NOT COMPLETE',
};

try {
  /* ------------------------------------------------------------- open /live */
  const response = await page.goto(`${BASE}/live`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  note('/live loaded', { status: response?.status() });
  if (!response || response.status() !== 200) throw new Error(`/live returned ${response?.status()}`);

  /* ------------------------------------------- the Licensed-Only text is gone */
  const bodyText = await page.locator('body').innerText();
  const bannedCopy = ['No licensed list is available', 'rights-reviewed', 'قائمة مرخّصة', 'بعد التحقق من حقوقها'];
  const survivors = bannedCopy.filter((phrase) => bodyText.includes(phrase));
  note('licensed-only copy check', { survivors });
  result.licensedOnlyCopyPresent = survivors.length > 0;

  /* -------------------------------------------- the catalogue actually loads */
  await page.waitForSelector('.live-card-main', { timeout: 90_000 });
  const cardCount = await page.locator('.live-card-main').count();
  const stats = await page.locator('.live-stats').first().innerText().catch(() => '');
  note('catalogue rendered', { cardCount, stats: stats.replace(/\s+/g, ' ').trim() });
  result.catalog = { cardCount, stats: stats.replace(/\s+/g, ' ').trim() };
  await page.screenshot({ path: path.join(ART, 'live-catalog.png'), fullPage: false });

  /* ------------------------------------------------ pick the target channel */
  const target = page.locator('.live-card-main', { hasText: MATCH }).first();
  const channelName = (await target.locator('strong').first().innerText()).trim();
  note('selected channel', { channelName });
  result.channel = channelName;

  /* ------------------------------------- capture the stream path the player uses */
  const streamRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/stream/')) streamRequests.push(request.url());
  });

  await target.click();
  await page.waitForSelector('.media-viewer video', { timeout: 30_000 });
  note('player mounted');

  /* --------------------- press play (MediaViewer also autoplays when allowed) */
  const playButton = page.locator('.media-actions .media-play');
  if (await playButton.count()) {
    await playButton.first().click().catch(() => {});
  }

  /* ------------------------------------- measure real decoded video, with retry */
  const started = Date.now();
  let probe = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    probe = await page.evaluate(() => {
      const video = document.querySelector('.media-viewer video');
      if (!video) return { found: false };
      const quality = typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
      return {
        found: true,
        readyState: video.readyState,
        networkState: video.networkState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        totalVideoFrames: quality ? quality.totalVideoFrames : null,
        droppedVideoFrames: quality ? quality.droppedVideoFrames : null,
        error: video.error ? { code: video.error.code, message: video.error.message } : null,
        src: video.currentSrc ? video.currentSrc.replace(/^https?:\/\/[^/]+/, '') : null,
      };
    });

    if (probe.found && probe.readyState >= 3 && probe.videoWidth > 0 && (probe.totalVideoFrames ?? 0) > 0 && probe.currentTime > 0.3) {
      break;
    }
    await page.waitForTimeout(1000);
  }

  const elapsedMs = Date.now() - started;
  note('video probe', { ...probe, elapsedMs });
  result.playback = { ...probe, elapsedMs, streamRequests: streamRequests.length };

  /* ------------------------------------------------ playback keeps advancing */
  let advanced = null;
  if (probe?.found && probe.currentTime > 0) {
    const before = probe.currentTime;
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const video = document.querySelector('.media-viewer video');
      const quality = video && typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
      return video ? { currentTime: video.currentTime, totalVideoFrames: quality ? quality.totalVideoFrames : null, paused: video.paused } : null;
    });
    advanced = after ? { before, after: after.currentTime, delta: after.currentTime - before, frames: after.totalVideoFrames, paused: after.paused } : null;
    note('playback progression', advanced);
    result.playback.advanced = advanced;
  }

  await page.screenshot({ path: path.join(ART, 'live-playing.png'), fullPage: false });

  /* --------------------------------------------------------------- verdict */
  const playing =
    probe?.found &&
    probe.readyState >= 3 &&
    probe.videoWidth > 0 &&
    (probe.totalVideoFrames ?? 0) > 0 &&
    probe.currentTime > 0.3 &&
    advanced !== null &&
    advanced.delta > 0.5;

  result.verdict = playing ? 'PLAYING' : 'NOT PLAYING';
  note('verdict', { verdict: result.verdict });

  /* ------------------------------------------------------ channel switching */
  try {
    const closeButton = page.locator('.firebase-viewer-top button');
    if (await closeButton.count()) await closeButton.first().click();
    await page.waitForTimeout(800);
    const second = page.locator('.live-card-main').nth(1);
    if (await second.count()) {
      const secondName = (await second.locator('strong').first().innerText()).trim();
      await second.click();
      await page.waitForSelector('.media-viewer video', { timeout: 20_000 });
      const switched = await page.evaluate(() => {
        const video = document.querySelector('.media-viewer video');
        return video ? { readyState: video.readyState, videoWidth: video.videoWidth, currentTime: video.currentTime, src: video.currentSrc } : null;
      });
      note('channel switch', { secondName, switched: switched ? { readyState: switched.readyState, videoWidth: switched.videoWidth, currentTime: switched.currentTime } : null });
      result.channelSwitch = { secondName, ...(switched ? { readyState: switched.readyState, videoWidth: switched.videoWidth, currentTime: switched.currentTime } : {}) };
      await page.screenshot({ path: path.join(ART, 'live-switched.png'), fullPage: false });
    }
  } catch (error) {
    note('channel switch failed', { error: error instanceof Error ? error.message : String(error) });
    result.channelSwitch = { error: error instanceof Error ? error.message : String(error) };
  }

  /* ------------------------------------------------ mobile / Safari-ish view */
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${BASE}/live`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobile.waitForSelector('.live-card-main', { timeout: 90_000 });
  const mobileCards = await mobile.locator('.live-card-main').count();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  note('mobile viewport', { width: 390, cards: mobileCards, horizontalOverflowPx: overflow });
  result.mobile = { cards: mobileCards, horizontalOverflowPx: overflow };
  await mobile.screenshot({ path: path.join(ART, 'live-mobile-390.png'), fullPage: false });

  /* ------------------------------------------- network + console diagnostics */
  result.consoleErrors = consoleErrors.slice(0, 20);
  result.failedRequests = failedRequests.slice(0, 20);
  note('diagnostics', { consoleErrors: consoleErrors.length, failedRequests: failedRequests.length });
} catch (error) {
  result.verdict = 'NOT PLAYING';
  result.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  note('fatal', { error: result.error });
} finally {
  fs.writeFileSync(path.join(ART, 'browser-report.json'), JSON.stringify({ result, log }, null, 2));
  await browser.close();
}

console.log('\n=== GATE C BROWSER RESULT ===');
console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PLAYING') process.exitCode = 1;
