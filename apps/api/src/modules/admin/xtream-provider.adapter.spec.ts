import transport = require('../../common/pinned-provider-request');
import { XtreamProviderAdapter } from './xtream-provider.adapter';

describe('Xtream metadata adapter contract (fixture transport)', () => {
  let call: jest.SpyInstance;
  const adapter = new XtreamProviderAdapter();
  const signal = new AbortController().signal;
  beforeEach(() => {
    call = jest.spyOn(transport, 'pinnedProviderRequest').mockImplementation(async (_url, init) => {
      const action = new URLSearchParams(String(init.body)).get('action') || '';
      const rows = action.includes('categories') ? [{ category_id: '1', category_name: 'Category' }] :
        action === 'get_series' ? [{ series_id: '1', name: 'Series' }] : [{ stream_id: '1', name: 'Live', category_id: '1' }];
      return new Response(JSON.stringify(rows), { status: 200 });
    });
  });
  afterEach(() => call.mockRestore());
  it('retrieves all six lists via bounded pinned POSTs without credentials in URLs', async () => {
    const result = await adapter.retrieve('https://provider.fixture/', 'fixture-user', 'fixture-secret', signal);
    expect(Object.keys(result)).toHaveLength(6); expect(call).toHaveBeenCalledTimes(6);
    expect(JSON.stringify(result)).not.toMatch(/fixture-user|fixture-secret/);
    for (const [url, init, , maxBytes] of call.mock.calls) {
      expect(url.href).toBe('https://provider.fixture/player_api.php');
      expect(init).toMatchObject({ method: 'POST', signal, redirect: 'error' });
      expect(maxBytes).toBe(2 * 1024 * 1024);
    }
  });
  it('never uses HTTP or URL userinfo for provider credentials', async () => {
    for (const url of ['http://provider.fixture/', 'https://user:secret@provider.fixture/']) {
      await expect(adapter.retrieve(url, 'u', 'p', signal)).rejects.toThrow();
    }
    expect(call).not.toHaveBeenCalled();
  });
  it('fails the entire export on partial or malformed data instead of deleting catalog', async () => {
    call.mockResolvedValueOnce(new Response('{"error":"partial"}'));
    await expect(adapter.retrieve('https://provider.fixture/', 'u', 'p', signal)).rejects.toThrow('PROVIDER_RESPONSE_INVALID');
  });
  it('distinguishes denied credentials without returning the provider body', async () => {
    call.mockResolvedValue(new Response('secret body', { status: 403 }));
    await expect(adapter.retrieve('https://provider.fixture/', 'u', 'p', signal)).rejects.toThrow('PROVIDER_AUTH_REJECTED');
  });
  it('redacts credentials echoed in metadata names', async () => {
    call.mockImplementation(async () => new Response(JSON.stringify([{ stream_id: '1', series_id: '1', category_id: '1', category_name: 'fixture-user fixture-secret', name: 'fixture-user fixture-secret' }])));
    const result = await adapter.retrieve('https://provider.fixture/', 'fixture-user', 'fixture-secret', signal);
    expect(JSON.stringify(result)).not.toMatch(/fixture-user|fixture-secret/);
  });
});
