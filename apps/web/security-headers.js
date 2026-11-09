/**
 * Security response headers.
 *
 * Kept in its own module so the policy is reviewable and unit-testable rather
 * than buried in next.config.js.
 *
 * CSP notes — every allowance below exists because the app genuinely needs it:
 *   • script-src 'unsafe-inline'  — Next.js emits inline bootstrap/hydration
 *     scripts. Removing this without a nonce pipeline breaks hydration, so it
 *     stays until nonces are wired through the document.
 *   • script-src www.gstatic.com  — the player's Chromecast sender loads
 *     Google's Cast SDK from this exact origin (see player/castWeb.ts). Without
 *     it the existing cast button silently stops working.
 *   • style-src 'unsafe-inline'   — React `style={{…}}` props and the appearance
 *     layer set CSS custom properties at runtime.
 *   • img-src https: data: blob:  — channel logos and film posters come from
 *     arbitrary broadcaster CDNs; MSE poster frames use blob:.
 *   • media-src https: blob:      — HLS/DASH segments plus MediaSource blobs.
 *   • connect-src https:          — Supabase auth/sync, the same-origin API
 *     routes, and hls.js/dash.js segment + manifest fetches.
 *
 * `frame-ancestors 'self'` is the modern replacement for X-Frame-Options and is
 * relaxed outside production so Arena previews can still iframe the app.
 */

/** @param {boolean} isProduction */
function contentSecurityPolicy(isProduction) {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: blob:",
    "connect-src 'self' https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    isProduction ? "frame-ancestors 'self'" : 'frame-ancestors *',
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

/** @param {boolean} isProduction */
function securityHeaders(isProduction) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(isProduction) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    // Camera/mic/geolocation are never used; keep them denied. PiP and
    // fullscreen are required by the player.
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self), picture-in-picture=(self)' },
    ...(isProduction
      ? [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ]
      : []),
  ];
}

module.exports = { securityHeaders, contentSecurityPolicy };
