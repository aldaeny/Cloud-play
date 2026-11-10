import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { pinnedProviderRequest } from './pinned-provider-request';

/** Deterministic transport simulations. Real TLS checks live separately. */
describe('pinned provider HTTPS transport', () => {
  const url = new URL('https://provider.example:2053/player_api.php');
  const init = { method: 'POST', body: 'username=fixture&password=not-real' };
  function harness(status = 200, chunks = [Buffer.from('{"user_info":{"auth":1}}')], headers = {}) {
    let pinned: unknown;
    const lookup = jest.fn().mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const request = jest.fn((_url, options, callback) => {
      const req = new EventEmitter() as EventEmitter & { end: jest.Mock; destroy: jest.Mock };
      req.destroy = jest.fn();
      req.end = jest.fn(() => {
        options.lookup('provider.example', { all: true }, (_error: unknown, records: unknown) => { pinned = records; });
        queueMicrotask(() => {
          const response = Object.assign(Readable.from(chunks), { statusCode: status, headers });
          callback(response);
        });
      });
      return req;
    });
    const deps = { lookup, request } as unknown as NonNullable<Parameters<typeof pinnedProviderRequest>[2]>;
    return { lookup, request, deps, getPinned: () => pinned };
  }
  it('pins the actual socket lookup to the validated IP, preserving SNI and certificate checks', async () => {
    const h = harness();
    // A malicious resolver would give private IP on its second call.
    h.lookup.mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const response = await pinnedProviderRequest(url, init, h.deps);
    expect(response.status).toBe(200);
    expect(h.lookup).toHaveBeenCalledTimes(1);
    expect(h.getPinned()).toEqual([{ address: '8.8.8.8', family: 4 }]);
    expect(h.request.mock.calls[0][0].hostname).toBe('provider.example');
    expect(h.request.mock.calls[0][1]).toMatchObject({ agent: false, rejectUnauthorized: true, servername: 'provider.example' });
  });
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1'])('refuses DNS address %s before creating a socket', async address => {
    const h = harness(); h.lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]);
    await expect(pinnedProviderRequest(url, init, h.deps)).rejects.toMatchObject({ code: 'INVALID_URL' });
    expect(h.request).not.toHaveBeenCalled();
  });
  it('refuses a mixed public/private DNS answer', async () => {
    const h = harness(); h.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '::1', family: 6 }]);
    await expect(pinnedProviderRequest(url, init, h.deps)).rejects.toMatchObject({ code: 'INVALID_URL' });
    expect(h.request).not.toHaveBeenCalled();
  });
  it('never follows even a successful-origin redirect to loopback', async () => {
    const h = harness(302, [], { location: 'https://127.0.0.1/private' });
    expect((await pinnedProviderRequest(url, init, h.deps)).status).toBe(302);
    expect(h.request).toHaveBeenCalledTimes(1);
    expect(h.lookup).toHaveBeenCalledTimes(1);
  });
  it.each([{ headers: { 'content-length': '9999999' }, chunks: [] }, { headers: {}, chunks: [Buffer.alloc(65537)] }])('rejects oversized declared/chunked responses', async ({ headers, chunks }) => {
    const h = harness(200, chunks, headers);
    await expect(pinnedProviderRequest(url, init, h.deps)).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
  it('refuses HTTP even when an old integration allowed it', async () => {
    const h = harness();
    await expect(pinnedProviderRequest(new URL('http://provider.example'), init, h.deps)).rejects.toMatchObject({ code: 'INVALID_URL' });
    expect(h.request).not.toHaveBeenCalled();
  });
  it('fails closed on an expired deadline', async () => {
    const h = harness(); const abort = new AbortController(); abort.abort();
    await expect(pinnedProviderRequest(url, { ...init, signal: abort.signal }, h.deps)).rejects.toMatchObject({ code: 'ORIGIN_UNREACHABLE' });
    expect(h.request).not.toHaveBeenCalled();
  });
  it('does not disclose raw DNS errors or credentials', async () => {
    const h = harness(); h.lookup.mockRejectedValue(new Error('secret password backend host'));
    await expect(pinnedProviderRequest(url, init, h.deps)).rejects.toThrow('ORIGIN_UNREACHABLE');
  });
});
