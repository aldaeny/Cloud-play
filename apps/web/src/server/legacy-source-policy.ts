/**
 * Legacy source policy.
 *
 * HISTORY: this module used to hardcode `return false` so every public playlist
 * route answered 503 SOURCE_NOT_APPROVED. That rights gate is removed: public
 * playlists are imported and published without an identity check, an
 * administrative approval or a licensing confirmation.
 *
 * What is NOT removed, and must not be removed here:
 *  - authentication/authorisation on admin and account routes;
 *  - the URL policy in `src/server/live/url-policy.ts` (https only, no IP
 *    literals, no localhost, no credentials);
 *  - access controls enforced by the upstream provider (geo-blocking, tokens,
 *    signed URLs, DRM).
 *
 * The function is kept because existing routes import it; it no longer blocks
 * anything by itself.
 */
export function legacySourcesAllowed() {
  return true;
}

/**
 * Sources that were removed from the UI rather than rights-gated. Kept as a
 * named list so a future cleanup can delete the routes that used them.
 */
export const RETIRED_PUBLIC_ENDPOINTS = [
  '/api/iptv/iraq',
  '/api/iptv/arab',
  '/api/iptv/world',
  '/api/iptv/firebase',
] as const;
