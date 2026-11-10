export const LICENSE_STATUSES = ['verified_authorized', 'provider_authorized', 'public_access_only', 'permission_pending', 'licensing_unverified', 'restricted', 'expired', 'revoked'] as const;
export type RightsScope = { status: string; provider: string; startDate: Date; expiryDate: Date; redistributionPermission: boolean; commercialUse: boolean; allowedPlatforms: string[]; allowedCountries: string[]; reviewedBy: string | null; reviewDate: Date | null };
/** Public accessibility, an uploaded contract and a good health check are NOT rights. */
export function mayRedistribute(license: RightsScope | null, provider: string, platform: string, country: string, now = new Date()): boolean {
  return !!license && license.status === 'verified_authorized' && !!license.reviewedBy && !!license.reviewDate &&
    license.provider === provider && license.startDate <= now && license.expiryDate > now &&
    license.redistributionPermission && license.commercialUse && license.allowedPlatforms.includes(platform) &&
    license.allowedCountries.includes(country);
}
export function parseHls(text: string, base: URL): { result: string; reference?: URL; kind?: string } {
  if (!text.trimStart().startsWith('#EXTM3U') || text.length > 1024 * 1024) return { result: 'malformed_playlist' };
  if (/#EXT-X-(SESSION-)?KEY:[^\n]*METHOD=(?!NONE)/.test(text)) return { result: 'drm_protected' };
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const refs = lines.filter(line => !line.startsWith('#'));
  if (!refs.length || refs.length > 10000) return { result: 'malformed_playlist' };
  const urls: URL[] = [];
  try {
    for (const ref of refs) {
      const url = new URL(ref, base);
      // Cross-origin segments need an explicit allowlist, not implicit provider trust.
      if (!['https:', 'http:'].includes(url.protocol) || url.origin !== base.origin || url.username || url.password || url.hash) return { result: 'malformed_playlist' };
      urls.push(url);
    }
  } catch { return { result: 'malformed_playlist' }; }
  const master = lines.some(line => line.startsWith('#EXT-X-STREAM-INF:'));
  if (!master && (!lines.some(line => line.startsWith('#EXTINF:')) || !lines.some(line => /^#EXT-X-TARGETDURATION:[1-9][0-9]*$/.test(line)))) return { result: 'malformed_playlist' };
  return { result: 'reachable_and_hls_valid', reference: urls[0], kind: master ? 'variant' : 'segment' };
}
