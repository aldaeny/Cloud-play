/**
 * Tests for the iptv-org COMMUNITY directory: parsing, browser-playability
 * filtering, querying, and the public route.
 *
 * Offline: the upstream playlist is stubbed. The parser is exercised against the
 * exact #EXTINF shape iptv-org's generator emits (verified against
 * scripts/models/stream.ts in iptv-org/iptv).
 *
 * Run: npm run test:community --workspace aether-web
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { passed++; console.log(`  PASS  ${name}`); })
    .catch(error => { failed++; failures.push(name); console.log(`  FAIL  ${name}\n        ${error.message}`); });
}

function compile() {
  const out = mkdtempSync(path.join(webRoot, '.public-test-'));
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/server/community-tv.ts',
    'pages/api/iptv/community.ts',
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--strict',
    '--types', 'node',
  ], { cwd: webRoot, stdio: 'pipe' });
  return out;
}

function invoke(handler, query = {}, method = 'GET') {
  const headers = {};
  let status = 0;
  let body = null;
  const res = {
    setHeader(name, value) { headers[name.toLowerCase()] = value; return this; },
    status(code) { status = code; return this; },
    json(value) { body = value; return this; },
  };
  return Promise.resolve(handler({ method, query, headers: {} }, res))
    .then(() => ({ status, body, headers }));
}

const SAMPLE = [
  '#EXTM3U x-tvg-url="https://example.com/epg.xml"',
  '#EXTINF:-1 tvg-id="AlJazeera.qa@Arabic" tvg-logo="https://logo.example/aja.png" group-title="News",Al Jazeera Arabic (1080p)',
  'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
  // mirror of the same feed -> must collapse
  '#EXTINF:-1 tvg-id="AlJazeera.qa@Arabic" tvg-logo="https://logo.example/aja.png" group-title="News",Al Jazeera Arabic (1080p)',
  'https://live-hls-v3-aja.getaj.net/AJA-V3/index.m3u8',
  // different feed of the same channel -> must be kept
  '#EXTINF:-1 tvg-id="AlJazeera.qa@English" group-title="News",Al Jazeera English (1080p)',
  'https://live-hls-apps-aje.getaj.net/AJE/index.m3u8',
  '#EXTINF:-1 tvg-id="RoyaTV.jo@SD" group-title="General;Family",Roya TV (720p)',
  'https://live.kwikmotion.com/royatvpublic/royatv.smil/playlist.m3u8',
  // requires a Referer -> unplayable in a browser
  '#EXTINF:-1 tvg-id="NeedsRef.eg@SD" group-title="News",Needs Referer',
  '#EXTVLCOPT:http-referrer=https://example.com/',
  'https://cdn.example.com/ref.m3u8',
  // requires a User-Agent -> unplayable in a browser
  '#EXTINF:-1 tvg-id="NeedsUA.eg@SD" group-title="News",Needs UA',
  '#EXTVLCOPT:http-user-agent=VLC/3.0',
  'https://cdn.example.com/ua.m3u8',
  // inline header attributes -> also unplayable
  '#EXTINF:-1 tvg-id="InlineRef.eg@SD" http-referrer="https://example.com/" group-title="News",Inline Ref',
  'https://cdn.example.com/inline.m3u8',
  // insecure / wrong container / credentials / private host
  '#EXTINF:-1 tvg-id="Plain.eg@SD" group-title="News",Plain HTTP',
  'http://cdn.example.com/plain.m3u8',
  '#EXTINF:-1 tvg-id="Ts.eg@SD" group-title="News",MPEG-TS',
  'https://cdn.example.com/stream.ts',
  '#EXTINF:-1 tvg-id="Creds.eg@SD" group-title="News",Credentialed',
  'https://user:pass@cdn.example.com/a.m3u8',
  '#EXTINF:-1 tvg-id="Local.eg@SD" group-title="News",Localhost',
  'https://localhost/a.m3u8',
  // Xtream reseller shape
  '#EXTINF:-1 tvg-id="Xtream.eg@SD" group-title="News",Reseller',
  'https://cdn.example.com/live/user/pass/12345.m3u8',
  // a good entry AFTER all the rejected ones, to prove state resets cleanly
  '#EXTINF:-1 tvg-id="KTV1.kw@SD" group-title="General",KTV 1 (1080p)',
  'https://kwtktv1ta.cdn.mangomolo.com/ktv1/smil:ktv1.stream.smil/chunklist.m3u8',
].join('\r\n');

async function main() {
  const out = compile();
  // Adapter contract fixtures. Socket pinning is tested independently using
  // actual native HTTP/TLS, not this mocked upstream response boundary.
  const fixtureRequire = createRequire(path.join(out, 'fixture.cjs'));
  fixtureRequire('./src/server/public-fetch.js').publicFetch = (input, init) => globalThis.fetch(input, init);

  const mod = await import(pathToFileURL(path.join(out, 'src/server/community-tv.js')).href);
  const routeMod = await import(pathToFileURL(path.join(out, 'pages/api/iptv/community.js')).href);
  const handler = routeMod.default?.default ?? routeMod.default;

  console.log('\niptv-org community directory\n');

  const parsed = mod.parseCommunityPlaylist(SAMPLE);

  await check('parses the iptv-org #EXTINF shape', () => {
    const aja = parsed.find(c => c.name.startsWith('Al Jazeera Arabic'));
    assert.ok(aja, 'Al Jazeera Arabic missing');
    assert.equal(aja.country, 'qa');
    assert.deepEqual(aja.categories, ['News']);
    assert.equal(aja.logo, 'https://logo.example/aja.png');
    assert.equal(aja.url, 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8');
    assert.match(aja.id, /^[a-z0-9-]+$/);
  });

  await check('keeps only browser-playable entries', () => {
    const names = parsed.map(c => c.name).join('|');
    for (const bad of ['Needs Referer', 'Needs UA', 'Inline Ref', 'Plain HTTP', 'MPEG-TS', 'Credentialed', 'Localhost', 'Reseller']) {
      assert.ok(!names.includes(bad), `should have dropped: ${bad}`);
    }
    assert.equal(parsed.length, 4, `expected 4 playable entries, got ${parsed.length}: ${names}`);
  });

  await check('a rejected entry does not poison the next good one', () => {
    assert.ok(parsed.some(c => c.name.startsWith('KTV 1')), 'entry after rejected block was lost');
  });

  await check('collapses mirrors but keeps distinct feeds', () => {
    const arabic = parsed.filter(c => c.id.includes('aljazeera-qa-arabic'));
    const english = parsed.filter(c => c.id.includes('aljazeera-qa-english'));
    assert.equal(arabic.length, 1, 'mirror not collapsed');
    assert.equal(english.length, 1, 'separate feed was dropped');
  });

  await check('every parsed stream is credential-free HTTPS HLS', () => {
    for (const channel of parsed) {
      const url = new URL(channel.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username, '');
      assert.ok(url.pathname.toLowerCase().endsWith('.m3u8'));
      assert.ok(!/^\/(live|movie|series)\/[^/]+\/[^/]+\/\d+\./i.test(url.pathname));
    }
  });

  await check('handles junk, blank input and missing attributes', () => {
    assert.deepEqual(mod.parseCommunityPlaylist(''), []);
    assert.deepEqual(mod.parseCommunityPlaylist('not a playlist'), []);
    assert.deepEqual(mod.parseCommunityPlaylist(null), []);
    const bare = mod.parseCommunityPlaylist('#EXTINF:-1,Nameless\nhttps://cdn.example.com/a.m3u8');
    assert.equal(bare.length, 1);
    assert.equal(bare[0].country, '');
    assert.equal(bare[0].logo, '');
    assert.deepEqual(bare[0].categories, []);
  });

  await check('drops non-https logos but keeps the channel', () => {
    const rows = mod.parseCommunityPlaylist('#EXTINF:-1 tvg-id="X.iq@SD" tvg-logo="http://insecure/l.png" group-title="News",X\nhttps://cdn.example.com/a.m3u8');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].logo, '');
  });

  await check('refuses adult entries by name and by category', () => {
    const rows = mod.parseCommunityPlaylist([
      '#EXTINF:-1 tvg-id="A.us@SD" group-title="XXX",Some Channel',
      'https://cdn.example.com/a.m3u8',
      '#EXTINF:-1 tvg-id="B.us@SD" group-title="News",Adult Channel',
      'https://cdn.example.com/b.m3u8',
      '#EXTINF:-1 tvg-id="C.us@SD" group-title="News",Porn TV',
      'https://cdn.example.com/c.m3u8',
      // Word boundaries must not reject innocent names containing the letters.
      '#EXTINF:-1 tvg-id="D.cl@SD" group-title="General",Sextavision (1080p)',
      'https://cdn.example.com/d.m3u8',
      '#EXTINF:-1 tvg-id="E.gb@SD" group-title="News",Essex Television',
      'https://cdn.example.com/e.m3u8',
    ].join('\n'));
    assert.deepEqual(rows.map(r => r.name), ['Sextavision (1080p)', 'Essex Television']);
  });

  await check('the cap is a safety bound, not a country truncation', () => {
    // The playlist is ordered by country, so a low cap would silently drop every
    // nation late in the alphabet. The bound must sit above the real usable size.
    assert.ok(mod.MAX_COMMUNITY_CHANNELS >= 15000,
      `cap ${mod.MAX_COMMUNITY_CHANNELS} risks truncating countries`);
  });

  await check('caps the index size', () => {
    const many = Array.from({ length: mod.MAX_COMMUNITY_CHANNELS + 50 }, (_, i) =>
      `#EXTINF:-1 tvg-id="C${i}.us@SD" group-title="News",C${i}\nhttps://cdn.example.com/${i}.m3u8`).join('\n');
    assert.equal(mod.parseCommunityPlaylist(many).length, mod.MAX_COMMUNITY_CHANNELS);
  });

  const index = mod.buildCommunityIndex(parsed);

  await check('facets are counted and sorted by size', () => {
    assert.equal(index.countries[0].value, 'qa');
    assert.equal(index.countries[0].count, 2);
    const general = index.categories.find(c => c.value === 'General');
    assert.equal(general.count, 2);
    assert.ok(index.categories.every(c => c.count > 0));
  });

  await check('query filters by country, category and text', () => {
    assert.equal(mod.queryCommunity(index, { country: 'jo' }).total, 1);
    assert.equal(mod.queryCommunity(index, { category: 'family' }).total, 1);
    assert.equal(mod.queryCommunity(index, { q: 'roya' }).total, 1);
    assert.equal(mod.queryCommunity(index, { q: 'zzzz' }).total, 0);
    assert.equal(mod.queryCommunity(index, { country: 'qa', q: 'english' }).total, 1);
  });

  await check('query paginates and clamps limits', () => {
    const page = mod.queryCommunity(index, { limit: 2, offset: 1 });
    assert.equal(page.data.length, 2);
    assert.equal(page.total, 4);
    assert.equal(page.offset, 1);
    assert.equal(mod.queryCommunity(index, { limit: 9999 }).limit, 200);
    assert.equal(mod.queryCommunity(index, { limit: -5 }).limit, 60);
    assert.equal(mod.queryCommunity(index, { offset: -5 }).offset, 0);
  });

  // ——— route ———
  const originalFetch = globalThis.fetch;
  let calls = 0;

  await check('route reports a clear 503 when upstream is unreachable', async () => {
    globalThis.fetch = async () => { calls++; throw new Error('network down'); };
    const res = await invoke(handler);
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'SOURCE_UNAVAILABLE');
  });

  await check('route is public: 200 with no auth and no env configured', async () => {
    delete process.env.XTREAM_OWNER_EMAILS;
    delete process.env.XTREAM_CATALOG_ENABLED;
    globalThis.fetch = async () => { calls++; return { ok: true, status: 200, text: async () => SAMPLE }; };
    const res = await invoke(handler);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 4);
    assert.equal(res.body.data.length, 4);
    assert.ok(res.body.source.includes('iptv-org'));
    assert.ok(/s-maxage=\d+/.test(res.headers['cache-control'] ?? ''), 'must be CDN-cacheable');
  });

  await check('upstream is fetched once and cached across requests', async () => {
    const before = calls;
    await invoke(handler, { country: 'qa' });
    await invoke(handler, { q: 'roya' });
    assert.equal(calls, before, 'upstream was refetched instead of using the cache');
  });

  await check('route applies filters and pagination', async () => {
    const jo = await invoke(handler, { country: 'jo' });
    assert.equal(jo.body.total, 1);
    assert.equal(jo.body.data[0].country, 'jo');
    const paged = await invoke(handler, { limit: '1', offset: '1' });
    assert.equal(paged.body.data.length, 1);
    assert.equal(paged.body.total, 4);
  });

  await check('route rejects non-GET', async () => {
    const res = await invoke(handler, {}, 'POST');
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'GET');
  });

  await check('payload carries no private-provider references or secrets', async () => {
    const res = await invoke(handler);
    const text = JSON.stringify(res.body);
    assert.ok(!/xtream|redchicks/i.test(text), 'private subsystem leaked');
    for (const secret of [process.env.XTREAM_PASSWORD, process.env.XTREAM_USERNAME].filter(Boolean)) {
      assert.ok(!text.includes(secret), 'credential leaked');
    }
  });

  globalThis.fetch = originalFetch;
  rmSync(out, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch(error => { console.error(error); process.exit(1); });
