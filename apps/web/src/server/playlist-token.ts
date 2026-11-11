import type {MediaBinding} from './private-media-session';
/**
 * Capability tokens for imported playlists.
 *
 * Unlike the Xtream proxy (one fixed provider origin, path-only tokens), an
 * imported playlist points at many arbitrary hosts. So the origin travels INSIDE
 * the authenticated ciphertext: the browser can neither read it nor choose it.
 * A token is minted only for an authenticated owner, expires, and is re-validated
 * against the SSRF guard every time it is opened.
 *
 * The key is domain-separated from the Xtream proxy key by a different prefix,
 * so a token minted for one proxy can never be replayed against the other even
 * though both may share the same configured secret.
 *
 * Referer and User-Agent are carried too. Browsers forbid setting those headers,
 * which is why such entries can never play on the public tier — but the server
 * CAN set them, so the private proxy can play lists the public one must skip.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'cloudplay-playlist-proxy:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const PLAYLIST_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_TOKEN_CHARS = 8192;

export type StreamGrant = {
  binding?: MediaBinding;
  role?: 'key';
  purpose?:'selection';
  /** Parent cap when re-sealing nested resources; never extend authorization. */
  expiresAt?: number;
  origin: string;
  path: string;
  referrer?: string;
  userAgent?: string;
};

export class PlaylistTokenError extends Error {
  constructor() {
    super('BAD_TOKEN');
  }
}

/**
 * Signing secret. Prefers a dedicated value, falls back to the Xtream proxy
 * secret so the feature works on a deployment that already has one configured.
 */
export function playlistSecret(): string {
  const secret = (process.env.PLAYLIST_PROXY_SECRET || process.env.XTREAM_PROXY_SECRET || '').trim();
  if (secret.length < 16) throw new PlaylistTokenError();
  return secret;
}

export function playlistProxyConfigured(): boolean {
  try {
    playlistSecret();
    return true;
  } catch {
    return false;
  }
}

function keyFor(secret: string): Buffer {
  return createHash('sha256').update(PREFIX + secret).digest();
}

function b64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Encrypt an absolute media target into an expiring, URL-safe token. */
export function sealStream(
  grant: StreamGrant,
  secret: string,
  ttlMs: number = PLAYLIST_TOKEN_TTL_MS,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      b: grant.binding,
      k: grant.role,
      s: grant.purpose,
      o: grant.origin,
      p: grant.path,
      r: grant.referrer ?? '',
      u: grant.userAgent ?? '',
      e: Math.min(Date.now() + ttlMs, grant.expiresAt ?? Infinity),
    }),
    'utf8',
  );
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  return b64url(Buffer.concat([iv, cipher.getAuthTag(), body]));
}

/** Open a token. Throws for malformed, tampered, expired or oversized input. */
export function openStream(
  token: string,
  secret: string,
): StreamGrant & { expiresAt: number } {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_CHARS) throw new PlaylistTokenError();
  let raw: Buffer;
  try {
    raw = fromB64url(token);
  } catch {
    throw new PlaylistTokenError();
  }
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new PlaylistTokenError();
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
    throw new PlaylistTokenError();
  }
  if (!parsed || typeof parsed !== 'object') throw new PlaylistTokenError();
  const record = parsed as { b?:MediaBinding; k?:'key';s?:'selection'; o?: unknown; p?: unknown; r?: unknown; u?: unknown; e?: unknown };
  if (typeof record.o !== 'string' || typeof record.p !== 'string' || typeof record.e !== 'number') {
    throw new PlaylistTokenError();
  }
  if (!Number.isFinite(record.e) || record.e < Date.now()) throw new PlaylistTokenError();

  const origin = record.o;
  const path = record.p;
  if (!/^https?:\/\/[^/\s]{1,253}$/.test(origin)) throw new PlaylistTokenError();
  // Path must stay on the sealed origin: no scheme-relative, no backslashes
  // (WHATWG normalises "/\host" to "//host"), no control characters.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.length > 4096) {
    throw new PlaylistTokenError();
  }
  if (/[\u0000-\u001f\u007f]/.test(path)) throw new PlaylistTokenError();

  const referrer = typeof record.r === 'string' ? record.r : '';
  const userAgent = typeof record.u === 'string' ? record.u : '';
  if (referrer.length > 2048 || userAgent.length > 512) throw new PlaylistTokenError();
  if (/[\u0000-\u001f\u007f]/.test(referrer + userAgent)) throw new PlaylistTokenError();

  return {
    binding: record.b,
    role:record.k,
    purpose:record.s,
    origin,
    path,
    referrer: referrer || undefined,
    userAgent: userAgent || undefined,
    expiresAt: record.e,
  };
}

/** Build the same-origin URL the browser is allowed to see. */
export function streamUrl(grant: StreamGrant, secret: string, ttlMs?: number): string {
  return `/api/playlist/stream?t=${encodeURIComponent(sealStream(grant, secret, ttlMs))}`;
}
