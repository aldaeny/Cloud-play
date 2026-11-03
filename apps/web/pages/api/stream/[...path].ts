/**
 * GET|HEAD /api/stream/<token>[/<rest>]
 *
 * Same-origin HLS proxy.
 *
 * Why it exists:
 *  - many public IPTV providers send no `Access-Control-Allow-Origin`, so
 *    hls.js cannot read their manifests from a browser;
 *  - routing playback through our origin removes provider hosts and signed
 *    tokens from the page;
 *  - it is the one place where every upstream URL is re-validated, so the
 *    Live section can never be pointed at a private address.
 *
 * What it deliberately does NOT do:
 *  - it is not an open proxy: only base64url tokens we minted are accepted, the
 *    decoded URL must pass the URL policy, and manifest children are re-encoded
 *    as new tokens;
 *  - it never forwards cookies or client credentials upstream;
 *  - it never serves a partial manifest when one child URI is unsafe.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { decodeStreamTarget, stripSecrets } from '../../../src/server/live/url-policy';
import { fetchUpstream, isManifestPath } from '../../../src/server/live/upstream';
import { rewriteManifest } from '../../../src/server/live/hls-rewrite';

/** Segments are cacheable; manifests must never be. */
const SEGMENT_CACHE = 'public, max-age=6, immutable';
const MANIFEST_CACHE = 'private, no-store';

function contentTypeFor(kind: 'manifest' | 'child', upstream: string, target: string): string {
  if (kind === 'manifest') return 'application/vnd.apple.mpegurl';
  const declared = upstream.split(';')[0].trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') return declared;
  const path = (() => {
    try {
      return new URL(target).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (path.endsWith('.ts')) return 'video/mp2t';
  if (path.endsWith('.m4s') || path.endsWith('.mp4') || path.endsWith('.m4v')) return 'video/mp4';
  if (path.endsWith('.m4a') || path.endsWith('.aac')) return 'audio/mp4';
  if (path.endsWith('.vtt') || path.endsWith('.webvtt')) return 'text/vtt';
  if (path.endsWith('.key') || path.endsWith('.bin')) return 'application/octet-stream';
  return 'application/octet-stream';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const parts = req.query.path;
  const token = Array.isArray(parts) ? parts[0] : parts;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'MISSING_TARGET' });

  let target: string;
  try {
    target = decodeStreamTarget(token);
  } catch {
    return res.status(400).json({ error: 'INVALID_TARGET' });
  }

  const kind: 'manifest' | 'child' = isManifestPath(target) ? 'manifest' : 'child';

  // The proxy is a CDN edge asset: allow an explicit range so a player can seek
  // inside a byte-range-addressable init section.
  const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;

  const upstream = await fetchUpstream(target, kind);
  if (upstream.kind === 'error') {
    // Never echo the upstream URL: it may carry a signed token.
    res.setHeader('Cache-Control', MANIFEST_CACHE);
    return res.status(upstream.status).json({ error: upstream.code });
  }

  if (upstream.kind === 'manifest') {
    const rewritten = rewriteManifest(upstream.body, upstream.finalUrl);
    if (!rewritten.ok) {
      res.setHeader('Cache-Control', MANIFEST_CACHE);
      return res.status(502).json({ error: rewritten.code });
    }
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Cache-Control', MANIFEST_CACHE);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(rewritten.body);
  }

  // Binary media.
  const body = Buffer.from(upstream.body);
  res.setHeader('Content-Type', contentTypeFor('child', upstream.contentType, target));
  res.setHeader('Content-Length', String(body.byteLength));
  res.setHeader('Cache-Control', SEGMENT_CACHE);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');
  // A partial range request is answered in full: providers that ignore Range are
  // the common case, and serving the whole segment is still correct for HLS.
  if (range) res.setHeader('Content-Range', `bytes 0-${body.byteLength - 1}/${body.byteLength}`);
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(range ? 206 : 200).send(body);
}

/** Keep the operator-visible error free of any provider detail. */
export function safeTargetForLogs(target: string): string {
  return stripSecrets(target);
}
