import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { openToken, sealPath, TokenError, TOKEN_TTL_MS } from '../../../src/server/xtream-token';
import { PrivateError, providerOrigin, proxySecret } from '../../../src/server/xtream-private';

/**
 * GET /api/xtream/stream?t=<capability token>
 *
 * The only place that ever talks to the Xtream server with credentials. The
 * browser sees nothing but opaque tokens:
 *   - playlists are rewritten so every variant/segment/key URI is another token
 *   - binary media is piped through with Range support so seeking works
 *
 * SSRF is prevented by construction: tokens carry a provider-RELATIVE path and
 * the resolved origin must equal the configured provider origin. Redirects are
 * followed manually and only within that same origin.
 */
export const config = {
  api: { responseLimit: false, bodyParser: false },
  maxDuration: 60,
};

const PLAYLIST_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const UPSTREAM_TIMEOUT_MS = 25_000;
/** Off-origin references are replaced with this so credentials can never leak. */
const BLOCKED_REF = '/api/xtream/stream?t=off-origin';

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? '').trim();
}

function isPlaylistUrl(url: URL, contentType: string): boolean {
  return url.pathname.toLowerCase().endsWith('.m3u8') || /mpegurl/i.test(contentType);
}

/** Turn a playlist reference into a same-origin proxy URL, or a dead reference. */
function proxyRef(reference: string, base: URL, secret: string, ttl: number): string {
  try {
    const absolute = new URL(reference, base);
    if (absolute.origin !== base.origin) return BLOCKED_REF;
    const token = sealPath(absolute.pathname + absolute.search, secret, ttl);
    return `/api/xtream/stream?t=${encodeURIComponent(token)}`;
  } catch {
    return BLOCKED_REF;
  }
}

function rewritePlaylist(body: string, base: URL, secret: string, ttl: number): string {
  return body
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA carry their target in URI="...".
        return line.replace(/URI="([^"]*)"/g, (_match, uri: string) => `URI="${proxyRef(uri, base, secret, ttl)}"`);
      }
      return proxyRef(trimmed, base, secret, ttl);
    })
    .join('\n');
}

async function fetchUpstream(start: URL, origin: string, range?: string): Promise<{ response: Response; url: URL }> {
  let target = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: '*/*', 'User-Agent': 'CloudPlayPrivate/1.0' };
      if (range) headers.Range = range;
      response = await fetch(target, { signal: controller.signal, redirect: 'manual', cache: 'no-store', headers });
    } catch {
      clearTimeout(timer);
      throw new Error('UPSTREAM_UNREACHABLE');
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      clearTimeout(timer);
      if (!location) throw new Error('UPSTREAM_UNREACHABLE');
      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        throw new Error('UPSTREAM_UNREACHABLE');
      }
      // Never chase a redirect off the operator's own server.
      if (next.origin !== origin) throw new Error('UPSTREAM_OFF_ORIGIN');
      target = next;
      continue;
    }
    // The caller owns the body; clear the abort timer once headers are in.
    clearTimeout(timer);
    return { response, url: target };
  }
  throw new Error('UPSTREAM_UNREACHABLE');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let path: string;
  let expiresAt: number;
  let origin: string;
  let secret: string;
  try {
    origin = providerOrigin();
    secret = proxySecret();
    const opened = openToken(single(req.query.t), secret);
    path = opened.path;
    expiresAt = opened.expiresAt;
  } catch (error) {
    if (error instanceof TokenError) return res.status(403).json({ error: 'BAD_TOKEN' });
    const code = error instanceof PrivateError ? error.code : 'NOT_CONFIGURED';
    return res.status(503).json({ error: code });
  }

  let target: URL;
  try {
    target = new URL(path, origin);
  } catch {
    return res.status(403).json({ error: 'BAD_TOKEN' });
  }
  if (target.origin !== origin) return res.status(403).json({ error: 'BAD_TOKEN' });

  const range = single(req.headers.range as string | string[] | undefined);
  let result: { response: Response; url: URL };
  try {
    result = await fetchUpstream(target, origin, range || undefined);
  } catch {
    return res.status(502).json({ error: 'UPSTREAM_UNREACHABLE' });
  }

  const { response, url } = result;
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel().catch(() => {});
    return res.status(502).json({ error: 'UPSTREAM_BLOCKED' });
  }
  if (!response.ok && response.status !== 206) {
    await response.body?.cancel().catch(() => {});
    return res.status(502).json({ error: 'UPSTREAM_ERROR' });
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (isPlaylistUrl(url, contentType)) {
    let body: string;
    try {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > PLAYLIST_MAX_BYTES) return res.status(502).json({ error: 'UPSTREAM_ERROR' });
      body = Buffer.from(buffer).toString('utf8');
    } catch {
      return res.status(502).json({ error: 'UPSTREAM_ERROR' });
    }
    if (!body.includes('#EXTM3U')) {
      // Provider returned an error page instead of a playlist.
      return res.status(502).json({ error: 'UPSTREAM_ERROR' });
    }
    const ttl = Math.min(TOKEN_TTL_MS, Math.max(60_000, expiresAt - Date.now()));
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(rewritePlaylist(body, url, secret, ttl));
  }

  // Binary media (segments, posters, progressive video): stream it straight through.
  res.status(response.status);
  if (contentType) res.setHeader('Content-Type', contentType);
  for (const header of ['content-length', 'content-range', 'accept-ranges']) {
    const value = response.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  if (!response.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
  if (req.method === 'HEAD' || !response.body) {
    await response.body?.cancel().catch(() => {});
    return res.end();
  }

  const stream = Readable.fromWeb(response.body as unknown as NodeWebReadableStream);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
