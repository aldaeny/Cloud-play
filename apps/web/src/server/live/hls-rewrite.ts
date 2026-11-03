/**
 * HLS manifest rewriter.
 *
 * The player talks only to this origin. That is what makes the Live section work
 * for providers that send no CORS headers, and it is also why no provider host
 * or signed URL ever reaches the browser.
 *
 * Rewriting rules
 *  - every URI in the playlist (segment lines and URI="..." attributes inside
 *    #EXT-X-KEY / #EXT-X-MAP / #EXT-X-MEDIA / #EXT-X-I-FRAME-STREAM-INF) is
 *    resolved against the manifest URL, validated by the URL policy, then
 *    replaced with a same-origin `/api/stream/<token>` path;
 *  - if ANY required child URI fails validation the whole manifest is rejected,
 *    because serving a manifest with a mixed-in unvalidated URL would let the
 *    browser reach an address we refuse to reach ourselves;
 *  - non-URI lines (tags, comments, numeric attributes) are copied verbatim.
 *
 * This module is pure: it takes text and returns text, so it is unit-testable
 * without a network or a server.
 */
import { checkChildUrl, encodeStreamTarget, checkHost } from './url-policy';

export const PROXY_PREFIX = '/api/stream/';

export type RewriteResult = { ok: true; body: string; uriCount: number } | { ok: false; code: string; detail: string };

/** `URI="..."` occurrences inside an HLS tag. */
const URI_ATTRIBUTE = /URI="([^"]*)"/g;

function proxyPath(absolute: string): string {
  return PROXY_PREFIX + encodeStreamTarget(absolute);
}

/** Resolve a possibly relative URI against the manifest that declared it. */
function resolve(base: string, reference: string): string | null {
  try {
    return new URL(reference, base).toString();
  } catch {
    return null;
  }
}

/**
 * True when the tag line carries URIs that must be rewritten.
 * `#EXT-X-KEY` matters most: an un-rewritten key URI leaks the key location and
 * usually breaks playback because the browser cannot fetch it cross-origin.
 */
function tagCarriesUri(line: string): boolean {
  return (
    line.startsWith('#EXT-X-KEY:') ||
    line.startsWith('#EXT-X-MAP:') ||
    line.startsWith('#EXT-X-MEDIA:') ||
    line.startsWith('#EXT-X-I-FRAME-STREAM-INF:') ||
    line.startsWith('#EXT-X-SESSION-KEY:') ||
    line.startsWith('#EXT-X-PART:') ||
    line.startsWith('#EXT-X-PRELOAD-HINT:')
  );
}

export function rewriteManifest(raw: string, manifestUrl: string, options: { maxUri?: number } = {}): RewriteResult {
  const maxUri = options.maxUri ?? 5000;
  if (typeof raw !== 'string' || raw.length > 4 * 1024 * 1024) return { ok: false, code: 'MANIFEST_TOO_LARGE', detail: 'manifest over 4 MiB' };
  if (!/^\s*#EXTM3U/.test(raw)) return { ok: false, code: 'NOT_A_MANIFEST', detail: 'missing #EXTM3U' };

  const replacements: Array<{ from: string; to: string }> = [];
  const out: string[] = [];
  const endings = raw.split(/\r?\n/);
  let uriCount = 0;

  for (const line of endings) {
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (!tagCarriesUri(trimmed)) {
        out.push(line);
        continue;
      }
      let failed: string | null = null;
      const rewritten = trimmed.replace(URI_ATTRIBUTE, (_match, reference: string) => {
        if (failed) return _match;
        const absolute = resolve(manifestUrl, reference);
        if (!absolute) {
          failed = 'MALFORMED_CHILD_URI';
          return _match;
        }
        const verdict = checkChildUrl(absolute);
        if (!verdict.ok) {
          failed = `CHILD_URI_REJECTED_${verdict.code}`;
          return _match;
        }
        uriCount += 1;
        if (uriCount > maxUri) {
          failed = 'TOO_MANY_URIS';
          return _match;
        }
        const path = proxyPath(absolute);
        replacements.push({ from: reference, to: path });
        return `URI="${path}"`;
      });
      if (failed) return { ok: false, code: failed, detail: `child uri in ${trimmed.slice(0, 40)}` };
      out.push(rewritten);
      continue;
    }

    // A media segment / playlist reference line.
    const absolute = resolve(manifestUrl, trimmed);
    if (!absolute) return { ok: false, code: 'MALFORMED_CHILD_URI', detail: trimmed.slice(0, 80) };
    // Nested playlists (master -> variant) are manifests; segments are media.
    // Both go through the same host policy, so the reason code stays precise.
    const isNested = /\.m3u8?$/i.test(new URL(absolute).pathname);
    if (isNested) {
      const hostProblem = checkHost(new URL(absolute));
      if (hostProblem) return { ok: false, code: `CHILD_URI_REJECTED_${hostProblem}`, detail: trimmed.slice(0, 80) };
    } else {
      const verdict = checkChildUrl(absolute);
      if (!verdict.ok) return { ok: false, code: `CHILD_URI_REJECTED_${verdict.code}`, detail: trimmed.slice(0, 80) };
    }
    uriCount += 1;
    if (uriCount > maxUri) return { ok: false, code: 'TOO_MANY_URIS', detail: `more than ${maxUri} uris` };
    out.push(proxyPath(absolute));
  }

  return { ok: true, body: out.join('\n'), uriCount };
}

/** Turn a master playlist URI into a proxy path, validating it first. */
export function nestedManifestPath(base: string, reference: string): string | null {
  const absolute = resolve(base, reference);
  if (!absolute) return null;
  try {
    if (checkHost(new URL(absolute)) !== null) return null;
  } catch {
    return null;
  }
  return proxyPath(absolute);
}
