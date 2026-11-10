import { SupabaseAuthService, SupabaseAuthError, supabaseAuthStatus } from './supabase-auth.service';

const USER_ID = 'DCF31E85-DD5B-4972-91AA-B11BA343508C';
const TOKEN = 'aaa.bbb.ccc';

function env(values: Record<string, string | undefined>) {
  const keys = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

const configured = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' };

describe('SupabaseAuthService', () => {
  const realFetch = global.fetch;
  let service: SupabaseAuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new SupabaseAuthService();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    env(configured);
  });

  afterEach(() => {
    global.fetch = realFetch;
    env({});
    jest.restoreAllMocks();
  });

  function repliesWith(status: number, body: unknown) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
  }

  describe('configuration', () => {
    it('fails closed when Supabase is not configured, and never calls the network', async () => {
      env({});
      expect(service.isConfigured()).toBe(false);
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_NOT_CONFIGURED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts the existing NEXT_PUBLIC_* names so no env rename is required', () => {
      env({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' });
      expect(service.isConfigured()).toBe(true);
    });

    it.each([
      'http://example.supabase.co',
      'https://user:pass@example.supabase.co',
      'https://example.supabase.co/path',
      'https://example.supabase.co?q=1',
      'not-a-url',
    ])('refuses an unsafe project URL (%s)', async value => {
      env({ ...configured, SUPABASE_URL: value });
      expect(service.isConfigured()).toBe(false);
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_NOT_CONFIGURED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('tolerates a trailing slash on the project URL', () => {
      env({ ...configured, SUPABASE_URL: 'https://example.supabase.co/' });
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('bearer extraction', () => {
    it('extracts a well-formed bearer token case-insensitively', () => {
      expect(SupabaseAuthService.bearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
      expect(SupabaseAuthService.bearer(`bearer   ${TOKEN}  `)).toBe(TOKEN);
      expect(SupabaseAuthService.bearer([`Bearer ${TOKEN}`])).toBe(TOKEN);
    });

    const malformed: Array<[string, string | undefined]> = [
      ['absent', undefined],
      ['empty', ''],
      ['wrong scheme', 'Basic abc'],
      ['scheme only', 'Bearer'],
      ['no token', 'Bearer '],
      ['not a JWT', 'Bearer a.b'],
      ['oversized', `Bearer ${'x'.repeat(5000)}`],
    ];
    it.each(malformed)('rejects a malformed header: %s', (_label, value) => {
      expect(SupabaseAuthService.bearer(value)).toBeNull();
    });
  });

  describe('verification', () => {
    it('sends the token to Supabase and returns the verified identity', async () => {
      repliesWith(200, { id: USER_ID, email: 'Owner@Example.com', email_confirmed_at: '2026-11-04T00:00:00Z' });
      const identity = await service.verifyAccessToken(TOKEN);

      expect(identity).toEqual({ id: USER_ID.toLowerCase(), email: 'owner@example.com', emailConfirmed: true });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://example.supabase.co/auth/v1/user');
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
      expect((init.headers as Record<string, string>).apikey).toBe('anon-key');
      // A redirect would forward the bearer token to another origin.
      expect(init.redirect).toBe('error');
      expect(init.cache).toBe('no-store');
      expect(init.signal).toBeDefined();
    });

    it('reports an unconfirmed email as unconfirmed', async () => {
      repliesWith(200, { id: USER_ID, email: 'a@b.co' });
      expect((await service.verifyAccessToken(TOKEN)).emailConfirmed).toBe(false);
    });

    it('handles an account with no email', async () => {
      repliesWith(200, { id: USER_ID });
      expect(await service.verifyAccessToken(TOKEN)).toEqual({ id: USER_ID.toLowerCase(), email: null, emailConfirmed: false });
    });

    it.each([401, 403])('treats %i as an invalid token', async status => {
      repliesWith(status, { message: 'invalid claim' });
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    });

    it.each([500, 502, 503])('treats %i as auth unavailable, not as a signed-out user', async status => {
      repliesWith(status, {});
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    });

    it('fails closed on a network error or timeout', async () => {
      fetchMock.mockRejectedValue(new Error('socket hang up'));
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    });

    it('fails closed when the response is not JSON', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } } as unknown as Response);
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    });

    it.each([null, {}, { id: 'not-a-uuid' }, { id: 123 }, { email: 'a@b.co' }])(
      'fails closed on a payload without a valid user id (%p)',
      async body => {
        repliesWith(200, body);
        await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
      },
    );

    it('rejects a malformed token before spending a network call', async () => {
      await expect(service.verifyAccessToken('garbage')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('never logs the token or the user identity', async () => {
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
      repliesWith(500, { error: 'boom', token: TOKEN });
      await expect(service.verifyAccessToken(TOKEN)).rejects.toBeInstanceOf(SupabaseAuthError);
      const logged = warn.mock.calls.flat().join(' ');
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(USER_ID.toLowerCase());
      expect(logged).toContain('500');
    });

    it('does not cache auth decisions, so revocation takes effect immediately', async () => {
      repliesWith(200, { id: USER_ID });
      await service.verifyAccessToken(TOKEN);
      repliesWith(401, {});
      await expect(service.verifyAccessToken(TOKEN)).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('status mapping', () => {
    it('maps missing/invalid tokens to 401 and configuration/upstream problems to 503', () => {
      expect(supabaseAuthStatus('TOKEN_MISSING')).toBe(401);
      expect(supabaseAuthStatus('TOKEN_INVALID')).toBe(401);
      expect(supabaseAuthStatus('AUTH_NOT_CONFIGURED')).toBe(503);
      expect(supabaseAuthStatus('AUTH_UNAVAILABLE')).toBe(503);
    });
  });
});
