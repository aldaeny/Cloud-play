import transport = require('../../common/pinned-provider-request');
import { XtreamHealthService, probeUrlAllowed, MAX_SERVERS_PER_SWEEP, MIN_RECHECK_INTERVAL_MS } from './xtream-health.service';

const target = { baseUrl: 'https://provider.example:2053', username: 'operator', password: 'secret-value' };

describe('XtreamHealthService', () => {
  let service: XtreamHealthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new XtreamHealthService();
    fetchMock = jest.spyOn(transport, 'pinnedProviderRequest') as jest.Mock;
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function replies(status: number, body: string) {
    fetchMock.mockResolvedValue(new Response(body, { status }));
  }

  describe('URL re-validation at probe time', () => {
    it('accepts a public HTTPS origin', () => {
      expect(probeUrlAllowed('https://provider.example:2053', false)?.hostname).toBe('provider.example');
    });

    it.each([
      'http://127.0.0.1:2052', 'http://10.0.0.1:2052', 'http://192.168.1.1:2052',
      'http://172.16.0.1:2052', 'http://169.254.169.254:80', 'http://localhost:2052',
      'http://[::1]:2052', 'http://0.0.0.0:2052',
    ])('blocks a private/loopback target even over HTTP-permitted mode: %s', value => {
      expect(probeUrlAllowed(value, true)).toBeNull();
    });

    it('blocks userinfo, query, fragment and path', () => {
      for (const value of [
        'https://u:p@provider.example', 'https://provider.example?q=1',
        'https://provider.example#f', 'https://provider.example/base',
      ]) expect(probeUrlAllowed(value, false)).toBeNull();
    });

    it('blocks non-http schemes', () => {
      for (const value of ['file:///etc/passwd', 'ftp://provider.example', 'gopher://x']) {
        expect(probeUrlAllowed(value, false)).toBeNull();
      }
    });

    it('refuses plaintext HTTP unless explicitly permitted', () => {
      expect(probeUrlAllowed('http://provider.example:2052', false)).toBeNull();
      expect(probeUrlAllowed('http://provider.example:2052', true)).not.toBeNull();
    });

    it('reports HTTP_DISABLED without making a request', async () => {
      const result = await service.probe({ ...target, baseUrl: 'http://provider.example:2052' }, false);
      expect(result).toMatchObject({ status: 'unhealthy', reason: 'HTTP_DISABLED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports INVALID_URL for a stored address that is no longer safe', async () => {
      const result = await service.probe({ ...target, baseUrl: 'http://127.0.0.1:2052' }, true);
      expect(result).toMatchObject({ status: 'unhealthy', reason: 'INVALID_URL' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it.each(['https://[fc00::1]', 'https://[::ffff:127.0.0.1]', 'https://[fe80::1]', 'https://100.64.0.1', 'https://224.0.0.1'])('blocks reserved addresses: %s', url => {
    expect(probeUrlAllowed(url, false)).toBeNull();
  });
  describe('probe request shape', () => {
    it('sends credentials in the body, never the URL, and refuses redirects', async () => {
      replies(200, JSON.stringify({ user_info: { auth: 1, status: 'Active' } }));
      await service.probe(target);
      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(String(url)).toBe('https://provider.example:2053/player_api.php');
      expect(String(url)).not.toContain('secret-value');
      expect(String(url)).not.toContain('operator');
      expect(init.method).toBe('POST');
      expect(String(init.body)).toContain('password=secret-value');
      expect(init.redirect).toBe('error');
      expect(init.cache).toBe('no-store');
      expect(init.signal).toBeDefined();
    });

    it('makes exactly ONE attempt — no retry loop against a dead origin', async () => {
      fetchMock.mockRejectedValue(new Error('timeout'));
      await service.probe(target);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('honest status reporting', () => {
    it('is healthy only for an authenticated response', async () => {
      replies(200, JSON.stringify({ user_info: { auth: 1 } }));
      const result = await service.probe(target);
      expect(result.status).toBe('healthy');
      expect(result.reason).toBe('OK');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.httpStatus).toBe(200);
    });

    it.each([0, '0', null, undefined])('never reports auth=%p as healthy', async auth => {
      replies(200, JSON.stringify({ user_info: { auth } }));
      const result = await service.probe(target);
      expect(result.status).toBe('unhealthy');
      expect(result.reason).toBe('AUTH_REJECTED');
    });

    it.each([401, 403])('reports %i as an auth rejection', async status => {
      replies(status, '{}');
      expect(await service.probe(target)).toMatchObject({ status: 'unhealthy', reason: 'AUTH_REJECTED' });
    });

    it.each([500, 502, 521])('reports %i as unreachable, not as bad credentials', async status => {
      replies(status, 'error');
      expect(await service.probe(target)).toMatchObject({ status: 'unhealthy', reason: 'ORIGIN_UNREACHABLE', httpStatus: status });
    });

    it('reports a timeout/DNS/TLS failure as ORIGIN_UNREACHABLE with no latency', async () => {
      fetchMock.mockRejectedValue(new Error('socket hang up'));
      const result = await service.probe(target);
      expect(result).toMatchObject({ status: 'unhealthy', reason: 'ORIGIN_UNREACHABLE', latencyMs: null, httpStatus: null });
    });

    it('does not treat a non-JSON body as healthy', async () => {
      replies(200, '<html>Cloudflare 521</html>');
      expect(await service.probe(target)).toMatchObject({ status: 'unhealthy', reason: 'UNEXPECTED_RESPONSE' });
    });

    it('does not treat a JSON body without user_info as healthy', async () => {
      replies(200, JSON.stringify({ something: 'else' }));
      expect(await service.probe(target)).toMatchObject({ status: 'unhealthy', reason: 'UNEXPECTED_RESPONSE' });
    });

    it('rejects an oversized response instead of parsing it', async () => {
      replies(200, 'x'.repeat(70 * 1024));
      expect(await service.probe(target)).toMatchObject({ status: 'unhealthy', reason: 'UNEXPECTED_RESPONSE' });
    });

    it('never includes credentials or the provider URL in the result', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED secret-value'));
      const result = await service.probe(target);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('secret-value');
      expect(serialized).not.toContain('operator');
      expect(serialized).not.toContain('provider.example');
    });

    it('never logs credentials or the provider URL', async () => {
      const log = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
      replies(200, JSON.stringify({ user_info: { auth: 1 } }));
      await service.probe(target);
      const logged = log.mock.calls.flat().join(' ');
      expect(logged).not.toContain('secret-value');
      expect(logged).not.toContain('provider.example');
    });
  });

  describe('recheck throttling', () => {
    it('probes a never-checked server', () => {
      expect(service.shouldRecheck(null)).toBe(true);
    });

    it('does not re-probe within the minimum interval', () => {
      const now = Date.now();
      expect(service.shouldRecheck(new Date(now - 1000), now)).toBe(false);
      expect(service.shouldRecheck(new Date(now - MIN_RECHECK_INTERVAL_MS), now)).toBe(true);
    });

    it('caps the sweep size and interval to sane values', () => {
      expect(MAX_SERVERS_PER_SWEEP).toBeLessThanOrEqual(10);
      expect(MIN_RECHECK_INTERVAL_MS).toBeGreaterThanOrEqual(60_000);
    });
  });

  it('normalizes an unknown stored status to unknown, never to healthy', () => {
    expect(service.normalize('bogus')).toBe('unknown');
    expect(service.normalize('healthy')).toBe('healthy');
  });
});
