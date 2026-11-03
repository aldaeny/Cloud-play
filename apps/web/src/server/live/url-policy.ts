/**
 * Live TV URL policy.
 *
 * This module is the single place that decides "may this URL be handled?".
 * It is deliberately pure and synchronous so it can be unit-tested and so it
 * can be applied identically to playlist entries and to proxied manifests.
 *
 * Threat model (GATE D):
 *  - SSRF: attacker influences a URL that the server will fetch or rewrite.
 *  - DNS rebinding: URL host parses as public, resolves to a private address.
 *  - Credential leakage: tokens in query strings / userinfo reaching logs or HTML.
 *
 * Rules kept (never relaxed by the rights change):
 *  - https only (plain http is rejected for server-side handling)
 *  - no userinfo (user:pass@host)
 *  - host must be a DNS name, never an IP literal
 *  - host must not be localhost / .local / .internal / .home.arpa
 *  - optional operator allowlist and denylist
 *  - caller must not append credentials; we never forward cookies
 */
import { isIP } from 'node:net';

/** Hosts that must never be reachable from the server, by suffix. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.intranet', '.home.arpa', '.lan', '.corp', '.private'];
/** Exact hostnames that must never be reachable from the server. */
const BLOCKED_HOSTS = new Set(['localhost', 'ip6-localhost', 'ip6-loopback', 'metadata', 'metadata.google.internal', 'instance-data']);
/** HLS manifest: an .m3u8/.m3u path, or an extensionless path such as /playlist or /live. */
const MANIFEST_RE = /\.m3u8?$|\/[^/.]+$/i;
const SEGMENT_RE = /\.(m4s|ts|aac|mp4|m4a|m4v|cmfv|cmfa|vtt|webvtt)$/i;
const KEY_RE = /\.(key|bin)$/i;
const MAX_URL_LENGTH = 2048;

export type UrlVerdict =
  | { ok: true; url: URL }
  | { ok: false; code: UrlRejection; detail: string };

export type UrlRejection =
  | 'TOO_LONG'
  | 'MALFORMED'
  | 'INSECURE_SCHEME'
  | 'HAS_CREDENTIALS'
  | 'IP_LITERAL'
  | 'BLOCKED_HOST'
  | 'BLOCKED_ALLOWLIST'
  | 'BLOCKED_DENYLIST'
  | 'UNSUPPORTED_PATH';

/** Reject anything that is not a plain public https DNS name. */
export function checkHost(url: URL): UrlRejection | null {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:') return 'INSECURE_SCHEME';
  if (url.username || url.password) return 'HAS_CREDENTIALS';
  if (!host) return 'MALFORMED';
  // IPv4, IPv6 and IPv4-mapped forms.
  if (isIP(host) !== 0) return 'IP_LITERAL';
  if (host.startsWith('[') || host.includes(':')) return 'IP_LITERAL';
  if (BLOCKED_HOSTS.has(host)) return 'BLOCKED_HOST';
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return 'BLOCKED_HOST';
  // A public host must be a dotted name with at least one dot.
  if (!host.includes('.') || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return 'MALFORMED';
  // The WHATWG parser already converts numeric-last-label hosts to IPv4 (or throws).
  // Keep the check as defence in depth for hosts supplied by non-parser code paths.
  if (/^\d+$/.test(host.split('.').pop() || '')) return 'IP_LITERAL';
  const allowed = parseHostList(process.env.CLOUDPLAY_LIVE_HOST_ALLOWLIST);
  if (allowed.length && !allowed.some((entry) => host === entry || host.endsWith(`.${entry}`))) return 'BLOCKED_ALLOWLIST';
  const denied = parseHostList(process.env.CLOUDPLAY_LIVE_HOST_DENYLIST);
  if (denied.some((entry) => host === entry || host.endsWith(`.${entry}`))) return 'BLOCKED_DENYLIST';
  return null;
}

function parseHostList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/^\*?\.?/, ''))
    .filter((part) => part.length > 0 && part.length < 254);
}

/** Validate a URL that the server is willing to parse as a manifest. */
export function checkManifestUrl(raw: string): UrlVerdict {
  return checkUrl(raw, MANIFEST_RE, 'UNSUPPORTED_PATH');
}

/** Validate a child URL referenced from a manifest. */
export function checkChildUrl(raw: string): UrlVerdict {
  return checkUrl(raw, /\.(m4s|ts|aac|mp4|m4a|m4v|cmfv|cmfa|vtt|webvtt|key|bin)$/i, null);
}

function checkUrl(raw: string, extent: RegExp | null, pathCode: UrlRejection | null): UrlVerdict {
  if (!raw || raw.length > MAX_URL_LENGTH) return { ok: false, code: 'TOO_LONG', detail: 'url longer than 2048 characters' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, code: 'MALFORMED', detail: 'url is not absolute' };
  }
  const hostProblem = checkHost(url);
  if (hostProblem) return { ok: false, code: hostProblem, detail: `host rejected: ${hostProblem}` };
  if (extent && !extent.test(url.pathname)) {
    if (pathCode) return { ok: false, code: pathCode, detail: 'path is not an HLS manifest' };
  }
  return { ok: true, url };
}

function isSegmentish(pathname: string): boolean {
  return SEGMENT_RE.test(pathname) || KEY_RE.test(pathname);
}

/**
 * A stream URL is *playable* when the server can serve it through the HLS proxy.
 * Requirements: valid public https host, and the URL resolves to an HLS manifest.
 * Query strings are allowed here (many providers sign manifests) but are
 * stripped from anything the client can see (see `publicize`).
 */
export function classifyStreamUrl(raw: string): { playable: boolean; reason?: UrlRejection } {
  const verdict = checkManifestUrl(raw);
  if (!verdict.ok) return { playable: false, reason: verdict.code };
  return { playable: true };
}

/**
 * Produce the client-safe form of a stream URL: origin + path only.
 * Query strings and fragments are dropped so signed tokens never reach the DOM,
 * the clipboard, or analytics.
 */
export function stripSecrets(raw: string): string {
  try {
    const url = new URL(raw);
    url.search = '';
    url.hash = '';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return '';
  }
}

/** True when the URL carries something that must not be published. */
export function hasSecretMaterial(raw: string): boolean {
  try {
    const url = new URL(raw);
    return Boolean(url.search || url.hash || url.username || url.password);
  } catch {
    return true;
  }
}

/**
 * Encode a provider URL into an opaque proxy path segment.
 * The client never learns the provider host, which also prevents hotlinking
 * of signed URLs and keeps provider origins out of the page HTML.
 *
 * This is encoding, not encryption: the proxy re-validates the decoded URL on
 * every request, so a forged token cannot escape `checkHost`.
 */
export function encodeStreamTarget(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function decodeStreamTarget(token: string): string {
  if (!token || token.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('INVALID_TOKEN');
  return Buffer.from(token, 'base64url').toString('utf8');
}

export const URL_POLICY_CAPS = { MAX_URL_LENGTH, isSegmentish, MANIFEST_RE, SEGMENT_RE, KEY_RE } as const;
