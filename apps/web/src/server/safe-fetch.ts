/**
 * SSRF-hardened outbound fetch for OWNER-SUPPLIED URLs.
 *
 * The Xtream proxy is safe by construction: its tokens carry a provider-relative
 * path and the origin is fixed by configuration, so it can only ever talk to one
 * server. Playlist import is different — the owner hands us an arbitrary URL, so
 * the server must actively refuse to be aimed at anything internal.
 *
 * Layers, in order:
 *   1. scheme must be http/https, and the authority must carry no userinfo
 *   2. obvious internal hostnames are rejected outright
 *   3. the port must be a plausible web port, never an internal service port
 *   4. EVERY resolved address must be public (IPv4 + IPv6, incl. v4-mapped)
 *   5. redirects are followed by hand and re-checked against all of the above
 *   6. bytes and wall-clock time are capped
 *
 * The socket lookup itself validates every answer and pins the connection.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { pinnedGet } from './pinned-get';

export type FetchCode =
  | 'BAD_URL'
  | 'BLOCKED_HOST'
  | 'BLOCKED_PORT'
  | 'BLOCKED_ADDRESS'
  | 'DNS_FAILED'
  | 'TOO_MANY_REDIRECTS'
  | 'UPSTREAM_UNREACHABLE'
  | 'UPSTREAM_ERROR'
  | 'TOO_LARGE';

export class SafeFetchError extends Error {
  constructor(public code: FetchCode) {
    super(code);
  }
}

/** Ports that belong to internal services, never to a public media origin. */
const BLOCKED_PORTS = new Set([
  22, 23, 25, 53, 67, 68, 69, 110, 111, 123, 135, 137, 138, 139, 143, 161, 162,
  389, 445, 465, 512, 513, 514, 587, 631, 873, 993, 995, 1080, 1433, 1521, 1723,
  2049, 2181, 2375, 2376, 2379, 2380, 3000, 3306, 3389, 4444, 5000, 5432, 5601,
  5672, 5900, 5984, 6379, 6443, 7001, 8500, 8600, 9000, 9042, 9092, 9200, 9300,
  10250, 10255, 11211, 15672, 27017, 27018, 27019, 50070,
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost', '.local', '.localdomain', '.internal', '.intranet',
  '.lan', '.home', '.home.arpa', '.corp', '.svc', '.cluster.local',
];

const BLOCKED_HOSTS = new Set([
  'localhost', 'ip6-localhost', 'ip6-loopback', 'broadcasthost',
  'metadata', 'metadata.google.internal', 'instance-data',
]);

/** True when the address is loopback, private, link-local, reserved or multicast. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().toLowerCase().replace(/%.*$/, ''); // strip IPv6 zone id

  // IPv4-mapped IPv6. WHATWG normalises the dotted form to hex, so BOTH must be
  // understood: "::ffff:127.0.0.1" arrives from URLs as "::ffff:7f00:1".
  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  // Dotted mapped form and the deprecated IPv4-compatible form ("::127.0.0.1").
  const mappedDotted = ip.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedDotted) return isPrivateAddress(mappedDotted[1]);

  if (!isIP(ip)) return true;
  if (ip.includes(':')) {
    if (!/^[23][0-9a-f]{3}:/.test(ip) || ip.startsWith('2002:') || ip.startsWith('3fff:') || (ip.startsWith('2001:') && parseInt(ip.split(':')[1] || '0', 16) < 0x200)) return true;
    if (ip === '::' || ip === '::1') return true;
    const head = ip.split(':')[0];
    const first = parseInt(head || '0', 16);
    if (Number.isNaN(first)) return true; // unparseable: fail closed
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (ip.startsWith('2001:db8')) return true; // documentation range
    if (ip.startsWith('64:ff9b:')) return true; // NAT64
    return false;
  }

  const parts = ip.split('.');
  if (parts.length !== 4) return true; // not an address we understand: fail closed
  // Reject non-canonical octets (leading zeros) that different parsers disagree on.
  if (parts.some(part => !/^\d{1,3}$/.test(part) || (part.length > 1 && part.startsWith('0')))) return true;
  const octets = parts.map(Number);
  if (octets.some(n => n > 255)) return true;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 88 && octets[2] === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; // TEST-NET-2
  if (a === 203 && b === 0) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** Synchronous checks that need no DNS: scheme, userinfo, hostname, port. */
export function parsePublicUrl(raw: string): URL {
  if (typeof raw !== 'string') throw new SafeFetchError('BAD_URL');
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4096) throw new SafeFetchError('BAD_URL');
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new SafeFetchError('BAD_URL');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new SafeFetchError('BAD_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SafeFetchError('BAD_URL');
  // Credentials belong in the query string for IPTV, never in the authority.
  if (url.username || url.password) throw new SafeFetchError('BAD_URL');

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || host.length > 253) throw new SafeFetchError('BAD_URL');
  if (BLOCKED_HOSTS.has(host)) throw new SafeFetchError('BLOCKED_HOST');
  if (BLOCKED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))) throw new SafeFetchError('BLOCKED_HOST');
  if (!host.includes('.') && !host.includes(':')) throw new SafeFetchError('BLOCKED_HOST'); // bare label

  // IP literals need no DNS: judge them here so an internal address is refused
  // at import time, not merely at playback time. WHATWG normalisation already
  // collapsed octal/hex IPv4 forms, and brackets are stripped above for IPv6.
  const isIpLiteral = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':');
  if (isIpLiteral && isPrivateAddress(host)) throw new SafeFetchError('BLOCKED_ADDRESS');

  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new SafeFetchError('BLOCKED_PORT');
    if (BLOCKED_PORTS.has(port)) throw new SafeFetchError('BLOCKED_PORT');
  }
  return url;
}

/**
 * Short-lived cache of "this host resolved to public addresses".
 *
 * HLS asks for a new segment every few seconds; resolving and re-checking on
 * every request would add a lookup of latency to each one. Only POSITIVE
 * verdicts are cached, and briefly, so a host that turns internal is re-checked
 * within the window. Failures are never cached.
 */
const HOST_VERDICT_TTL_MS = 60_000;
const HOST_VERDICT_MAX = 512;
const publicHosts = new Map<string, number>();

/** Test seam. */
export function resetHostVerdicts(): void {
  publicHosts.clear();
}

/** A DNS resolver must not outlive the connection's security budget. */
async function boundedLookup(host: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SafeFetchError('DNS_FAILED')), 2000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Resolve the host and require every address to be public. */
export async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const cached = publicHosts.get(host);
  if (cached && Date.now() < cached) return;

  let records: { address: string }[];
  try {
    records = await boundedLookup(host);
  } catch {
    throw new SafeFetchError('DNS_FAILED');
  }
  if (!records.length) throw new SafeFetchError('DNS_FAILED');
  for (const record of records) {
    if (isPrivateAddress(record.address)) throw new SafeFetchError('BLOCKED_ADDRESS');
  }

  publicHosts.set(host, Date.now() + HOST_VERDICT_TTL_MS);
  if (publicHosts.size > HOST_VERDICT_MAX) {
    const now = Date.now();
    for (const [key, expiry] of publicHosts) if (now >= expiry) publicHosts.delete(key);
    if (publicHosts.size > HOST_VERDICT_MAX) {
      const first = publicHosts.keys().next().value;
      if (first !== undefined) publicHosts.delete(first);
    }
  }
}

export type SafeFetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** When true a redirect may not change the origin (used by the media proxy). */
  pinOrigin?: boolean;
  method?: 'GET' | 'HEAD';
};

/**
 * Fetch a URL with every guard applied, including on each redirect hop.
 * The caller owns the returned body and must consume or cancel it.
 */
export async function safeFetch(
  raw: string,
  options: SafeFetchOptions = {},
): Promise<{ response: Response; url: URL }> {
  const {
    headers = {},
    timeoutMs = 20_000,
    maxBytes,
    maxRedirects = 3,
    pinOrigin = false,
    method = 'GET',
  } = options;

  let target = parsePublicUrl(raw);
  const startOrigin = target.origin;
  await assertPublicHost(target);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      const socketLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
        // This is the actual connection lookup, not a cached preflight verdict.
        boundedLookup(target.hostname.replace(/^\[|\]$/g, '')).then(records => {
          if (!records.length || records.some(record => !isIP(record.address) ||
              record.family !== isIP(record.address) || isPrivateAddress(record.address))) {
            callback(new Error('BLOCKED_ADDRESS'), '', 4); return;
          }
          const selected = records[0];
          if (lookupOptions.all) callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        }).catch(() => callback(new Error('DNS_FAILED'), '', 4));
      };
      response = await pinnedGet(target, {
        method, signal: controller.signal, lookup: socketLookup, maxBytes,
        headers: { Accept: '*/*', 'User-Agent': 'CloudPlayPlaylist/1.0', ...headers },
      });
    } catch {
      clearTimeout(timer);
      throw new SafeFetchError('UPSTREAM_UNREACHABLE');
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      clearTimeout(timer);
      if (!location) throw new SafeFetchError('UPSTREAM_ERROR');
      let next: URL;
      try {
        next = parsePublicUrl(new URL(location, target).toString());
      } catch (error) {
        throw error instanceof SafeFetchError ? error : new SafeFetchError('UPSTREAM_ERROR');
      }
      if (target.protocol === 'https:' && next.protocol !== 'https:') throw new SafeFetchError('BLOCKED_HOST');
      if (pinOrigin && next.origin !== startOrigin) throw new SafeFetchError('BLOCKED_HOST');
      await assertPublicHost(next); // re-check: a redirect is a fresh SSRF chance
      target = next;
      continue;
    }

    // Deadline remains active while the streaming body is being consumed.
    timer.unref?.();
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel().catch(() => {});
      throw new SafeFetchError('UPSTREAM_ERROR');
    }
    if (!response.ok && response.status !== 206) {
      await response.body?.cancel().catch(() => {});
      throw new SafeFetchError('UPSTREAM_ERROR');
    }
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (maxBytes && Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw new SafeFetchError('TOO_LARGE');
    }
    return { response, url: target };
  }
  throw new SafeFetchError('TOO_MANY_REDIRECTS');
}

/** Read a body fully, enforcing the byte cap even without a Content-Length. */
export async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) throw new SafeFetchError('TOO_LARGE');
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SafeFetchError('TOO_LARGE');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8');
}
