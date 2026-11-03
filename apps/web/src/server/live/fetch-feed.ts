/**
 * Feed fetcher.
 *
 * Restrictions, all enforced here rather than at call sites:
 *  - the URL must be a fixed registry URL passed in by the importer (checked
 *    again against the URL policy so a misconfigured env var cannot point at
 *    the metadata service);
 *  - redirects are followed manually, at most FEED_MAX_REDIRECTS, and every hop
 *    is re-validated, because `redirect: 'follow'` would happily land on an
 *    internal address;
 *  - the body is size-capped while streaming, so a hostile server cannot
 *    exhaust memory before the cap is applied;
 *  - the timeout aborts the socket, not just the promise.
 */
import { checkManifestUrl } from './url-policy';
import { FEED_MAX_BYTES, FEED_MAX_REDIRECTS, FEED_TIMEOUT_MS } from './sources';

export type FetchOutcome =
  | { ok: true; text: string; bytes: number; ms: number; finalUrl: string }
  | { ok: false; error: string; ms: number };

/** Accept the feed content types we know providers use, plus octet-stream. */
const ACCEPT = 'audio/x-mpegurl, application/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*';

export async function fetchFeed(url: string, signal?: AbortSignal): Promise<FetchOutcome> {
  const started = Date.now();
  let current = url;
  try {
    for (let hop = 0; hop <= FEED_MAX_REDIRECTS; hop += 1) {
      // Re-validate every hop: a redirect to 169.254.169.254 must die here.
      const verdict = checkManifestUrl(current);
      if (!verdict.ok) return { ok: false, error: `URL_REJECTED_${verdict.code}`, ms: Date.now() - started };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const response = await fetch(current, {
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: ACCEPT, 'User-Agent': 'CloudPlay-Iraq/live-importer' },
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) return { ok: false, error: 'REDIRECT_WITHOUT_LOCATION', ms: Date.now() - started };
          current = new URL(location, current).toString();
          continue;
        }
        if (!response.ok || !response.body) return { ok: false, error: `HTTP_${response.status}`, ms: Date.now() - started };

        const declared = Number(response.headers.get('content-length'));
        if (Number.isFinite(declared) && declared > FEED_MAX_BYTES) {
          return { ok: false, error: 'FEED_TOO_LARGE', ms: Date.now() - started };
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          total += part.value.byteLength;
          if (total > FEED_MAX_BYTES) {
            await reader.cancel();
            return { ok: false, error: 'FEED_TOO_LARGE', ms: Date.now() - started };
          }
          chunks.push(part.value);
        }
        const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
        return { ok: true, text, bytes: total, ms: Date.now() - started, finalUrl: current };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    }
    return { ok: false, error: 'TOO_MANY_REDIRECTS', ms: Date.now() - started };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return { ok: false, error: name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR', ms: Date.now() - started };
  }
}
