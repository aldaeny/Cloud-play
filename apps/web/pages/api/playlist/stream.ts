import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { openStream, playlistSecret, sealStream, PLAYLIST_TOKEN_TTL_MS } from '../../../src/server/playlist-token';
import { parsePublicUrl, safeFetch, SafeFetchError } from '../../../src/server/safe-fetch';
import { enforceRateLimit } from '../../../src/server/rate-limit';

/**
 * GET /api/playlist/stream?t=<capability token>
 *
 * The media proxy for imported playlists. The browser only ever sees opaque
 * tokens; the real origin, path, credentials and forwarding headers live inside
 * AES-256-GCM ciphertext that only this server can open.
 *
 * SSRF: the origin is sealed (not client-choosable), re-validated on every open,
 * and redirects are pinned to that origin AND re-checked against the address
 * guard. Referer / User-Agent are forwarded here because the server may set
 * headers a browser is forbidden to set.
 */
export const config = {
  api: { responseLimit: false, bodyParser: false },
  maxDuration: 60,
};

const PLAYLIST_MAX_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 25_000;
/** Off-origin references become this, so a token can never leak to another host. */
const BLOCKED_REF = '/api/playlist/stream?t=off-origin';

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? '').trim();
}

function isPlaylist(url: URL, contentType: string): boolean {
  return /\.m3u8?$/i.test(url.pathname) || /mpegurl/i.test(contentType);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'stream' })) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let secret: string;
  try {
    secret = playlistSecret();
  } catch {
    return res.status(503).json({ error: 'NOT_CONFIGURED' });
  }

  let grant: ReturnType<typeof openStream>;
  try {
    grant = openStream(single(req.query.t), secret);
  } catch {
    // Malformed, tampered, expired or oversized — indistinguishable to the caller.
    return res.status(403).json({ error: 'BAD_TOKEN' });
  }

  let target: URL;
  try {
    target = parsePublicUrl(new URL(grant.path, grant.origin).toString());
  } catch {
    return res.status(403).json({ error: 'BAD_TOKEN' });
  }
  if (target.origin !== grant.origin) return res.status(403).json({ error: 'BAD_TOKEN' });

  const range = single(req.headers.range as string | string[] | undefined);
  const headers: Record<string, string> = {};
  if (range) headers.Range = range;
  if (grant.referrer) headers.Referer = grant.referrer;
  if (grant.userAgent) headers['User-Agent'] = grant.userAgent;

  let result: { response: Response; url: URL };
  try {
    result = await safeFetch(target.toString(), {
      headers,
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      maxRedirects: 3,
      pinOrigin: true,
    });
  } catch (error) {
    const code = error instanceof SafeFetchError ? error.code : 'UPSTREAM_UNREACHABLE';
    if (code === 'BLOCKED_ADDRESS' || code === 'BLOCKED_HOST' || code === 'BLOCKED_PORT') {
      return res.status(403).json({ error: 'BLOCKED_TARGET' });
    }
    return res.status(502).json({ error: 'UPSTREAM_UNREACHABLE' });
  }

  const { response, url } = result;
  const contentType = response.headers.get('content-type') ?? '';
  const ttl = Math.min(PLAYLIST_TOKEN_TTL_MS, Math.max(60_000, grant.expiresAt - Date.now()));

  /** Re-seal a playlist reference on the SAME origin, keeping forwarding headers. */
  const proxyRef = (reference: string): string => {
    try {
      const absolute = new URL(reference, url);
      if (absolute.origin !== url.origin) return BLOCKED_REF;
      const token = sealStream(
        {
          origin: absolute.origin,
          path: absolute.pathname + absolute.search,
          referrer: grant.referrer,
          userAgent: grant.userAgent,
        },
        secret,
        ttl,
      );
      return `/api/playlist/stream?t=${encodeURIComponent(token)}`;
    } catch {
      return BLOCKED_REF;
    }
  };

  if (isPlaylist(url, contentType)) {
    let body: string;
    try {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > PLAYLIST_MAX_BYTES) {
        return res.status(502).json({ error: 'UPSTREAM_ERROR' });
      }
      body = Buffer.from(buffer).toString('utf8');
    } catch {
      return res.status(502).json({ error: 'UPSTREAM_ERROR' });
    }
    if (!body.includes('#EXTM3U')) {
      return res.status(502).json({ error: 'UPSTREAM_ERROR' });
    }
    const rewritten = body
      .split(/\r?\n/)
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith('#')) {
          // EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA carry their target in URI="…".
          return line.replace(/URI="([^"]*)"/g, (_match, uri: string) => `URI="${proxyRef(uri)}"`);
        }
        return proxyRef(trimmed);
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(rewritten);
  }

  // Binary media: pipe straight through, preserving Range so seeking works.
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
