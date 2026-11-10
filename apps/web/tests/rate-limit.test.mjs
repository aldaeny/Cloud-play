/**
 * Tests for the shared web API rate limiter.
 *
 * Load-bearing properties: the window actually resets, memory stays bounded
 * under a key spray, a forged x-forwarded-for is NOT trusted by default, streaming
 * gets a budget that will not break HLS playback, and a 429 is never CDN-cached.
 *
 * Run: npm run test:rate-limit --workspace aether-web
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

const out = mkdtempSync(path.join(webRoot, '.rate-limit-test-'));
const realTrust = process.env.TRUST_PROXY;

try {
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc, 'src/server/rate-limit.ts',
    '--outDir', out, '--rootDir', '.', '--module', 'commonjs',
    '--target', 'es2022', '--skipLibCheck', '--strict', '--lib', 'es2022,dom',
  ], { cwd: webRoot, stdio: 'pipe' });

  const mod = await import(pathToFileURL(path.join(out, 'src/server/rate-limit.js')).href);
  const { BoundedRateLimiter, enforceRateLimit, clientKey, resetRateLimits, RATE_BUCKETS } = mod;

  function fakeReq({ ip = '1.2.3.4', forwarded } = {}) {
    return { headers: forwarded ? { 'x-forwarded-for': forwarded } : {}, socket: { remoteAddress: ip } };
  }

  function fakeRes() {
    return {
      headers: {}, statusCode: null, body: null,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
  }

  console.log('\nrate-limit');

  await check('allows up to the limit then blocks with a retry hint', async () => {
    const limiter = new BoundedRateLimiter(60_000);
    const t0 = 1_000_000;
    for (let i = 1; i <= 3; i++) {
      const r = limiter.check('k', 3, t0);
      assert.equal(r.allowed, true, `request ${i}`);
      assert.equal(r.remaining, 3 - i);
    }
    const blocked = limiter.check('k', 3, t0);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
  });

  await check('resets after the window elapses', async () => {
    const limiter = new BoundedRateLimiter(60_000);
    const t0 = 1_000_000;
    limiter.check('k', 1, t0);
    assert.equal(limiter.check('k', 1, t0 + 1).allowed, false);
    assert.equal(limiter.check('k', 1, t0 + 60_000).allowed, true, 'window must roll over');
  });

  await check('keeps separate counters per key', async () => {
    const limiter = new BoundedRateLimiter(60_000);
    const t0 = 1_000_000;
    assert.equal(limiter.check('a', 1, t0).allowed, true);
    assert.equal(limiter.check('b', 1, t0).allowed, true);
    assert.equal(limiter.check('a', 1, t0).allowed, false);
  });

  await check('bounds memory under a spray of unique keys and fails closed', async () => {
    const limiter = new BoundedRateLimiter(60_000, 50);
    const t0 = 1_000_000;
    for (let i = 0; i < 500; i++) limiter.check(`ip-${i}`, 10, t0);
    assert.ok(limiter.size <= 50, `map must stay bounded, got ${limiter.size}`);
    assert.equal(limiter.check('brand-new', 10, t0).allowed, false, 'must refuse rather than evict live counters');
  });

  await check('reclaims expired keys instead of staying permanently full', async () => {
    const limiter = new BoundedRateLimiter(60_000, 10);
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) limiter.check(`ip-${i}`, 5, t0);
    assert.equal(limiter.size, 10);
    assert.equal(limiter.check('later', 5, t0 + 61_000).allowed, true, 'expired keys must be reclaimed');
  });

  await check('does NOT trust a forged x-forwarded-for by default', async () => {
    delete process.env.TRUST_PROXY;
    const a = clientKey(fakeReq({ ip: '9.9.9.9', forwarded: '1.1.1.1' }));
    const b = clientKey(fakeReq({ ip: '9.9.9.9', forwarded: '2.2.2.2' }));
    assert.equal(a, '9.9.9.9');
    assert.equal(a, b, 'a forged header must not create a fresh bucket');
  });

  await check('uses the forwarding header only when TRUST_PROXY is explicitly enabled', async () => {
    process.env.TRUST_PROXY = 'true';
    assert.equal(clientKey(fakeReq({ ip: '9.9.9.9', forwarded: '1.1.1.1, 2.2.2.2' })), '1.1.1.1');
    delete process.env.TRUST_PROXY;
  });

  await check('falls back to one shared bucket when no address is available', async () => {
    delete process.env.TRUST_PROXY;
    assert.equal(clientKey({ headers: {}, socket: {} }), 'shared');
  });

  await check('streaming budget is far higher than catalog so HLS is not throttled', async () => {
    assert.ok(RATE_BUCKETS.stream >= 600, 'HLS needs many segment requests per minute');
    assert.ok(RATE_BUCKETS.stream > RATE_BUCKETS.catalog * 5);
    assert.ok(RATE_BUCKETS.write <= RATE_BUCKETS.catalog);
  });

  await check('enforceRateLimit passes then returns a non-cacheable 429', async () => {
    resetRateLimits();
    const req = fakeReq({ ip: '5.5.5.5' });
    const ok = fakeRes();
    assert.equal(enforceRateLimit(req, ok, { bucket: 'write', limit: 2 }), true);
    assert.equal(ok.headers['x-ratelimit-limit'], '2');
    assert.equal(enforceRateLimit(req, fakeRes(), { bucket: 'write', limit: 2 }), true);

    const blocked = fakeRes();
    assert.equal(enforceRateLimit(req, blocked, { bucket: 'write', limit: 2 }), false);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.body.error, 'RATE_LIMITED');
    assert.ok(Number(blocked.headers['retry-after']) >= 1);
    assert.equal(blocked.headers['cache-control'], 'no-store', 'a 429 must never be CDN-cached');
  });

  await check('buckets do not share counters', async () => {
    resetRateLimits();
    const req = fakeReq({ ip: '6.6.6.6' });
    assert.equal(enforceRateLimit(req, fakeRes(), { bucket: 'catalog', limit: 1 }), true);
    assert.equal(enforceRateLimit(req, fakeRes(), { bucket: 'catalog', limit: 1 }), false);
    assert.equal(enforceRateLimit(req, fakeRes(), { bucket: 'stream', limit: 1 }), true, 'stream must be independent');
  });

  await check('different clients do not consume each other’s budget', async () => {
    resetRateLimits();
    assert.equal(enforceRateLimit(fakeReq({ ip: '7.7.7.7' }), fakeRes(), { bucket: 'catalog', limit: 1 }), true);
    assert.equal(enforceRateLimit(fakeReq({ ip: '8.8.8.8' }), fakeRes(), { bucket: 'catalog', limit: 1 }), true);
  });
} finally {
  if (realTrust === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = realTrust;
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
