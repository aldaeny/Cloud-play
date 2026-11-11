/** Actual local HTTP bridge fixture. Nest authorization is separately tested;
 * this verifies forwarding/path bounds and absence of unauthenticated network IO. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const admin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(admin, '../..');
const out = mkdtempSync(path.join(admin, '.http-test-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), 'pages/api/admin/xtream-servers/[[...path]].ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--esModuleInterop', '--skipLibCheck', '--strict'], { cwd: admin });
const require = createRequire(path.join(out, 'fixture.cjs'));
const handler = require('./pages/api/admin/xtream-servers/[[...path]].js').default;
let calls = [];
const server = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  calls.push({ method: req.method, path: req.url, authorization: req.headers.authorization, body });
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'SUCCEEDED', revision: 1 }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const previous = process.env.API_INTERNAL_URL;
process.env.API_INTERNAL_URL = `http://127.0.0.1:${server.address().port}`;
async function invoke(method, segments, authorization, body = {}) {
  const res = { code: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, query: { path: segments }, headers: authorization ? { authorization } : {}, body }, res);
  return res;
}
const id = '11111111-1111-4111-8111-111111111111';
try {
  assert.equal((await invoke('POST', [id, 'catalog-sync', 'pull'])).code, 401);
  assert.equal(calls.length, 0);
  assert.equal((await invoke('GET', ['..', 'secrets'], 'Bearer fixture')).code, 400);
  assert.equal((await invoke('PUT', [id], 'Bearer fixture')).code, 405);
  assert.equal(calls.length, 0);
  const result = await invoke('POST', [id, 'catalog-sync', 'pull'], 'Bearer fixture', { authorizationConfirmed: true });
  assert.equal(result.code, 200); assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls[0], { method: 'POST', path: `/admin/xtream-servers/${id}/catalog-sync/pull`, authorization: 'Bearer fixture', body: '{"authorizationConfirmed":true}' });
  assert.equal((await invoke('GET', [id, 'catalog-sync'], 'Bearer fixture')).code, 200);
  assert.equal(calls[1].path, `/admin/xtream-servers/${id}/catalog-sync`);
  console.log('PASS Admin bridge actual HTTP: no-token no-network; invalid-path; method; confirmed pull forwarding; no-store; history GET');
} finally {
  if (previous === undefined) delete process.env.API_INTERNAL_URL; else process.env.API_INTERNAL_URL = previous;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  rmSync(out, { recursive: true, force: true });
}
