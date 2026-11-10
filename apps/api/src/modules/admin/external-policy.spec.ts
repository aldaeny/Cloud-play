import { LICENSE_STATUSES, mayRedistribute, parseHls, RightsScope } from './external-policy';

describe('external content rights are independent of technical reachability', () => {
  const valid: RightsScope = { status: 'verified_authorized', provider: 'Fixture', startDate: new Date(0), expiryDate: new Date('2099-01-01'), redistributionPermission: true, commercialUse: true, allowedPlatforms: ['web'], allowedCountries: ['IQ'], reviewedBy: 'reviewer', reviewDate: new Date() };
  it('requires reviewed, current, exact provider/territory/platform rights', () => {
    expect(mayRedistribute(valid, 'Fixture', 'web', 'IQ')).toBe(true);
    for (const status of LICENSE_STATUSES.filter(s => s !== 'verified_authorized')) expect(mayRedistribute({ ...valid, status }, 'Fixture', 'web', 'IQ')).toBe(false);
    for (const patch of [{ redistributionPermission: false }, { commercialUse: false }, { reviewedBy: null }, { reviewDate: null }, { expiryDate: new Date(0) }, { startDate: new Date('2099-01-01') }]) expect(mayRedistribute({ ...valid, ...patch }, 'Fixture', 'web', 'IQ')).toBe(false);
    expect(mayRedistribute(valid, 'Other', 'web', 'IQ')).toBe(false);
    expect(mayRedistribute(valid, 'Fixture', 'tv', 'IQ')).toBe(false);
    expect(mayRedistribute(valid, 'Fixture', 'web', 'US')).toBe(false);
    expect(mayRedistribute(null, 'Fixture', 'web', 'IQ')).toBe(false);
  });
});
describe('bounded HLS inspection; never implies decoded playback', () => {
  const base = new URL('https://provider.example/live/index.m3u8');
  it('recognizes a local segment without fetching', () => {
    const result = parseHls('#EXTM3U\n#EXTINF:1,\nsegment.ts', base);
    expect(result.result).toBe('reachable_and_hls_valid'); expect(result.reference?.href).toBe('https://provider.example/live/segment.ts'); expect(result.kind).toBe('segment');
  });
  it('separates master variant from segment', () => expect(parseHls('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\na.m3u8', base).kind).toBe('variant'));
  it.each(['', '<html>200</html>', '#EXTM3U', '#EXTM3U\na.ts', '#EXTM3U\n#EXTINF:1,\nhttp://127.0.0.1/private', '#EXTM3U\n#EXTINF:1,\nhttps://other.example/a.ts'])('rejects malformed or unapproved references %s', value => expect(parseHls(value, base).result).toBe('malformed_playlist'));
  it.each(['AES-128', 'SAMPLE-AES', 'SAMPLE-AES-CTR'])('reports protected %s without fetching keys', method => expect(parseHls(`#EXTM3U\n#EXT-X-KEY:METHOD=${method},URI="key"\n#EXTINF:1,\na.ts`, base).result).toBe('drm_protected'));
});
