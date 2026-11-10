/**
 * Security + integration tests for the private owner-only Xtream player.
 *
 * Runs the REAL compiled server modules and the REAL /api/xtream/stream route
 * against a fake Xtream provider, and asserts the properties that matter:
 *
 *   1. Credentials never appear in any client-visible response.
 *   2. Playback tokens are encrypted, tamper-proof and expiring.
 *   3. The proxy cannot be pointed at another origin (no SSRF).
 *   4. Playlists are rewritten so every segment goes back through the proxy.
 *   5. Range requests pass through so seeking works.
 *   6. The owner allow-list is fail-closed.
 *
 * Run: npm run test:private --workspace aether-web
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');

const USERNAME = 'owner@example.net';
const PASSWORD = 'sup3r-s3cret-provider-pass';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  PASS  ${name}`); })
    .catch(error => { failed++; failures.push(name); console.log(`  FAIL  ${name}\n        ${error.message}`); });
}

/** Compile the server-only TS modules so we can exercise the real code. */
function compile() {
  // Compile inside the app so Node resolves the workspace's node_modules.
  const out = mkdtempSync(path.join(webRoot, '.private-test-'));
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/server/xtream-token.ts',
    'src/server/xtream-access.ts',
    'src/server/xtream-private.ts',
    'pages/api/xtream/stream.ts',
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

/** Minimal fake Xtream provider: player_api.php + HLS + progressive movie. */
function startProvider() {
  const media = Buffer.alloc(4096, 7);
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Real Xtream panels accept percent-encoded credentials in the path.
    const pathname = decodeURIComponent(url.pathname);
    const auth = `/${USERNAME}/${PASSWORD}`;

    if (pathname === '/player_api.php') {
      const action = url.searchParams.get('action') ?? '';
      const send = value => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
      if (url.searchParams.get('username') !== USERNAME || url.searchParams.get('password') !== PASSWORD) {
        res.writeHead(403); return res.end('{}');
      }
      if (action === '') return send({ user_info: { username: USERNAME, password: PASSWORD, status: 'Active', exp_date: '1893456000', active_cons: '1', max_connections: '2' } });
      if (action.endsWith('_categories')) return send([{ category_id: '1', category_name: 'Category One' }]);
      if (action === 'get_live_streams') return send([{ stream_id: '5', name: 'Channel Five', stream_icon: `http://${req.headers.host}/logo.png`, container_extension: 'ts' }]);
      if (action === 'get_vod_streams') return send([{ stream_id: '9', name: 'Movie Nine', stream_icon: '', container_extension: 'mp4' }]);
      if (action === 'get_series') return send([{ series_id: '11', name: 'Series Eleven', cover: '', container_extension: 'mp4' }]);
      if (action === 'get_series_info') return send({ episodes: { '1': [{ id: '77', episode_num: '1', title: 'Pilot', container_extension: 'mp4' }] } });
      res.writeHead(404); return res.end('{}');
    }

    if (pathname === `/live${auth}/5.m3u8`) {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      return res.end(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:6.0,\n5_0.ts\n#EXTINF:6.0,\nhttp://${req.headers.host}/live${auth}/5_1.ts\n#EXT-X-KEY:METHOD=AES-128,URI="http://${req.headers.host}/live${auth}/key.bin"\n#EXT-X-ENDLIST\n`);
    }
    if (pathname.startsWith(`/live${auth}/`) || url.pathname === '/logo.png') {
      res.writeHead(200, { 'Content-Type': 'video/MP2T' });
      return res.end(media);
    }
    if (pathname === `/movie${auth}/9.mp4`) {
      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : media.length - 1;
        res.writeHead(206, {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${start}-${end}/${media.length}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
        });
        return res.end(media.subarray(start, end + 1));
      }
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': String(media.length), 'Accept-Ranges': 'bytes' });
      return res.end(media);
    }
    res.writeHead(404); res.end('no');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

class MockRes extends Writable {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this.textBody = null;
    this.settled = false;
    this.done = new Promise(resolve => { this.resolveDone = resolve; });
    this.on('finish', () => { if (!this.settled) { this.settled = true; this.resolveDone(); } });
  }
  _write(chunk, _enc, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; }
  status(code) { this.statusCode = code; return this; }
  json(value) { this.textBody = JSON.stringify(value); this.end(); return this; }
  send(value) { this.textBody = String(value); this.end(); return this; }
  payload() { return this.textBody ?? Buffer.concat(this.chunks).toString('utf8'); }
  binary() { return Buffer.concat(this.chunks); }
}

function invoke(handler, query, headers = {}) {
  const res = new MockRes();
  const req = { method: 'GET', query, headers };
  return Promise.resolve(handler(req, res)).then(() => res.done).then(() => res);
}

async function main() {
  const out = compile();
  const { server, port } = await startProvider();
  const base = `http://127.0.0.1:${port}`;

  // Fixture transport only: exercise real local provider HTTP, never permit
  // production networking to bypass public-IP rejection for loopback fixtures.
  const fixtureRequire = createRequire(path.join(out, 'fixture.cjs'));
  fixtureRequire('./src/server/public-fetch.js').publicFetch = (input, init) => {
    assert.equal(new URL(input).origin, base);
    return fetch(input, init);
  };
  process.env.XTREAM_CATALOG_ENABLED = 'true';
  process.env.XTREAM_BASE_URL = base;
  process.env.XTREAM_ALLOW_HTTP = 'true';
  process.env.XTREAM_USERNAME = USERNAME;
  process.env.XTREAM_PASSWORD = PASSWORD;
  process.env.XTREAM_PROXY_SECRET = 'test-proxy-secret';
  delete process.env.XTREAM_OWNER_EMAILS;
  delete process.env.XTREAM_OWNER_USER_IDS;

  const tokenMod = await import(pathToFileURL(path.join(out, 'src/server/xtream-token.js')).href);
  const accessMod = await import(pathToFileURL(path.join(out, 'src/server/xtream-access.js')).href);
  const privateMod = await import(pathToFileURL(path.join(out, 'src/server/xtream-private.js')).href);
  const streamMod = await import(pathToFileURL(path.join(out, 'pages/api/xtream/stream.js')).href);
  // Compiled to CommonJS: the ESM namespace wraps module.exports in `default`.
  const streamHandler = streamMod.default?.default ?? streamMod.default;

  const SECRET = 'test-proxy-secret';
  const leaks = value => {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.includes(PASSWORD) || text.includes(USERNAME);
  };

  console.log('\nPrivate player — security & integration\n');

  await check('token round-trips a provider path', () => {
    const sealed = tokenMod.sealPath('/live/u/p/5.m3u8', SECRET, 60_000);
    assert.equal(tokenMod.openPath(sealed, SECRET), '/live/u/p/5.m3u8');
  });

  await check('token ciphertext hides the credentials', () => {
    const sealed = tokenMod.sealPath(`/live/${USERNAME}/${PASSWORD}/5.m3u8`, SECRET, 60_000);
    assert.ok(!leaks(sealed), 'token must not contain plaintext credentials');
    assert.ok(!sealed.includes(encodeURIComponent(PASSWORD)));
  });

  await check('tampered token is rejected', () => {
    const sealed = tokenMod.sealPath('/live/u/p/5.m3u8', SECRET, 60_000);
    const flipped = `${sealed.slice(0, -4)}${sealed.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
    assert.throws(() => tokenMod.openPath(flipped, SECRET));
  });

  await check('token signed with another secret is rejected', () => {
    const sealed = tokenMod.sealPath('/live/u/p/5.m3u8', 'other-secret', 60_000);
    assert.throws(() => tokenMod.openPath(sealed, SECRET));
  });

  await check('expired token is rejected', () => {
    const sealed = tokenMod.sealPath('/live/u/p/5.m3u8', SECRET, -1000);
    assert.throws(() => tokenMod.openPath(sealed, SECRET));
  });

  await check('token cannot carry an absolute or scheme-relative URL', () => {
    for (const bad of ['http://evil.example/x', '//evil.example/x', '/\\evil.example', 'relative/x']) {
      const sealed = tokenMod.sealPath(bad, SECRET, 60_000);
      assert.throws(() => tokenMod.openPath(sealed, SECRET), `should reject ${bad}`);
    }
  });

  await check('owner allow-list is fail-closed when unset', () => {
    assert.deepEqual(accessMod.ownerEmails(), []);
    assert.equal(accessMod.ownerConfigured(), false);
  });

  await check('owner allow-list parses, normalises and de-duplicates', () => {
    process.env.XTREAM_OWNER_EMAILS = ' Me@Example.com , me@example.com , bad@@x , second@example.com ';
    assert.deepEqual(accessMod.ownerEmails(), ['me@example.com', 'second@example.com']);
    assert.equal(accessMod.ownerConfigured(), false, 'legacy email alone must never authorize');
    process.env.XTREAM_OWNER_USER_IDS = '11111111-1111-4111-8111-111111111111, BAD,11111111-1111-4111-8111-111111111111';
    assert.deepEqual(accessMod.ownerUserIds(), ['11111111-1111-4111-8111-111111111111']);
    assert.equal(accessMod.ownerConfigured(), true);
    delete process.env.XTREAM_OWNER_USER_IDS;
    delete process.env.XTREAM_OWNER_EMAILS;
  });

  await check('owner gate denies without a bearer token', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.XTREAM_OWNER_USER_IDS = '11111111-1111-4111-8111-111111111111';
    await assert.rejects(() => accessMod.requireOwner({ headers: {} }), error => error.code === 'SIGN_IN_REQUIRED');
    delete process.env.XTREAM_OWNER_USER_IDS;
  });

  await check('owner gate reports OWNER_NOT_SET before checking the session', async () => {
    await assert.rejects(() => accessMod.requireOwner({ headers: {} }), error => error.code === 'OWNER_NOT_SET');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  await check('live catalog returns names only, never credentials', async () => {
    const groups = await privateMod.listGroups('live');
    assert.equal(groups[0].name, 'Category One');
    const items = await privateMod.listItems('live', '1');
    assert.equal(items[0].name, 'Channel Five');
    assert.ok(!leaks(groups) && !leaks(items), 'catalog must not leak credentials');
  });

  await check('movies and series catalogs work and stay clean', async () => {
    const movies = await privateMod.listItems('movie', '1');
    assert.equal(movies[0].id, '9');
    assert.equal(movies[0].ext, 'mp4');
    const series = await privateMod.listItems('series', '1');
    assert.equal(series[0].id, '11');
    const episodes = await privateMod.listEpisodes('11');
    assert.equal(episodes[0].id, '77');
    assert.ok(!leaks(movies) && !leaks(series) && !leaks(episodes));
  });

  await check('http artwork is proxied, not linked directly', async () => {
    const items = await privateMod.listItems('live', '1');
    assert.ok(items[0].icon.startsWith('/api/xtream/stream?t='), 'provider artwork must go through the proxy');
    assert.ok(!items[0].icon.includes('127.0.0.1'));
  });

  await check('account status exposes no credentials', async () => {
    const status = await privateMod.accountStatus();
    assert.equal(status.status, 'Active');
    assert.equal(status.maxConnections, 2);
    assert.ok(!leaks(status));
  });

  await check('playback token is opaque and hides credentials', () => {
    const { token, container } = privateMod.playbackToken('live', '5');
    assert.equal(container, 'm3u8');
    assert.ok(!leaks(token));
    assert.equal(tokenMod.openPath(token, SECRET), `/live/${encodeURIComponent(USERNAME)}/${encodeURIComponent(PASSWORD)}/5.m3u8`);
  });

  await check('playback rejects a non-numeric id', () => {
    assert.throws(() => privateMod.playbackToken('live', '../../etc/passwd'));
  });

  let playlistBody = '';
  await check('proxy rewrites every playlist reference to a proxy URL', async () => {
    const { token } = privateMod.playbackToken('live', '5');
    const res = await invoke(streamHandler, { t: token });
    assert.equal(res.statusCode, 200);
    playlistBody = res.payload();
    assert.ok(playlistBody.startsWith('#EXTM3U'));
    const refs = playlistBody.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    assert.equal(refs.length, 2);
    for (const ref of refs) assert.ok(ref.startsWith('/api/xtream/stream?t='), `unrewritten reference: ${ref}`);
    assert.ok(playlistBody.includes('URI="/api/xtream/stream?t='), 'EXT-X-KEY URI must be rewritten');
  });

  await check('rewritten playlist contains no credentials at all', () => {
    assert.ok(playlistBody.length > 0);
    assert.ok(!leaks(playlistBody), 'rewritten playlist leaked credentials');
    assert.ok(!playlistBody.includes('127.0.0.1'), 'rewritten playlist leaked the provider host');
  });

  await check('a rewritten segment token actually streams bytes', async () => {
    const segment = playlistBody.split('\n').find(line => line.trim() && !line.trim().startsWith('#'));
    const token = decodeURIComponent(new URL(segment, 'http://app.local').searchParams.get('t'));
    const res = await invoke(streamHandler, { t: token });
    assert.equal(res.statusCode, 200);
    assert.equal(res.binary().length, 4096);
  });

  await check('movie playback proxies bytes and honours Range', async () => {
    const { token } = privateMod.playbackToken('movie', '9', 'mp4');
    const full = await invoke(streamHandler, { t: token });
    assert.equal(full.statusCode, 200);
    assert.equal(full.binary().length, 4096);
    const partial = await invoke(streamHandler, { t: token }, { range: 'bytes=100-199' });
    assert.equal(partial.statusCode, 206);
    assert.equal(partial.headers['content-range'], 'bytes 100-199/4096');
    assert.equal(partial.binary().length, 100);
  });

  await check('proxy rejects a missing or forged token', async () => {
    for (const query of [{}, { t: '' }, { t: 'not-a-token' }, { t: 'AAAA' }]) {
      const res = await invoke(streamHandler, query);
      assert.equal(res.statusCode, 403);
      assert.ok(!leaks(res.payload()));
    }
  });

  await check('proxy refuses to leave the provider origin', async () => {
    // Even a legitimately-signed token cannot address another host.
    const sealed = tokenMod.sealPath('//evil.example/steal', SECRET, 60_000);
    const res = await invoke(streamHandler, { t: sealed });
    assert.equal(res.statusCode, 403);
  });

  await check('disabling the integration stops the proxy immediately', async () => {
    const { token } = privateMod.playbackToken('live', '5');
    process.env.XTREAM_CATALOG_ENABLED = 'false';
    const res = await invoke(streamHandler, { t: token });
    assert.equal(res.statusCode, 503);
    assert.ok(!leaks(res.payload()));
    // Fixture transport only: exercise real local provider HTTP, never permit
  // production networking to bypass public-IP rejection for loopback fixtures.
  const fixtureRequire = createRequire(path.join(out, 'fixture.cjs'));
  fixtureRequire('./src/server/public-fetch.js').publicFetch = (input, init) => {
    assert.equal(new URL(input).origin, base);
    return fetch(input, init);
  };
  process.env.XTREAM_CATALOG_ENABLED = 'true';
  });

  server.close();
  rmSync(out, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
