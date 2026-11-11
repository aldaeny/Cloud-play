import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const out = mkdtempSync(path.join(tmpdir(), 'cloudplay-pinned-'));
const root = process.cwd();
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'),
  'apps/web/src/server/safe-fetch.ts', 'apps/web/src/server/public-fetch.ts', '--outDir', out, '--module', 'commonjs',
  '--target', 'es2022', '--esModuleInterop', '--skipLibCheck', '--strict']);
const require = createRequire(path.join(out, 'test.cjs'));
const dns = require('node:dns/promises'), http = require('node:http');
const originalLookup = dns.lookup, originalRequest = http.request;
const { publicFetch } = require('./public-fetch.js');
const { safeFetch, resetHostVerdicts, isPrivateAddress } = require('./safe-fetch.js');
let answers, sockets = 0, seenPinned, requests = 0;
const server = http.createServer((req, res) => {
  requests++;
  if (req.url === '/redirect') { res.writeHead(302, { location: 'http://127.0.0.1/private' }); res.end(); }
  else if (req.url === '/denied') { res.writeHead(401); res.end('denied'); }
  else if (req.url === '/public-redirect') { res.writeHead(302, { location: '/final' }); res.end(); }
  else if (req.url === '/oversize') res.end(Buffer.alloc(100));
  else if (req.url === '/slow') { /* deadline */ }
  else res.end('fixture');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
dns.lookup = async () => answers.shift() || [{ address: '8.8.8.8', family: 4 }];
http.request = (url, options, callback) => {
  // Exercise the ACTUAL transport's lookup; only route its verified public
  // address to our local socket fixture. Production has no such override.
  const lookup = options.lookup;
  return originalRequest(url, { ...options, lookup: (host, opts, cb) => {
    lookup(host, opts, (error, value) => {
      if (error) { cb(error); return; }
      sockets++; seenPinned = value;
      if (opts.all) cb(null, [{ address: '127.0.0.1', family: 4 }]);
      else cb(null, '127.0.0.1', 4);
    });
  } }, callback);
};
let passed = 0;
async function test(name, fn) {
  resetHostVerdicts(); answers = []; await fn(); passed++; console.log('PASS', name);
}
try {
  await test('actual streaming HTTP succeeds using validated socket lookup', async () => {
    assert.equal(await (await safeFetch(`http://fixture.example:${port}/`)).response.text(), 'fixture');
    assert.ok(seenPinned);
  });
  for (const address of ['127.0.0.1', '10.0.0.1', '::1', '::ffff:7f00:1', '2002:7f00:1::', '2001:db8::1', 'garbage']) {
    await test(`preflight-public / connect-${address} rebinding refused`, async () => {
      answers = [[{ address: '8.8.8.8', family: 4 }], [{ address, family: address.includes(':') ? 6 : 4 }]];
      const before = sockets;
      await assert.rejects(safeFetch(`http://fixture.example:${port}/`));
      assert.equal(sockets, before);
    });
  }
  await test('malformed DNS family refused on actual lookup', async () => {
    answers = [[{ address: '8.8.8.8', family: 4 }], [{ address: '8.8.8.8', family: 6 }]];
    await assert.rejects(safeFetch(`http://fixture.example:${port}/`));
  });
  await test('actual redirect to private literal rejected without second request', async () => {
    const before = requests;
    await assert.rejects(safeFetch(`http://fixture.example:${port}/redirect`));
    assert.equal(requests, before + 1);
  });
  await test('stream byte bound enforced', async () => {
    await assert.rejects(async () => (await safeFetch(`http://fixture.example:${port}/oversize`, { maxBytes: 10 })).response.text());
  });
  await test('actual stalled socket deadline enforced', async () => {
    await assert.rejects(safeFetch(`http://fixture.example:${port}/slow`, { timeoutMs: 50 }));
  });
  await test('IPv6 global addresses permitted; reserved and transition denied', async () => {
    assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
    for (const ip of ['::', 'fc00::1', 'fe80::1', '64:ff9b::7f00:1', '2001::1', '2002::1', 'bad::ip']) assert.equal(isPrivateAddress(ip), true, ip);
  });
  await test('public adapter preserves HTTP denial status, never masks invalid credentials as success', async () => {
    assert.equal((await publicFetch(`http://fixture.example:${port}/denied`)).status, 401);
  });
  await test('public adapter denies redirects by default', async () => {
    await assert.rejects(publicFetch(`http://fixture.example:${port}/public-redirect`));
  });
  await test('public adapter returns manual redirect for the origin-pinned stream loop', async () => {
    assert.equal((await publicFetch(`http://fixture.example:${port}/public-redirect`, { redirect: 'manual' })).status, 302);
  });
  await test('public adapter follows same-origin redirect through a fresh validated socket', async () => {
    assert.equal(await (await publicFetch(`http://fixture.example:${port}/public-redirect`, { redirect: 'follow' })).text(), 'fixture');
  });
  await test('public adapter propagates caller abort to the actual stalled socket', async () => {
    await assert.rejects(publicFetch(`http://fixture.example:${port}/slow`, { signal: AbortSignal.timeout(50) }));
  });
  await test('public adapter rejects non-read-only methods', async () => {
    await assert.rejects(publicFetch(`http://fixture.example:${port}/`, { method: 'POST', body: 'no' }));
  });
  console.log(`${passed} passed; actual local HTTP, fixture DNS routing, no external origin`);
} finally {
  dns.lookup = originalLookup; http.request = originalRequest;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  rmSync(out, { recursive: true, force: true });
}
