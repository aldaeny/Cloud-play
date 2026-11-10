import { ExternalServersService } from './external-servers.service';
import * as transport from '../../common/pinned-provider-request';
import { PrismaService } from '../../prisma.service';
import { XtreamServersService } from './xtream-servers.service';

// Explicit service/transport fixtures. Actual DB/RBAC/SSRF and browser are separate.
describe('external monitor fixture classification (HTTP200 is not playback)', () => {
  const serverId = '11111111-1111-4111-8111-111111111111';
  const row = { id: serverId, tenantId: serverId, protocol: 'hls', endpointEncrypted: 'ciphertext', licenseId: null, lastCheckedAt: null };
  const hls = '#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\nsegment.ts';
  let service: ExternalServersService;
  beforeEach(() => {
    const tx = { serverHealthCheck: { create: jest.fn(({ data }) => data) }, externalServer: { updateMany: jest.fn() }, serverAuditLog: { create: jest.fn() } };
    const db = { externalServer: { findFirst: jest.fn().mockResolvedValue(row), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $transaction: jest.fn(fn => fn(tx)) };
    service = new ExternalServersService(db as unknown as PrismaService, { decryptSecret: () => 'https://provider.example/test.m3u8?token=private' } as unknown as XtreamServersService);
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([401, 403, 404, 429, 500, 302])('classifies HTTP%s without following redirects or disclosing body', async status => {
    const spy = jest.spyOn(transport, 'pinnedProviderRequest').mockResolvedValue(new Response('secret provider error', { status }));
    const result = await service.check(serverId, serverId, serverId, { technicalAccessConfirmed: true });
    expect(result.result).toBe(status === 401 || status === 403 ? 'auth_required' : 'unreachable');
    expect((result.details as Record<string, unknown>).httpStatus).toBe(status); expect(JSON.stringify(result)).not.toContain('secret provider error');
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('never persists an attacker-controlled MIME header echoing credentials', async () => {
    jest.spyOn(transport, 'pinnedProviderRequest').mockResolvedValue(new Response('ignored', { headers: { 'content-type': 'private-token-reflection' } }));
    const result = await service.check(serverId, serverId, serverId, { technicalAccessConfirmed: true });
    expect(JSON.stringify(result)).not.toContain('private-token-reflection');
    expect((result.details as Record<string, unknown>).contentType).toBe('unknown');
  });
  it('does not call transport without a technical permission assertion', async () => {
    const spy = jest.spyOn(transport, 'pinnedProviderRequest');
    await expect(service.check(serverId, serverId, serverId, {})).rejects.toMatchObject({ status: 403 });
    expect(spy).not.toHaveBeenCalled();
  });
  it.each([['text/html', '<html>200</html>'], ['text/html', hls], ['application/vnd.apple.mpegurl', '#EXTM3U\n#EXTINF:1,\na.ts']])('rejects wrong MIME or generic M3U as playback proof', async (mime, body) => {
    jest.spyOn(transport, 'pinnedProviderRequest').mockResolvedValue(new Response(body, { headers: { 'content-type': mime } }));
    expect((await service.check(serverId, serverId, serverId, { technicalAccessConfirmed: true })).result).toBe('malformed_playlist');
  });
  it('valid HLS remains licensing_unverified and does not fetch a segment without separate permission', async () => {
    const spy = jest.spyOn(transport, 'pinnedProviderRequest').mockResolvedValue(new Response(hls, { headers: { 'content-type': 'application/vnd.apple.mpegurl' } }));
    const result = await service.check(serverId, serverId, serverId, { technicalAccessConfirmed: true });
    expect(result.result).toBe('reachable_and_hls_valid'); expect((result.details as Record<string, unknown>).licensingStatus).toBe('licensing_unverified');
    expect((result.details as Record<string, unknown>).segmentStatus).toBe('not_requested'); expect(spy).toHaveBeenCalledTimes(1);
  });
  it.each([200, 404])('separately records synthetic segment fetch%s without claiming decode', async status => {
    jest.spyOn(transport, 'pinnedProviderRequest').mockResolvedValueOnce(new Response(hls, { headers: { 'content-type': 'application/vnd.apple.mpegurl' } }))
      .mockResolvedValueOnce(new Response('synthetic fixture bytes', { status, headers: { 'content-type': 'video/mp2t' } }));
    const result = await service.check(serverId, serverId, serverId, { technicalAccessConfirmed: true, segmentAccessConfirmed: true });
    expect((result.details as Record<string, unknown>).segmentStatus).toBe(status === 200 ? 'fetched_mime_valid' : 'failed_or_invalid_mime');
  });
  it.each(['DNS_FAILURE', 'TIMEOUT', 'INVALID_TLS'])('does not invent successful network stages after%s', async code => {
    jest.spyOn(transport, 'pinnedProviderRequest').mockRejectedValue(new Error(code));
    const result = await service.check(serverId, serverId, serverId, { technicalAccessConfirmed: true });
    expect(result.result).toBe('unreachable'); expect((result.details as Record<string, unknown>).dns).toBe('not_verified');
    expect((result.details as Record<string, unknown>).reason).toBe('TRANSPORT_FAILED_OR_POLICY_DENIED');
  });
});
