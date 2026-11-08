/**
 * Offline regression tests for the hybrid Live catalog, storage and router shells.
 * Compiles the REAL client modules; browser playback is covered by tests/browser-smoke.mjs.
 * Run: npm run test:live --workspace aether-web
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');
let passed = 0; let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}
function compile() {
  const out = mkdtempSync(path.join(webRoot, '.live-test-'));
  execFileSync(process.execPath, [path.join(repoRoot, 'node_modules/typescript/bin/tsc'),
    'src/lib/channels.ts', 'src/lib/player-utils.ts', 'src/lib/storage.ts',
    '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
    '--esModuleInterop', '--skipLibCheck', '--strict', '--types', 'node', '--rootDir', '.'], { cwd: webRoot, stdio: 'pipe' });
  return out;
}
const out = compile();
const load = async file => import(pathToFileURL(path.join(out, file)).href);
const channels = await load('src/lib/channels.js');
const utils = await load('src/lib/player-utils.js');
const storage = await load('src/lib/storage.js');
const originalFetch = globalThis.fetch;
const row = { id: 'iq-1', name: 'العراق الرياضية 1080p', group: 'Sports', epgId: 'channel.iq', playable: true, streamUrl: 'https://cdn.example.net/live/master.m3u8' };
function jsonResponse(data, ok = true, status = 200) { return { ok, status, json: async () => data }; }
function memoryStorage() {
  const map = new Map();
  globalThis.window = { dispatchEvent() {} };
  globalThis.localStorage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
  return map;
}
console.log('\nLive catalog / hybrid router\n');
await check('root layout and both router shells exist; App shell never imports next/router', () => {
  assert.match(readFileSync(path.join(webRoot, 'app/layout.tsx'), 'utf8'), /<html lang="ar" dir="rtl">/);
  for (const file of ['src/components/navigation/AppShell.tsx', 'src/components/nav/GlobalNav.tsx', 'src/components/motion/PageTransition.tsx', 'src/components/layout/AppHeader.tsx', 'src/components/account/OwnerPlayerLink.tsx']) {
    const text = readFileSync(path.join(webRoot, file), 'utf8');
    assert.doesNotMatch(text, /from ['"]next\/router['"]/);
  }
  assert.match(readFileSync(path.join(webRoot, 'src/components/navigation/PagesShell.tsx'), 'utf8'), /next\/router/);
  assert.match(readFileSync(path.join(webRoot, 'src/components/navigation/AppShell.tsx'), 'utf8'), /next\/navigation/);
});
await check('Pages static paths no longer collide with App Router /live', () => {
  const text = readFileSync(path.join(webRoot, 'pages/[section].tsx'), 'utf8');
  assert.doesNotMatch(text, /'live'/);
  assert.match(text, /'tv-sources'/);
});
await check('catalog requests only the licensed operator endpoint', async () => {
  const urls = [];
  globalThis.fetch = async url => { urls.push(url); return jsonResponse({ data: [row] }); };
  const result = await channels.fetchChannels();
  assert.deepEqual(urls, ['/api/iptv/licensed']);
  assert.equal(result.length, 1);
  assert.equal(result[0].countryCode, 'IQ');
  assert.equal(result[0].category, 'sports');
  assert.equal(result[0].quality, 'FHD');
});
await check('unconfigured source is an error, never generated demo channels', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'LICENSED_SOURCE_UNAVAILABLE' }, false, 503);
  await assert.rejects(channels.fetchChannels(), error => error.status === 503);
});
await check('malformed source rows are rejected', async () => {
  globalThis.fetch = async () => jsonResponse({ data: [{ id: 7 }] });
  await assert.rejects(channels.fetchChannels(), error => error.message === 'INVALID_SOURCE');
});
await check('quality/country are unknown unless explicitly declared', () => {
  const adapted = channels.adaptChannel({ ...row, name: 'General Channel', epgId: '', group: 'Other' });
  assert.equal(adapted.quality, '');
  assert.equal(adapted.countryCode, '');
  assert.equal(adapted.category, 'general');
  assert.equal(channels.qualityOf('Channel HD').quality, 'HD');
  assert.equal(channels.qualityOf('Channel 4K').quality, '4K');
});
await check('EPG uses real guide rows and rejects invalid timestamps', async () => {
  globalThis.fetch = async () => jsonResponse({ data: { 'channel.iq': { now: { start: '2026-11-08T10:00:00Z', end: '2026-11-08T11:00:00Z', title: 'Match' }, next: { start: 'bad', end: 'bad', title: 'Fake' } } } });
  const guide = await channels.fetchEPG();
  assert.equal(guide['channel.iq'].length, 1);
  assert.equal(guide['channel.iq'][0].title, 'Match');
});
await check('search covers country/category; filters and quality sort are real', () => {
  const list = [channels.adaptChannel(row), channels.adaptChannel({ ...row, id: 'eg-1', name: 'News HD', epgId: 'news.eg', group: 'News' })];
  assert.equal(utils.sortChannels(list, [], 'العراق').length, 1);
  assert.equal(utils.sortChannels(list, [], '', 'news').length, 1);
  assert.equal(utils.sortChannels(list, [], '', 'all', 'EG').length, 1);
  assert.equal(utils.sortChannels(list, [], '', 'all', '', 'HD')[0].id, 'eg-1');
  assert.equal(utils.sortChannels(list, [], '', 'all', '', 'unknown').length, 0);
  assert.equal(utils.sortChannels(list, ['eg-1'], '', 'all', '', '', 'quality')[0].id, 'eg-1');
});
await check('stream type detection uses the URL path and never guesses', () => {
  assert.equal(utils.getStreamType('https://x.test/a.m3u8?token=1'), 'hls');
  assert.equal(utils.getStreamType('https://x.test/a.mpd'), 'dash');
  assert.equal(utils.getStreamType('https://x.test/a.mp4'), 'mp4');
  assert.equal(utils.getStreamType('https://x.test/watch?file=a.m3u8'), null);
});
await check('favorites migrate once to the canonical sync key and removals stay removed', () => {
  const map = memoryStorage();
  map.set('cloud-play-favorites', JSON.stringify(['old']));
  map.set('cloudplay-tv-favorites-v1', JSON.stringify(['current']));
  assert.deepEqual(storage.Favorites.get().sort(), ['current', 'old']);
  storage.Favorites.toggle('old');
  assert.deepEqual(storage.Favorites.get(), ['current']);
  assert.equal(map.get('cloudplay-tv-favorites-migrated'), 'true');
});
await check('watch history stores metadata only and tolerates corrupt storage', () => {
  const map = memoryStorage();
  storage.WatchHistory.add(channels.adaptChannel(row));
  const saved = JSON.parse(map.get('cloud-play-history'));
  assert.equal(saved[0].id, 'iq-1');
  assert.equal(saved[0].streamUrl, undefined);
  map.set('cloud-play-history', '{broken');
  assert.deepEqual(storage.WatchHistory.get(), []);
});
await check('player exposes real engine APIs and no fake DRM/page-reload retry', () => {
  const text = readFileSync(path.join(webRoot, 'src/components/player/VideoPlayer.tsx'), 'utf8');
  for (const token of ["import('hls.js')", "import('dashjs')", 'recoverMediaError', 'requestFullscreen', 'subtitleTrack', 'audioTrack', 'NotAllowedError']) assert.ok(text.includes(token), token);
  assert.doesNotMatch(text, /location\.reload|drm\??:\s*any|headers\??:/);
});
globalThis.fetch = originalFetch;
rmSync(out, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
