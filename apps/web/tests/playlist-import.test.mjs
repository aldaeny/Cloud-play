/**
 * Security + behaviour tests for owner-only M3U playlist import.
 *
 * Exercises the REAL compiled server modules and the REAL API routes. The
 * network is simulated by stubbing global fetch and the DNS resolver, so the
 * suite runs offline and deterministically while still running every guard.
 *
 * Properties that matter:
 *   1. The server refuses to be aimed at internal addresses/hosts/ports (SSRF).
 *   2. Stream origins are sealed: the browser can neither read nor choose them.
 *   3. Tokens are tamper-proof, expiring, and cannot cross over from Xtream.
 *   4. Referer/User-Agent are forwarded server-side (the private-tier advantage).
 *   5. Playlists are rewritten so every segment returns through the proxy.
 *   6. Raw stream URLs and credentials never appear in a client response.
 *   7. The import route is owner-gated and POST-only.
 *
 * Run: npm run test:playlists --workspace aether-web
 */
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  PASS  ${name}`); })
    .catch(error => { failed++; failures.push(name); console.log(`  FAIL  ${name}\n        ${error.message}`); });
}

function compile() {
  const out = mkdtempSync(path.join(webRoot, '.playlist-test-'));
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/server/safe-fetch.ts',
    'src/server/playlist-token.ts',
    'src/server/playlist-import.ts',
    'src/server/xtream-token.ts',
    'src/server/xtream-access.ts',
    'pages/api/playlist/import.ts',
    'pages/api/playlist/stream.ts',
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
  getHeader(name) { return this.headers[name.toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  json(value) { this.textBody = JSON.stringify(value); this.end(); return this; }
  send(value) { this.textBody = String(value); this.end(); return this; }
  body() { return this.textBody ?? Buffer.concat(this.chunks).toString('utf8'); }
}

async function invoke(handler, { method = 'GET', query = {}, headers = {}, body } = {}) {
  const res = new MockRes();
  await handler({ method, query, headers, body }, res);
  await Promise.race([res.done, new Promise(resolve => setTimeout(resolve, 500))]);
  return res;
}

const SECRET = 'test-playlist-proxy-secret-value-32chars';
const PUBLIC_IP = '93.184.216.34';

console.log('\nOwner-only playlist import\n');

const out = compile();
const req = createRequire(path.join(out, 'noop.js'));
const guard = req('./src/server/safe-fetch.js');
// Route behavior uses a fixture transport, not real sockets; pinned transport
// security is exercised independently in pinned-fetch.test.mjs.
req('./src/server/pinned-get.js').pinnedGet = async (url, options) => {
  await new Promise((resolve, reject) => options.lookup(url.hostname, {}, error => error ? reject(error) : resolve()));
  return globalThis.fetch(url, options);
};
const tokens = req('./src/server/playlist-token.js');
const importer = req('./src/server/playlist-import.js');
const xtreamTokens = req('./src/server/xtream-token.js');
const importRoute = req('./pages/api/playlist/import.js').default;
const streamRoute = req('./pages/api/playlist/stream.js').default;

process.env.PLAYLIST_PROXY_SECRET = SECRET;

// Resolve every hostname to a public address unless a test overrides it.
const dns = req('node:dns/promises');
const realLookup = dns.lookup;
let lookupImpl = async () => [{ address: PUBLIC_IP, family: 4 }];
dns.lookup = (...args) => lookupImpl(...args);

const realFetch = globalThis.fetch;
let fetchImpl = async () => new Response('#EXTM3U\n');
let fetchCalls = [];
globalThis.fetch = (input, init) => {
  fetchCalls.push({ url: String(input), init });
  return fetchImpl(String(input), init);
};

try {
  await check('production import fails closed when the trusted bridge is unconfigured, without provider calls',async()=>{
    const old=process.env.NODE_ENV;process.env.NODE_ENV='production';const before=fetchCalls.length;
    try{const res=await invoke(importRoute,{method:'POST',body:{url:'https://list.example.com/a.m3u'}});assert.equal(res.statusCode,503);assert.equal(fetchCalls.length,before);}
    finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;}
  });
  // --- SSRF guard ---------------------------------------------------------
  await check('private, loopback, link-local and reserved IPv4 are blocked', () => {
    for (const ip of [
      '127.0.0.1', '127.1.2.3', '10.0.0.5', '172.16.0.1', '172.31.255.254',
      '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
      '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1',
      '224.0.0.1', '255.255.255.255',
    ]) {
      assert.equal(guard.isPrivateAddress(ip), true, `${ip} must be blocked`);
    }
  });

  await check('internal IPv6 and v4-mapped addresses are blocked', () => {
    for (const ip of ['::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
      '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '::ffff:a00:1',
      '2001:db8::1', '64:ff9b::1', 'fe80::1%eth0']) {
      assert.equal(guard.isPrivateAddress(ip), true, `${ip} must be blocked`);
    }
  });

  await check('genuinely public addresses are allowed', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1',
      '2606:4700:4700::1111', '::ffff:808:808', '::ffff:8.8.8.8']) {
      assert.equal(guard.isPrivateAddress(ip), false, `${ip} must be allowed`);
    }
  });

  await check('non-canonical IPv4 octets fail closed', () => {
    for (const ip of ['010.0.0.1', '127.0.0.01', '1.2.3', '1.2.3.4.5', '999.1.1.1']) {
      assert.equal(guard.isPrivateAddress(ip), true, `${ip} must fail closed`);
    }
  });

  await check('only http/https survive, and never with userinfo', () => {
    for (const bad of ['file:///etc/passwd', 'ftp://x.com/a', 'data:text/plain,hi', 'gopher://x.com/',
      'https://user:pass@example.com/a', 'javascript:alert(1)']) {
      assert.throws(() => guard.parsePublicUrl(bad), /BAD_URL/, `${bad} must be rejected`);
    }
    assert.equal(guard.parsePublicUrl('https://example.com/a.m3u').hostname, 'example.com');
  });

  await check('internal hostnames and bare labels are rejected', () => {
    for (const host of ['http://localhost/x', 'http://api.localhost/x', 'http://printer.local/x',
      'http://db.internal/x', 'http://svc.cluster.local/x', 'http://metadata.google.internal/',
      'http://nas/x', 'http://box.home/x']) {
      assert.throws(() => guard.parsePublicUrl(host), /BLOCKED_HOST/, `${host} must be rejected`);
    }
  });

  await check('internal service ports are blocked, media ports allowed', () => {
    for (const port of [22, 25, 53, 3306, 5432, 6379, 9200, 11211, 27017, 2375]) {
      assert.throws(() => guard.parsePublicUrl(`http://example.com:${port}/x`), /BLOCKED_PORT/, `port ${port}`);
    }
    for (const port of [80, 443, 8080, 8443, 25461, 8000]) {
      assert.ok(guard.parsePublicUrl(`http://example.com:${port}/x`), `port ${port} must be allowed`);
    }
  });

  await check('query-string credentials are allowed (Xtream get.php shape)', () => {
    const url = guard.parsePublicUrl('https://panel.example.com:25461/get.php?username=adam&password=secret&type=m3u_plus');
    assert.equal(url.searchParams.get('username'), 'adam');
  });

  await check('IP literals pointing inside the network are refused without DNS', () => {
    for (const url of ['http://127.0.0.1/a.m3u8', 'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/a', 'http://192.168.1.1/a', 'http://[::1]/a', 'http://[fd00::1]/a',
      'http://[::ffff:127.0.0.1]/a']) {
      assert.throws(() => guard.parsePublicUrl(url), /BLOCKED_ADDRESS/, `${url} must be rejected`);
    }
    assert.ok(guard.parsePublicUrl('http://93.184.216.34/a.m3u8'), 'a public IP literal is fine');
  });

  await check('control characters and oversized URLs are rejected', () => {
    assert.throws(() => guard.parsePublicUrl('https://example.com/a\nb'), /BAD_URL/);
    assert.throws(() => guard.parsePublicUrl('https://example.com/' + 'a'.repeat(5000)), /BAD_URL/);
  });

  await check('a host resolving to a private address is blocked at fetch time', async () => {
    guard.resetHostVerdicts();
    lookupImpl = async () => [{ address: '10.1.2.3', family: 4 }];
    await assert.rejects(() => guard.assertPublicHost(new URL('http://evil.example.com/x')), /BLOCKED_ADDRESS/);
    lookupImpl = async () => [{ address: PUBLIC_IP, family: 4 }];
  });

  await check('a redirect to an internal host is refused', async () => {
    guard.resetHostVerdicts();
    lookupImpl = async host => [{ address: String(host).includes('internal') ? '127.0.0.1' : PUBLIC_IP, family: 4 }];
    fetchImpl = async () => new Response(null, { status: 302, headers: { location: 'https://internal.example.com/x' } });
    await assert.rejects(() => guard.safeFetch('https://ok.example.com/list.m3u'), /BLOCKED_ADDRESS/);
    lookupImpl = async () => [{ address: PUBLIC_IP, family: 4 }];
  });

  // --- tokens -------------------------------------------------------------
  await check('token round-trips origin, path and forwarding headers', () => {
    const grant = { origin: 'https://cdn.example.com', path: '/live/a b/1.m3u8?k=1', referrer: 'https://ref.example.com/', userAgent: 'VLC/3.0' };
    const opened = tokens.openStream(tokens.sealStream(grant, SECRET), SECRET);
    assert.equal(opened.origin, grant.origin);
    assert.equal(opened.path, grant.path);
    assert.equal(opened.referrer, grant.referrer);
    assert.equal(opened.userAgent, grant.userAgent);
    assert.ok(opened.expiresAt > Date.now());
  });

  await check('tampered, truncated and expired tokens are rejected', () => {
    const token = tokens.sealStream({ origin: 'https://a.example.com', path: '/x.m3u8' }, SECRET);
    assert.throws(() => tokens.openStream(token.slice(0, -4) + 'AAAA', SECRET), /BAD_TOKEN/);
    assert.throws(() => tokens.openStream('not-a-token', SECRET), /BAD_TOKEN/);
    assert.throws(() => tokens.openStream('A'.repeat(9000), SECRET), /BAD_TOKEN/);
    assert.throws(() => tokens.openStream(token, 'a-completely-different-secret-value'), /BAD_TOKEN/);
    const expired = tokens.sealStream({ origin: 'https://a.example.com', path: '/x.m3u8' }, SECRET, -1000);
    assert.throws(() => tokens.openStream(expired, SECRET), /BAD_TOKEN/);
  });

  await check('paths that could escape the sealed origin are rejected on open', () => {
    for (const bad of ['//evil.example.com/x', '/\\evil.example.com/x', 'https://evil.example.com/x', '/x\ny', '/' + 'a'.repeat(5000)]) {
      const token = tokens.sealStream({ origin: 'https://a.example.com', path: bad }, SECRET);
      assert.throws(() => tokens.openStream(token, SECRET), /BAD_TOKEN/, `${bad} must be rejected`);
    }
  });

  await check('an Xtream proxy token cannot be replayed against the playlist proxy', () => {
    const xtream = xtreamTokens.sealPath('/live/user/pass/1.m3u8', SECRET);
    assert.throws(() => tokens.openStream(xtream, SECRET), /BAD_TOKEN/);
  });

  await check('a missing or short signing secret is not accepted', () => {
    const previous = process.env.PLAYLIST_PROXY_SECRET;
    const previousX = process.env.XTREAM_PROXY_SECRET;
    try {
      process.env.PLAYLIST_PROXY_SECRET = 'short';
      delete process.env.XTREAM_PROXY_SECRET;
      assert.equal(tokens.playlistProxyConfigured(), false);
      assert.throws(() => tokens.playlistSecret(), /BAD_TOKEN/);
    } finally {
      process.env.PLAYLIST_PROXY_SECRET = previous;
      if (previousX !== undefined) process.env.XTREAM_PROXY_SECRET = previousX;
    }
  });

  // --- parser -------------------------------------------------------------
  await check('EXTINF attributes become name, group and logo', () => {
    const entries = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1 tvg-logo="https://l.example.com/a.png" group-title="News",Al Arabia\nhttps://cdn.example.com/a.m3u8\n');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'Al Arabia');
    assert.equal(entries[0].group, 'News');
    assert.equal(entries[0].logo, 'https://l.example.com/a.png');
  });

  await check('EXTVLCOPT, inline attributes and EXTHTTP all supply forwarding headers', () => {
    const vlc = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1,A\n#EXTVLCOPT:http-referrer=https://ref.example.com/\n#EXTVLCOPT:http-user-agent=VLC/3.0\nhttps://cdn.example.com/a.m3u8\n');
    assert.equal(vlc[0].referrer, 'https://ref.example.com/');
    assert.equal(vlc[0].userAgent, 'VLC/3.0');

    const inline = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1 http-referrer="https://r2.example.com/" http-user-agent="UA2",B\nhttps://cdn.example.com/b.m3u8\n');
    assert.equal(inline[0].referrer, 'https://r2.example.com/');
    assert.equal(inline[0].userAgent, 'UA2');

    const http = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1,C\n#EXTHTTP:{"referer":"https://r3.example.com/","user-agent":"UA3"}\nhttps://cdn.example.com/c.m3u8\n');
    assert.equal(http[0].referrer, 'https://r3.example.com/');
    assert.equal(http[0].userAgent, 'UA3');
  });

  await check('forwarding headers do not bleed into the next entry', () => {
    const entries = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1,A\n#EXTVLCOPT:http-referrer=https://ref.example.com/\nhttps://cdn.example.com/a.m3u8\n#EXTINF:-1,B\nhttps://cdn.example.com/b.m3u8\n');
    assert.equal(entries[0].referrer, 'https://ref.example.com/');
    assert.equal(entries[1].referrer, undefined);
  });

  await check('bare URL lists and unknown directives are handled', () => {
    const entries = importer.parsePlaylist('#EXTM3U\n#KODIPROP:inputstream.adaptive.license_type=clearkey\nhttps://cdn.example.com/a.m3u8\nhttps://cdn.example.com/b.mp4\n');
    assert.equal(entries.length, 2);
    assert.ok(entries[0].name.length > 0);
    assert.equal(entries[0].group, 'Uncategorised');
  });

  await check('buildChannels de-duplicates and skips unsafe targets', () => {
    const entries = importer.parsePlaylist([
      '#EXTM3U',
      '#EXTINF:-1 group-title="G",One', 'https://cdn.example.com/a.m3u8',
      '#EXTINF:-1 group-title="G",Duplicate', 'https://cdn.example.com/a.m3u8',
      '#EXTINF:-1,Internal', 'http://127.0.0.1:8080/a.m3u8',
      '#EXTINF:-1,Metadata', 'http://169.254.169.254/latest/meta-data/',
      '#EXTINF:-1,Database', 'http://cdn.example.com:5432/a',
      '#EXTINF:-1,File', 'file:///etc/passwd',
      '#EXTINF:-1,Two', 'http://cdn.example.com/b.mp4',
    ].join('\n'));
    const { channels, skipped } = importer.buildChannels(entries, SECRET);
    assert.equal(channels.length, 2);
    assert.ok(skipped >= 5, `expected >=5 skipped, got ${skipped}`);
    assert.equal(channels[0].kind, 'hls');
    assert.equal(channels[1].kind, 'mp4');
  });

  await check('containers a browser cannot decode are flagged risky', () => {
    const entries = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1,TS\nhttp://cdn.example.com/a.ts\n#EXTINF:-1,MKV\nhttp://cdn.example.com/b.mkv\n#EXTINF:-1,HLS\nhttp://cdn.example.com/c.m3u8\n');
    const { channels } = importer.buildChannels(entries, SECRET);
    assert.equal(channels[0].risky, true);
    assert.equal(channels[1].risky, true);
    assert.equal(channels[2].risky, false);
  });

  await check('logos must be public HTTPS; http logos are dropped', () => {
    const entries = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1 tvg-logo="http://cdn.example.com/a.png",A\nhttp://cdn.example.com/a.m3u8\n#EXTINF:-1 tvg-logo="https://cdn.example.com/b.png",B\nhttp://cdn.example.com/b.m3u8\n');
    const { channels } = importer.buildChannels(entries, SECRET);
    assert.equal(channels[0].logo, undefined);
    assert.equal(channels[1].logo, 'https://cdn.example.com/b.png');
  });

  await check('channel output carries no raw origin URL or credentials', () => {
    const entries = importer.parsePlaylist('#EXTM3U\n#EXTINF:-1,A\nhttps://cdn.example.com/live/myuser/mypass/1.m3u8\n');
    const { channels } = importer.buildChannels(entries, SECRET);
    const serialised = JSON.stringify(channels);
    assert.ok(!serialised.includes('cdn.example.com'), 'origin host must not leak');
    assert.ok(!serialised.includes('myuser'), 'username must not leak');
    assert.ok(!serialised.includes('mypass'), 'password must not leak');
    assert.ok(channels[0].url.startsWith('/api/playlist/stream?t='));
  });

  await check('the channel cap is enforced and truncation is reported', () => {
    const lines = ['#EXTM3U'];
    for (let i = 0; i < importer.MAX_PLAYLIST_CHANNELS + 25; i++) {
      lines.push(`#EXTINF:-1,C${i}`, `https://cdn.example.com/${i}.m3u8`);
    }
    const { channels, total } = importer.buildChannels(importer.parsePlaylist(lines.join('\n')), SECRET);
    assert.equal(channels.length, importer.MAX_PLAYLIST_CHANNELS);
    assert.ok(total > channels.length);
  });

  // --- import orchestration ----------------------------------------------
  await check('import returns parsed channels, groups and host, with no raw URLs', async () => {
    importer.resetPlaylistCaches();
    guard.resetHostVerdicts();
    fetchImpl = async () => new Response('#EXTM3U\n#EXTINF:-1 group-title="News",One\nhttps://cdn.example.com/1.m3u8\n#EXTINF:-1 group-title="News",Two\nhttps://cdn.example.com/2.m3u8\n#EXTINF:-1 group-title="Sport",Three\nhttps://cdn.example.com/3.m3u8\n');
    const result = await importer.importPlaylist('https://list.example.com/p.m3u', 'owner-1');
    assert.equal(result.returned, 3);
    assert.equal(result.host, 'list.example.com');
    assert.equal(result.truncated, false);
    assert.deepEqual(result.groups[0], { name: 'News', count: 2 });
    assert.ok(!JSON.stringify(result).includes('cdn.example.com'));
  });

  await check('an HTML page is not accepted as a playlist', async () => {
    importer.resetPlaylistCaches();
    fetchImpl = async () => new Response('<html><body>Please log in</body></html>');
    await assert.rejects(() => importer.importPlaylist('https://list.example.com/login', 'owner-2'), /NOT_A_PLAYLIST/);
  });

  await check('a playlist with no usable channel is reported empty', async () => {
    importer.resetPlaylistCaches();
    fetchImpl = async () => new Response('#EXTM3U\n#EXTINF:-1,Internal\nhttp://127.0.0.1/a.m3u8\n');
    await assert.rejects(() => importer.importPlaylist('https://list.example.com/empty.m3u', 'owner-3'), /EMPTY_PLAYLIST/);
  });

  await check('a private playlist URL is refused before any fetch', async () => {
    importer.resetPlaylistCaches();
    fetchCalls = [];
    await assert.rejects(() => importer.importPlaylist('http://192.168.1.1/list.m3u', 'owner-4'), /INVALID_URL/);
    assert.equal(fetchCalls.length, 0, 'must not touch the network');
  });

  await check('a repeated import is served from cache', async () => {
    importer.resetPlaylistCaches();
    fetchCalls = [];
    fetchImpl = async () => new Response('#EXTM3U\n#EXTINF:-1,A\nhttps://cdn.example.com/a.m3u8\n');
    await importer.importPlaylist('https://list.example.com/cached.m3u', 'owner-5');
    await importer.importPlaylist('https://list.example.com/cached.m3u', 'owner-5');
    assert.equal(fetchCalls.length, 1, 'second import must not refetch');
  });

  await check('imports are rate limited per owner', async () => {
    importer.resetPlaylistCaches();
    fetchImpl = async () => new Response('#EXTM3U\n#EXTINF:-1,A\nhttps://cdn.example.com/a.m3u8\n');
    let limited = false;
    for (let i = 0; i < 40; i++) {
      try {
        await importer.importPlaylist(`https://list.example.com/r${i}.m3u`, 'owner-rate');
      } catch (error) {
        if (String(error.message) === 'RATE_LIMIT') { limited = true; break; }
        throw error;
      }
    }
    assert.equal(limited, true, 'expected RATE_LIMIT within 40 imports');
  });

  await check('oversized playlists are refused', async () => {
    importer.resetPlaylistCaches();
    fetchImpl = async () => new Response('#EXTM3U\n', { headers: { 'content-length': String(importer.PLAYLIST_MAX_BYTES + 1) } });
    await assert.rejects(() => importer.importPlaylist('https://list.example.com/huge.m3u', 'owner-6'), /TOO_LARGE/);
  });

  // --- import route -------------------------------------------------------
  await check('import route is POST-only', async () => {
    const res = await invoke(importRoute, { method: 'GET' });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
  });

  await check('import route requires a signed-in owner', async () => {
    const previous = { ...process.env };
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
      process.env.XTREAM_OWNER_USER_IDS = '11111111-1111-4111-8111-111111111111';
      const res = await invoke(importRoute, { method: 'POST', body: { url: 'https://list.example.com/a.m3u' } });
      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.body()).error, 'SIGN_IN_REQUIRED');
    } finally {
      for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'XTREAM_OWNER_USER_IDS']) {
        if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
      }
    }
  });

  await check('import route is fail-closed when accounts are off', async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const res = await invoke(importRoute, { method: 'POST', body: { url: 'https://list.example.com/a.m3u' } });
      assert.equal(res.statusCode, 503);
      assert.equal(JSON.parse(res.body()).error, 'ACCOUNTS_OFF');
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  await check('import responses are never cached by a CDN', async () => {
    const res = await invoke(importRoute, { method: 'GET' });
    assert.match(String(res.headers['cache-control']), /no-store/);
  });

  // --- stream proxy -------------------------------------------------------
  await check('stream proxy rejects a bad token and non-GET methods', async () => {
    const bad = await invoke(streamRoute, { query: { t: 'garbage' } });
    assert.equal(bad.statusCode, 403);
    assert.equal(JSON.parse(bad.body()).error, 'BAD_TOKEN');
    const post = await invoke(streamRoute, { method: 'POST' });
    assert.equal(post.statusCode, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
  });

  await check('stream proxy rewrites every reference back through itself', async () => {
    guard.resetHostVerdicts();
    const token = tokens.sealStream({ origin: 'https://cdn.example.com', path: '/live/1.m3u8' }, SECRET);
    fetchImpl = async () => new Response([
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/live/key.bin"',
      '#EXTINF:6.0,',
      'seg0.ts',
      'https://cdn.example.com/live/seg1.ts',
      'https://evil.example.com/steal.ts',
      '#EXT-X-ENDLIST',
    ].join('\n'), { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });

    const res = await invoke(streamRoute, { query: { t: token } });
    assert.equal(res.statusCode, 200);
    const body = res.body();
    assert.ok(!body.includes('cdn.example.com'), 'origin must not appear in the rewritten playlist');
    assert.ok(!body.includes('evil.example.com'), 'off-origin host must not appear');
    assert.ok(body.includes('t=off-origin'), 'off-origin reference must be neutralised');
    const proxied = body.split('\n').filter(line =>
      line.startsWith('/api/playlist/stream?t=') && !line.includes('t=off-origin'));
    assert.equal(proxied.length, 2, 'both same-origin segments must be proxied');
    assert.match(body, /URI="\/api\/playlist\/stream\?t=/, 'key URI must be proxied');
  });

  await check('the proxy forwards Referer and User-Agent upstream', async () => {
    guard.resetHostVerdicts();
    const token = tokens.sealStream({
      origin: 'https://cdn.example.com', path: '/live/1.m3u8',
      referrer: 'https://ref.example.com/page', userAgent: 'VLC/3.0.8',
    }, SECRET);
    fetchCalls = [];
    fetchImpl = async () => new Response('#EXTM3U\n#EXTINF:6,\nseg.ts\n', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
    const res = await invoke(streamRoute, { query: { t: token } });
    assert.equal(res.statusCode, 200);
    const sent = fetchCalls[0].init.headers;
    assert.equal(sent.Referer, 'https://ref.example.com/page');
    assert.equal(sent['User-Agent'], 'VLC/3.0.8');
  });

  await check('Range requests pass through so seeking works', async () => {
    guard.resetHostVerdicts();
    const token = tokens.sealStream({ origin: 'https://cdn.example.com', path: '/movie.mp4' }, SECRET);
    const media = Buffer.alloc(2048, 3);
    fetchImpl = async (_url, init) => {
      assert.equal(init.headers.Range, 'bytes=10-19');
      return new Response(media.subarray(10, 20), {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 10-19/2048', 'content-length': '10' },
      });
    };
    const res = await invoke(streamRoute, { query: { t: token }, headers: { range: 'bytes=10-19' } });
    assert.equal(res.statusCode, 206);
    assert.equal(res.headers['content-range'], 'bytes 10-19/2048');
    assert.equal(Buffer.concat(res.chunks).length, 10);
  });

  await check('a stream redirect off the sealed origin is refused', async () => {
    guard.resetHostVerdicts();
    const token = tokens.sealStream({ origin: 'https://cdn.example.com', path: '/live/1.m3u8' }, SECRET);
    fetchImpl = async () => new Response(null, { status: 302, headers: { location: 'https://other.example.com/1.m3u8' } });
    const res = await invoke(streamRoute, { query: { t: token } });
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body()).error, 'BLOCKED_TARGET');
  });

  await check('a token whose host now resolves internally is refused', async () => {
    guard.resetHostVerdicts();
    const token = tokens.sealStream({ origin: 'https://cdn.example.com', path: '/live/1.m3u8' }, SECRET);
    lookupImpl = async () => [{ address: '169.254.169.254', family: 4 }];
    const res = await invoke(streamRoute, { query: { t: token } });
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body()).error, 'BLOCKED_TARGET');
    lookupImpl = async () => [{ address: PUBLIC_IP, family: 4 }];
  });

  await check('stream responses are never cached by a CDN', async () => {
    const res = await invoke(streamRoute, { query: { t: 'garbage' } });
    assert.match(String(res.headers['cache-control']), /no-store/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });
} finally {
  globalThis.fetch = realFetch;
  dns.lookup = realLookup;
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error('Failures:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
