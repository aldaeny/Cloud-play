/**
 * Tests for the PUBLIC free live TV list and its route.
 *
 * These are offline/structural: they assert the curation rules hold and that the
 * endpoint is genuinely public (no auth, no operator config). Stream reachability
 * was verified separately against each broadcaster's master playlist.
 *
 * Run: npm run test:public --workspace aether-web
 */
import assert from 'node:assert/strict';
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
    'src/server/public-tv.ts',
    'pages/api/iptv/public.ts',
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

function invoke(handler, method = 'GET') {
  const headers = {};
  let status = 0;
  let body = null;
  const res = {
    setHeader(name, value) { headers[name.toLowerCase()] = value; return this; },
    status(code) { status = code; return this; },
    json(value) { body = value; return this; },
  };
  return Promise.resolve(handler({ method, query: {}, headers: {} }, res)).then(() => ({ status, body, headers }));
}

async function main() {
  const out = compile();
  const mod = await import(pathToFileURL(path.join(out, 'src/server/public-tv.js')).href);
  const routeMod = await import(pathToFileURL(path.join(out, 'pages/api/iptv/public.js')).href);
  const handler = routeMod.default?.default ?? routeMod.default;
  const channels = mod.getPublicChannels();

  console.log('\nPublic free live TV\n');

  await check('the list is non-empty and substantial', () => {
    assert.ok(channels.length >= 30, `expected >= 30 channels, got ${channels.length}`);
  });

  await check('every stream is credential-free HTTPS HLS', () => {
    for (const channel of channels) {
      assert.ok(mod.isSafePublicStream(channel.streamUrl), `unsafe stream for ${channel.id}`);
      const url = new URL(channel.streamUrl);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    }
  });

  await check('no Xtream-style credential paths or private hosts', () => {
    for (const channel of channels) {
      // Xtream puts credentials at the START of the path: /live/<user>/<pass>/<id>.ext
      // (A CDN path like /hls/live/<id>/<name>/ is legitimate and must not match.)
      assert.ok(!/^\/(live|movie|series)\/[^/]+\/[^/]+\/\d+\./.test(new URL(channel.streamUrl).pathname),
        `credential-shaped path for ${channel.id}`);
      assert.ok(!channel.streamUrl.includes('redchicks'), 'private provider must never appear publicly');
    }
  });

  await check('ids are unique', () => {
    assert.equal(new Set(channels.map(c => c.id)).size, channels.length);
  });

  await check('every channel has bilingual names, owner and official page', () => {
    for (const channel of channels) {
      assert.ok(channel.nameAr && channel.nameEn, `names missing for ${channel.id}`);
      assert.ok(channel.broadcaster, `broadcaster missing for ${channel.id}`);
      assert.ok(channel.officialUrl.startsWith('https://'), `official page must be https for ${channel.id}`);
      assert.ok(['iraq', 'news', 'gulf', 'levant', 'sport', 'world'].includes(channel.group), `bad group for ${channel.id}`);
      assert.ok(['ar', 'en'].includes(channel.language), `bad language for ${channel.id}`);
    }
  });

  await check('Iraqi channels are included', () => {
    const iraqi = channels.filter(c => c.group === 'iraq');
    assert.ok(iraqi.length >= 2, `expected Iraqi channels, got ${iraqi.length}`);
    assert.ok(iraqi.every(c => c.country === 'IQ'));
  });

  await check('unsafe entries are rejected by the guard', () => {
    for (const bad of [
      'http://example.com/a.m3u8',
      'https://user:pass@example.com/a.m3u8',
      'https://example.com/a.ts',
      'https://localhost/a.m3u8',
      'https://example.com:8080/a.m3u8',
      'https://example.com/a.m3u8#frag',
      'not a url',
      '',
    ]) {
      assert.equal(mod.isSafePublicStream(bad), false, `should reject ${bad}`);
    }
    assert.equal(mod.isSafePublicStream('https://cdn.example.com/live/index.m3u8'), true);
    assert.equal(mod.isSafePublicStream('https://cdn.example.com/a.m3u8?ctx=abc'), true);
  });

  await check('route is public: 200 with no auth and no env configured', async () => {
    delete process.env.XTREAM_CATALOG_ENABLED;
    delete process.env.XTREAM_OWNER_EMAILS;
    delete process.env.CLOUDPLAY_IPTV_RIGHTS_CONFIRMED;
    const res = await invoke(handler);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, channels.length);
  });

  await check('route is CDN-cacheable and rejects non-GET', async () => {
    const res = await invoke(handler);
    assert.ok(/s-maxage=\d+/.test(res.headers['cache-control'] ?? ''), 'must be cacheable');
    const post = await invoke(handler, 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET');
  });

  await check('public payload carries no secrets', async () => {
    const res = await invoke(handler);
    const text = JSON.stringify(res.body);
    for (const secret of [process.env.XTREAM_PASSWORD, process.env.XTREAM_USERNAME].filter(Boolean)) {
      assert.ok(!text.includes(secret), 'public payload leaked a credential');
    }
    assert.ok(!text.includes('xtream'), 'public payload must not reference the private subsystem');
  });

  rmSync(out, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch(error => { console.error(error); process.exit(1); });
