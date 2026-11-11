// Actual isolated TLS sockets and HTTP GET. Test-only DNS/socket routing below
// maps a validated public fixture hostname onto a disposable loopback listener.
// Production pinnedProviderRequest has no such routing override/config flag.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer, request } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { pinnedProviderRequest } = require('../dist/common/pinned-provider-request.js');
const { parseHls } = require('../dist/modules/admin/external-policy.js');
const temp = await mkdtemp(path.join(tmpdir(), 'external-tls-'));
let server;
let count = 0;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(temp, 'key.pem'), '-out', path.join(temp, 'cert.pem'), '-days', '1', '-subj', '/CN=fixture.example', '-addext', 'subjectAltName=DNS:fixture.example'], { stdio: 'ignore', timeout: 10000 });
  const key = await readFile(path.join(temp, 'key.pem')), cert = await readFile(path.join(temp, 'cert.pem'));
  server = createServer({ key, cert }, (req, res) => {
    count++;
    const route = req.url;
    if (route === '/slow') return setTimeout(() => res.end('late'), 250);
    if (route.startsWith('/status/')) { res.statusCode = Number(route.split('/').pop()); res.setHeader('location', 'https://127.0.0.1/private'); return res.end('secret fixture body'); }
    if (route === '/segment.ts') { res.setHeader('content-type', 'video/mp2t'); return res.end(Buffer.alloc(188, 0x47)); }
    res.setHeader('content-type', 'application/vnd.apple.mpegurl');
    res.end(route === '/malformed' ? '<html>not HLS</html>' : '#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts\n#EXT-X-ENDLIST\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `https://fixture.example:${server.address().port}`;
  const deps = trusted => ({
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request: (url, options, callback) => {
      assert.equal(options.rejectUnauthorized, true); assert.equal(options.servername, 'fixture.example');
      options.lookup(url.hostname, {}, (_err, ip) => assert.equal(ip, '8.8.8.8'));
      return request(url, { ...options, ...(trusted ? { ca: cert } : {}), lookup: (_name, opts, done) => opts.all ? done(null, [{ address: '127.0.0.1', family: 4 }]) : done(null, '127.0.0.1', 4) }, callback);
    },
  });
  const get = (route, trusted = true, signal = AbortSignal.timeout(1000)) => pinnedProviderRequest(new URL(base + route), { method: 'GET', signal }, deps(trusted), 4096);
  const manifest = await get('/valid');
  assert.equal(manifest.status, 200); assert.equal(manifest.headers.get('content-type'), 'application/vnd.apple.mpegurl');
  const parsed = parseHls(await manifest.text(), new URL(base + '/valid'));
  assert.equal(parsed.result, 'reachable_and_hls_valid');
  const segment = await get('/segment.ts'); assert.equal((await segment.arrayBuffer()).byteLength, 188);
  assert.equal(parseHls(await (await get('/malformed')).text(), new URL(base)).result, 'malformed_playlist');
  for (const status of [401, 403, 404, 429, 500, 302]) {
    const before = count, response = await get('/status/' + status);
    assert.equal(response.status, status); assert.equal(await response.text(), ''); assert.equal(count, before + 1);
  }
  await assert.rejects(get('/valid', false), { code: 'ORIGIN_UNREACHABLE' });
  await assert.rejects(get('/slow', true, AbortSignal.timeout(30)), { code: 'ORIGIN_UNREACHABLE' });
  console.log('PASS actual isolated TLS/GET: trusted SNI/certificate, valid/malformed HLS and synthetic segment,401/403/404/429/500/redirect refused,untrusted certificate rejected,bounded timeout. Fixture socket mapping only; no provider access or decoding claim.');
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(temp, { recursive: true, force: true });
}
