/**
 * Upstream fetch for proxied HLS resources.
 *
 * Differences from `fetch-feed.ts`, and why they matter:
 *  - segments can be large, so the cap is 24 MiB and the body is size-checked
 *    while streaming;
 *  - redirects are resolved manually with per-hop validation, so a CDN cannot
 *    bounce the server into an internal address;
 *  - client cookies and credentials are never forwarded upstream;
 *  - only the two request classes the player needs are supported: a manifest and
 *    a media/child resource.
 */
import { checkChildUrl, checkManifestUrl } from './url-policy';

export const SEGMENT_MAX_BYTES = 24 * 1024 * 1024;
export const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;
const MANIFEST_TIMEOUT_MS = 12_000;
const SEGMENT_TIMEOUT_MS = 20_000;
const MAX_HOPS = 3;

export type UpstreamResult =
  | { kind: 'manifest'; body: string; finalUrl: string; contentType: string }
  | { kind: 'binary'; body: Uint8Array; finalUrl: string; contentType: string }
  | { kind: 'error'; code: string; status: number };

/** Sniff a playlist without trusting the URL extension or the content type. */
export function looksLikeManifest(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 64)).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  return head.startsWith('#EXTM3U');
}

export function isManifestPath(url: string): boolean {
  try {
    return /\.m3u8?$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function forbidStatus(code: string): number {
  return code.startsWith('URL_REJECTED') || code.startsWith('CHILD_URI_REJECTED') ? 403 : 502;
}

async function readCapped(response: Response, cap: number): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; code: string }> {
  if (!response.body) return { ok: false, code: 'EMPTY_BODY' };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return { ok: false, code: 'RESOURCE_TOO_LARGE' };
    }
    chunks.push(part.value);
  }
  return { ok: true, bytes: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))) };
}

/** Fetch `startUrl`, re-validating every redirect hop against the URL policy. */
export async function fetchUpstream(
  startUrl: string,
  kind: 'manifest' | 'child',
  signal?: AbortSignal,
): Promise<UpstreamResult> {
  const wantsManifest = kind === 'manifest';
  const cap = wantsManifest ? MANIFEST_MAX_BYTES : SEGMENT_MAX_BYTES;
  let current = startUrl;

  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const verdict = wantsManifest ? checkManifestUrl(current) : checkChildUrl(current);
    if (!verdict.ok) {
      const code = `URL_REJECTED_${verdict.code}`;
      return { kind: 'error', code, status: forbidStatus(code) };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), wantsManifest ? MANIFEST_TIMEOUT_MS : SEGMENT_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: wantsManifest ? 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' : '*/*',
          'Accept-Language': 'ar,en;q=0.8',
          'User-Agent': 'CloudPlay-Iraq/live-proxy',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) return { kind: 'error', code: 'REDIRECT_WITHOUT_LOCATION', status: 502 };
        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        return { kind: 'error', code: `UPSTREAM_HTTP_${response.status}`, status: response.status === 404 ? 404 : 502 };
      }

      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > cap) {
        await response.body?.cancel();
        return { kind: 'error', code: 'RESOURCE_TOO_LARGE', status: 502 };
      }

      const read = await readCapped(response, cap);
      if (!read.ok) return { kind: 'error', code: read.code, status: 502 };

      const contentType = response.headers.get('content-type') ?? '';
      const text = Buffer.from(read.bytes).toString('utf8');

      // The body decides. A variant requested as a "child" can be a playlist,
      // and a manifest URL can legitimately return media on some CDNs.
      if (looksLikeManifest(read.bytes)) return { kind: 'manifest', body: text, finalUrl: current, contentType };
      if (!wantsManifest) return { kind: 'binary', body: read.bytes, finalUrl: current, contentType };
      return { kind: 'error', code: 'NOT_A_MANIFEST', status: 502 };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      return { kind: 'error', code: name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK', status: 504 };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return { kind: 'error', code: 'TOO_MANY_REDIRECTS', status: 502 };
}
