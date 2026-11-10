import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as https from 'node:https';
import { AddressInfo } from 'node:net';
import { pinnedProviderRequest } from './pinned-provider-request';

/** Actual local TLS/HTTP sockets. Only DNS/routing is fixture-injected so a
 * loopback test server does not require weakening the production public-IP rule. */
describe('provider transport real TLS and HTTP', () => {
  let server: https.Server;
  let dir: string, port: number, cert: Buffer;
  const requests: string[] = [];
  let selected: unknown;
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'cloudplay-tls-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=provider.fixture', '-addext', 'subjectAltName=DNS:provider.fixture',
      '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem')], { stdio: 'ignore' });
    cert = readFileSync(path.join(dir, 'cert.pem'));
    server = https.createServer({ key: readFileSync(path.join(dir, 'key.pem')), cert }, (req, res) => {
      requests.push(req.url || '');
      if (req.url === '/slow') return;
      if (req.url === '/redirect') { res.writeHead(302, { location: 'https://127.0.0.1/private' }); res.end(); return; }
      if (req.url === '/large') { res.end(Buffer.alloc(70000)); return; }
      res.end(JSON.stringify({ servername: (req.socket as import('node:tls').TLSSocket).servername, host: req.headers.host }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  });
  function deps(trust = true) {
    return {
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request: (url, options, callback) => {
        // Verify the production-generated socket lookup is pinned, then route
        // only this test's native HTTPS socket to the local fixture server.
        options.lookup(url.hostname, { all: true }, (_error, records) => { selected = records; });
        return https.request(url, { ...options, ...(trust ? { ca: cert } : {}),
          lookup: (_host, opts, cb) => opts.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4) }, callback);
      },
    } as unknown as NonNullable<Parameters<typeof pinnedProviderRequest>[2]>;
  }
  const init = { method: 'POST', body: 'username=fixture&password=fixture' };
  it('uses original SNI/Host and trusted certificate over a real TLS socket', async () => {
    const response = await pinnedProviderRequest(new URL(`https://provider.fixture:${port}/ok`), init, deps());
    expect(await response.json()).toEqual({ servername: 'provider.fixture', host: `provider.fixture:${port}` });
    expect(selected).toEqual([{ address: '8.8.8.8', family: 4 }]);
  });
  it('rejects a validly trusted certificate with the wrong hostname', async () => {
    await expect(pinnedProviderRequest(new URL(`https://wrong.fixture:${port}/ok`), init, deps())).rejects.toMatchObject({ code: 'ORIGIN_UNREACHABLE' });
  });
  it('rejects an untrusted certificate', async () => {
    await expect(pinnedProviderRequest(new URL(`https://provider.fixture:${port}/ok`), init, deps(false))).rejects.toMatchObject({ code: 'ORIGIN_UNREACHABLE' });
  });
  it('does not follow an actual HTTP redirect', async () => {
    const before = requests.length;
    const response = await pinnedProviderRequest(new URL(`https://provider.fixture:${port}/redirect`), init, deps());
    expect(response.status).toBe(302); expect(requests.length).toBe(before + 1);
  });
  it('aborts an actual stalled response at the deadline', async () => {
    await expect(pinnedProviderRequest(new URL(`https://provider.fixture:${port}/slow`),
      { ...init, signal: AbortSignal.timeout(100) }, deps())).rejects.toMatchObject({ code: 'ORIGIN_UNREACHABLE' });
  });
  it('rejects actual oversized bytes', async () => {
    await expect(pinnedProviderRequest(new URL(`https://provider.fixture:${port}/large`), init, deps())).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
});
