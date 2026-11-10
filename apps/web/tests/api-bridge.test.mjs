/**
 * Tests for the server-side Next.js -> NestJS bridge (Hybrid, D1 Option C).
 *
 * The load-bearing properties are that the bridge cannot be turned into an open
 * proxy, never forwards a bearer token to an unvalidated or plaintext origin,
 * never leaks upstream bodies/URLs to the browser, and fails closed when the API
 * is unconfigured or unreachable.
 *
 * Run: npm run test:api-bridge --workspace aether-web
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

const out = mkdtempSync(path.join(webRoot, '.api-bridge-test-'));
const realFetch = globalThis.fetch;
const realEnv = process.env.API_INTERNAL_URL;

try {
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc, 'src/server/api-bridge.ts', 'pages/api/account/profiles.ts',
    '--outDir', out, '--rootDir', '.', '--module', 'commonjs',
    '--target', 'es2022', '--skipLibCheck', '--strict', '--lib', 'es2022,dom',
  ], { cwd: webRoot, stdio: 'pipe' });

  const mod = await import(pathToFileURL(path.join(out, 'src/server/api-bridge.js')).href);
  const { callApi, resolveApiOrigin, safeApiPath, bearerFrom, apiConfigured } = mod;

  const TOKEN = 'aaa.bbb.ccc';
  const AUTH = `Bearer ${TOKEN}`;

  function setOrigin(value) {
    if (value === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = value;
  }

  function mockFetch(impl) {
    globalThis.fetch = impl;
  }

  function jsonResponse(status, body) {
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  }

  const routeModule = await import(pathToFileURL(path.join(out, 'pages/api/account/profiles.js')).href);
  const profilesHandler = routeModule.default.default || routeModule.default;
  async function route(method = 'GET', authorization = AUTH) {
    const response = { statusCode: 200, headers: {}, body: null,
      setHeader(key, value) { this.headers[key] = value; return this; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    await profilesHandler({ method, headers: { authorization }, socket: { remoteAddress: '127.0.0.1' },
      query: { userId: 'forged', path: '/admin' } }, response);
    return response;
  }

  await check('profiles proxy uses a fixed backend path and no-store', async () => {
    setOrigin('https://api.example.com');
    let target;
    mockFetch(async url => { target = String(url); return jsonResponse(200, { data: [] }); });
    const response = await route();
    assert.equal(target, 'https://api.example.com/hybrid/profiles');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, { data: [] });
  });

  await check('profiles proxy refuses writes', async () => {
    const response = await route('POST');
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, 'GET');
  });

  await check('profiles proxy fails closed when backend is unconfigured', async () => {
    setOrigin(undefined);
    const response = await route();
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { error: 'API_NOT_CONFIGURED' });
  });

  console.log('\napi-bridge');

  await check('reports not-configured and makes no network call', async () => {
    setOrigin(undefined);
    let called = false;
    mockFetch(async () => { called = true; return jsonResponse(200, {}); });
    assert.equal(apiConfigured(), false);
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'API_NOT_CONFIGURED');
    assert.equal(result.status, 503);
    assert.equal(called, false, 'must not call the network when unconfigured');
  });

  await check('accepts an HTTPS origin and loopback HTTP for development', async () => {
    setOrigin('https://api.example.com');
    assert.deepEqual(resolveApiOrigin(), { origin: 'https://api.example.com' });
    setOrigin('http://127.0.0.1:3000');
    assert.deepEqual(resolveApiOrigin(), { origin: 'http://127.0.0.1:3000' });
    setOrigin('http://localhost:3000');
    assert.deepEqual(resolveApiOrigin(), { origin: 'http://localhost:3000' });
  });

  await check('refuses plaintext HTTP to a non-loopback host', async () => {
    setOrigin('http://api.example.com');
    assert.deepEqual(resolveApiOrigin(), { code: 'API_ORIGIN_INVALID' });
    let called = false;
    mockFetch(async () => { called = true; return jsonResponse(200, {}); });
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'API_ORIGIN_INVALID');
    assert.equal(called, false, 'must never send a bearer token over plaintext');
  });

  await check('refuses userinfo, path, query, fragment and non-http schemes', async () => {
    for (const value of [
      'https://user:pass@api.example.com',
      'https://api.example.com/base',
      'https://api.example.com?q=1',
      'https://api.example.com#frag',
      'file:///etc/passwd',
      'ftp://api.example.com',
      'not-a-url',
    ]) {
      setOrigin(value);
      assert.deepEqual(resolveApiOrigin(), { code: 'API_ORIGIN_INVALID' }, value);
    }
  });

  await check('path guard blocks open-proxy and traversal attempts', async () => {
    for (const value of [
      'https://evil.example.com/x', '//evil.example.com', '/../../admin',
      '/a/../b', '/a\\b', 'profiles', 'javascript:alert(1)', '/x\r\nHost: evil', '/x\0',
    ]) {
      assert.equal(safeApiPath(value), null, `should reject ${JSON.stringify(value)}`);
    }
    assert.equal(safeApiPath('/profiles'), '/profiles');
    assert.equal(safeApiPath('/playback/sessions?id=1'), '/playback/sessions?id=1');
  });

  await check('bearer extraction rejects malformed headers', async () => {
    assert.equal(bearerFrom(AUTH), TOKEN);
    assert.equal(bearerFrom(`bearer   ${TOKEN} `), TOKEN);
    assert.equal(bearerFrom([AUTH]), TOKEN);
    for (const value of [undefined, null, '', 'Basic abc', 'Bearer', 'Bearer ', 'Bearer a.b', `Bearer ${'x'.repeat(5000)}`]) {
      assert.equal(bearerFrom(value), null, `should reject ${JSON.stringify(value)}`);
    }
  });

  await check('requires a session by default and does not call upstream', async () => {
    setOrigin('https://api.example.com');
    let called = false;
    mockFetch(async () => { called = true; return jsonResponse(200, {}); });
    const result = await callApi({ path: '/profiles' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SIGN_IN_REQUIRED');
    assert.equal(result.status, 401);
    assert.equal(called, false);
  });

  await check('forwards the token, refuses redirects and disables caching', async () => {
    setOrigin('https://api.example.com');
    let seen = null;
    mockFetch(async (url, init) => { seen = { url: String(url), init }; return jsonResponse(200, { id: 'u1' }); });
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { id: 'u1' });
    assert.equal(seen.url, 'https://api.example.com/profiles');
    assert.equal(seen.init.headers.Authorization, AUTH);
    assert.equal(seen.init.redirect, 'error');
    assert.equal(seen.init.cache, 'no-store');
    assert.ok(seen.init.signal, 'must bound the request with a timeout');
  });

  await check('sends a JSON body only for write methods', async () => {
    setOrigin('https://api.example.com');
    let seen = null;
    mockFetch(async (url, init) => { seen = init; return jsonResponse(201, { ok: true }); });
    await callApi({ path: '/profiles', method: 'POST', authorization: AUTH, body: { name: 'Kid' } });
    assert.equal(seen.method, 'POST');
    assert.equal(seen.body, JSON.stringify({ name: 'Kid' }));
    assert.equal(seen.headers['Content-Type'], 'application/json');

    await callApi({ path: '/profiles', method: 'GET', authorization: AUTH, body: { ignored: true } });
    assert.equal(seen.body, undefined, 'GET must not carry a body');
  });

  await check('rejects an oversized request body before sending', async () => {
    setOrigin('https://api.example.com');
    let called = false;
    mockFetch(async () => { called = true; return jsonResponse(200, {}); });
    const result = await callApi({ path: '/profiles', method: 'POST', authorization: AUTH, body: { blob: 'x'.repeat(300 * 1024) } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 413);
    assert.equal(called, false);
  });

  await check('passes 4xx status through but never the upstream body', async () => {
    setOrigin('https://api.example.com');
    mockFetch(async () => jsonResponse(403, { message: 'internal detail', sql: 'select 1', url: 'https://secret.internal' }));
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.equal(result.upstreamStatus, 403);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('internal detail'));
    assert.ok(!serialized.includes('secret.internal'));
    assert.ok(!serialized.includes('select 1'));
  });

  await check('collapses upstream 5xx to 503 without leaking detail', async () => {
    setOrigin('https://api.example.com');
    mockFetch(async () => jsonResponse(500, { stack: 'Error at /srv/app/secret.js' }));
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.ok(!JSON.stringify(result).includes('/srv/app'));
  });

  await check('fails closed on network error, timeout or redirect refusal', async () => {
    setOrigin('https://api.example.com');
    mockFetch(async () => { throw new Error('redirect refused'); });
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'API_UNAVAILABLE');
    assert.equal(result.status, 503);
  });

  await check('treats a non-JSON success body as unavailable, not as data', async () => {
    setOrigin('https://api.example.com');
    mockFetch(async () => new Response('<html>gateway</html>', { status: 200 }));
    const result = await callApi({ path: '/profiles', authorization: AUTH });
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
  });

  await check('handles an empty 204 response', async () => {
    setOrigin('https://api.example.com');
    mockFetch(async () => new Response(null, { status: 204 }));
    const result = await callApi({ path: '/profiles/p1', method: 'DELETE', authorization: AUTH });
    assert.equal(result.ok, true);
    assert.equal(result.status, 204);
    assert.equal(result.data, null);
  });

  await check('rejects oversized declared and chunked responses', async () => {
    setOrigin('https://api.example.com');
    for (const headers of [{ 'content-length': '999999' }, {}]) {
      mockFetch(async () => new Response('x'.repeat(300 * 1024), { headers }));
      const result = await callApi({ path: '/profiles', authorization: AUTH });
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    }
  });

  await check('fails closed when response stream breaks or JSON is empty', async () => {
    setOrigin('https://api.example.com');
    for (const response of [new Response(''), new Response(new ReadableStream({
      start(controller) { controller.error(new Error('broken transport')); },
    }))]) {
      mockFetch(async () => response);
      const result = await callApi({ path: '/profiles', authorization: AUTH });
      assert.equal(result.ok, false);
      assert.equal(result.status, 502);
    }
  });

  await check('rejects unserializable request data without throwing or fetching', async () => {
    setOrigin('https://api.example.com');
    mockFetch(async () => { throw new Error('must not fetch'); });
    const cyclic = {}; cyclic.self = cyclic;
    const result = await callApi({ path: '/profiles', method: 'POST', authorization: AUTH, body: cyclic });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });

  await check('allows an explicitly public endpoint without a session', async () => {
    setOrigin('https://api.example.com');
    let seen = null;
    mockFetch(async (url, init) => { seen = init; return jsonResponse(200, { status: 'healthy' }); });
    const result = await callApi({ path: '/health', requireAuth: false });
    assert.equal(result.ok, true);
    assert.equal(seen.headers.Authorization, undefined);
  });

  await check('never places the token in the URL', async () => {
    setOrigin('https://api.example.com');
    let seen = '';
    mockFetch(async (url) => { seen = String(url); return jsonResponse(200, {}); });
    await callApi({ path: '/profiles', authorization: AUTH });
    assert.ok(!seen.includes(TOKEN), 'token must travel in a header only');
  });
} finally {
  globalThis.fetch = realFetch;
  if (realEnv === undefined) delete process.env.API_INTERNAL_URL;
  else process.env.API_INTERNAL_URL = realEnv;
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
