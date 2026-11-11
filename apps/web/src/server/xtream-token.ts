/**
 * Capability tokens for the private Xtream player.
 *
 * Xtream playback URLs embed the account username and password in the path
 * (`/live/<user>/<pass>/<id>.m3u8`). Those URLs must NEVER reach the browser.
 * Instead we hand the browser an opaque, encrypted, expiring token that only
 * this server can open.
 *
 * The token stores a path RELATIVE to the configured provider origin, so the
 * proxy can only ever talk to the operator's own server (no SSRF by
 * construction), and the credentials stay inside the ciphertext.
 *
 * A token is a bearer capability: it is only ever minted for an authenticated
 * owner, and it expires. That lets a plain <video> tag and hls.js fetch
 * segments without an Authorization header, while anonymous visitors can
 * neither mint nor guess one.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'cloudplay-xtream-proxy:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Playback sessions stay valid long enough to watch a film, then die. */
export const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_TOKEN_CHARS = 4096;

function keyFor(secret: string): Buffer {
  return createHash('sha256').update(PREFIX + secret).digest();
}

function b64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Encrypt a provider-relative path into an expiring, URL-safe token. */
export function sealPath(path: string, secret: string, ttlMs: number = TOKEN_TTL_MS, maxExpiresAt: number = Infinity): string {
  const payload = Buffer.from(JSON.stringify({ p: path, e: Math.min(Date.now() + ttlMs,maxExpiresAt) }), 'utf8');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  return b64url(Buffer.concat([iv, cipher.getAuthTag(), body]));
}

export class TokenError extends Error {
  constructor() {
    super('BAD_TOKEN');
  }
}

/**
 * Open a token and return the provider-relative path.
 * Throws TokenError for malformed, tampered, expired or oversized tokens.
 */
export function openToken(token: string, secret: string): { path: string; expiresAt: number } {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_CHARS) throw new TokenError();
  let raw: Buffer;
  try {
    raw = fromB64url(token);
  } catch {
    throw new TokenError();
  }
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new TokenError();
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  let parsed: unknown;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    parsed = JSON.parse(plain);
  } catch {
    // Authentication tag mismatch, bad padding, or invalid JSON — all the same to the caller.
    throw new TokenError();
  }
  if (!parsed || typeof parsed !== 'object') throw new TokenError();
  const record = parsed as { p?: unknown; e?: unknown };
  if (typeof record.p !== 'string' || typeof record.e !== 'number') throw new TokenError();
  if (!Number.isFinite(record.e) || record.e < Date.now()) throw new TokenError();
  const path = record.p;
  // Must be an absolute path on the provider, never a scheme-relative or absolute URL.
  // Backslashes matter: WHATWG URL normalises "/\host" to "//host", which would
  // resolve off-origin, so they are rejected outright.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.length > 2048) throw new TokenError();
  if (/[\u0000-\u001f\u007f]/.test(path)) throw new TokenError();
  return { path, expiresAt: record.e };
}

/** Convenience wrapper for callers that only need the path. */
export function openPath(token: string, secret: string): string {
  return openToken(token, secret).path;
}

/** Constant-time helper used by the owner allow-list comparison. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
