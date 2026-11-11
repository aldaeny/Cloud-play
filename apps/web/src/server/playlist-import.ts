import {type MediaBinding} from './private-media-session';
/**
 * Owner-only M3U playlist import.
 *
 * Trust model — this is deliberately NOT the public community tier:
 *   - the list is supplied by the authenticated owner, stays owner-only, noindex
 *   - the public content filters (SFW-only, HTTPS-only, .m3u8-only) are NOT
 *     applied, because this is the owner's own private list
 *   - what IS always applied: the SSRF guard, byte/time caps, and credential
 *     hiding. Raw stream URLs never reach the browser, only sealed tokens.
 *
 * Because the proxy runs on the server it can forward Referer and User-Agent,
 * so entries that the public tier must reject as unplayable can work here.
 *
 * Production imports mint encrypted non-playable selection descriptors bound to
 * the original live Auth session/IP/country and absolute expiry. Existing players
 * exchange them for120-second resource grants; every resource checks live Auth.
 * Legacy self-contained playable tokens remain development-only.
 */
import { createHash } from 'node:crypto';
import { parsePublicUrl, readCapped, safeFetch, SafeFetchError } from './safe-fetch';
import { playlistSecret, streamUrl, PLAYLIST_TOKEN_TTL_MS } from './playlist-token';

export const PLAYLIST_MAX_BYTES = 16 * 1024 * 1024;
export const MAX_PLAYLIST_CHANNELS = 3000;
const IMPORT_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 24;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_IMPORTS = 30;

export type PlaylistCode =
  | 'INVALID_URL'
  | 'NOT_A_PLAYLIST'
  | 'EMPTY_PLAYLIST'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMIT'
  | 'TOO_LARGE'
  | 'UPSTREAM_ERROR';

export class PlaylistError extends Error {
  constructor(public code: PlaylistCode) {
    super(code);
  }
}

export type ImportedChannel = {
  id: string;
  name: string;
  group: string;
  logo?: string;
  /** Same-origin proxy URL carrying a sealed capability token. */
  url: string;
  kind: 'hls' | 'mp4';
  container: string;
  /** True for containers a browser usually cannot decode (ts/mkv/avi). */
  risky: boolean;
};

export type ImportResult = {
  channels: ImportedChannel[];
  groups: { name: string; count: number }[];
  total: number;
  returned: number;
  truncated: boolean;
  skipped: number;
  host: string;
  fetchedAt: number;
};

type RawEntry = {
  name: string;
  group: string;
  logo?: string;
  target: string;
  referrer?: string;
  userAgent?: string;
};

function attribute(line: string, key: string): string {
  const match = line.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

function cleanText(value: string, fallback: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, 200);
}

/**
 * Parse M3U/M3U8 extended playlists.
 *
 * Handles the real-world shapes: inline `http-referrer` / `http-user-agent`
 * attributes AND their `#EXTVLCOPT:` / `#EXTHTTP:` equivalents, `#KODIPROP`,
 * and bare (non-extended) lists of URLs.
 */
export function parsePlaylist(text: string): RawEntry[] {
  const entries: RawEntry[] = [];
  const lines = text.split(/\r?\n/);
  let pending: Omit<RawEntry, 'target'> | null = null;
  let referrer = '';
  let userAgent = '';
  let index = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#EXTINF/i.test(line)) {
      const comma = line.indexOf(',');
      const title = comma >= 0 ? line.slice(comma + 1) : '';
      pending = {
        name: cleanText(title, `Channel ${++index}`),
        group: cleanText(attribute(line, 'group-title'), 'Uncategorised'),
        logo: attribute(line, 'tvg-logo') || undefined,
      };
      referrer = attribute(line, 'http-referrer') || attribute(line, 'referrer') || '';
      userAgent = attribute(line, 'http-user-agent') || attribute(line, 'user-agent') || '';
      continue;
    }

    if (/^#EXTVLCOPT:/i.test(line)) {
      const option = line.slice('#EXTVLCOPT:'.length);
      const eq = option.indexOf('=');
      if (eq > 0) {
        const key = option.slice(0, eq).trim().toLowerCase();
        const value = option.slice(eq + 1).trim();
        if (key === 'http-referrer') referrer = value;
        if (key === 'http-user-agent') userAgent = value;
      }
      continue;
    }

    if (/^#EXTHTTP:/i.test(line)) {
      try {
        const parsed = JSON.parse(line.slice('#EXTHTTP:'.length)) as Record<string, unknown>;
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value !== 'string') continue;
          if (/^referer$/i.test(key) || /^referrer$/i.test(key)) referrer = value;
          if (/^user-agent$/i.test(key)) userAgent = value;
        }
      } catch {
        // Malformed JSON hint — ignore it, the stream may still work.
      }
      continue;
    }

    if (line.startsWith('#')) continue; // other directives carry no target

    // A URL line. Bare lists have no preceding #EXTINF.
    const entry: RawEntry = {
      name: pending?.name ?? cleanText(`Channel ${++index}`, `Channel ${index}`),
      group: pending?.group ?? 'Uncategorised',
      logo: pending?.logo,
      target: line,
      referrer: referrer || undefined,
      userAgent: userAgent || undefined,
    };
    entries.push(entry);
    pending = null;
    referrer = '';
    userAgent = '';
  }
  return entries;
}

function containerOf(path: string): string {
  const match = path.toLowerCase().match(/\.([a-z0-9]{2,5})(?:$|\?)/);
  return match ? match[1] : 'ts';
}

/** Logos are shown directly, so they must be public HTTPS with no credentials. */
function safeLogo(value: string | undefined): string | undefined {
  if (!value || !/^https:\/\//i.test(value) || value.length > 2048) return undefined;
  try {
    const url = parsePublicUrl(value);
    if (url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Validate, de-duplicate and seal parsed entries.
 * Only SYNCHRONOUS URL checks run here; the full DNS check happens per stream at
 * playback time, so importing a 3,000-channel list does not fire 3,000 lookups.
 */
export function buildChannels(entries: RawEntry[], secret: string, binding?:MediaBinding): {
  channels: ImportedChannel[];
  skipped: number;
  total: number;
} {
  const seen = new Set<string>();
  const channels: ImportedChannel[] = [];
  let skipped = 0;

  for (const entry of entries) {
    let url: URL;
    try {
      url = parsePublicUrl(entry.target);
    } catch {
      skipped++; // private host, blocked port, bad scheme, embedded userinfo…
      continue;
    }
    const key = url.toString();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    if (channels.length >= MAX_PLAYLIST_CHANNELS) {
      skipped++;
      continue;
    }

    const container = containerOf(url.pathname);
    const kind: 'hls' | 'mp4' = container === 'm3u8' || container === 'm3u' ? 'hls' : 'mp4';
    channels.push({
      id: createHash('sha256').update(key).digest('hex').slice(0, 16),
      name: entry.name,
      group: entry.group,
      logo: (()=>{const logo=safeLogo(entry.logo);if(!binding||!logo)return logo;
        const target=new URL(logo);return streamUrl({origin:target.origin,path:target.pathname+target.search,binding,expiresAt:binding.expiresAt},secret,120000);})(),
      url: streamUrl(
        {
          binding,
          purpose:binding?'selection':undefined,
          expiresAt:binding?.expiresAt,
          origin: url.origin,
          path: url.pathname + url.search,
          referrer: entry.referrer,
          userAgent: entry.userAgent,
        },
        secret,
        binding?Math.max(0,binding.expiresAt-Date.now()):undefined,
      )+(binding?'&session=1':''),
      kind,
      container,
      risky: !['m3u8', 'm3u', 'mp4', 'm4v', 'webm'].includes(container),
    });
  }
  return { channels, skipped, total: seen.size };
}

function summarise(channels: ImportedChannel[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const channel of channels) counts.set(channel.group, (counts.get(channel.group) ?? 0) + 1);
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 400);
}

// --- per-instance caches -----------------------------------------------------
const cache = new Map<string, { at: number; result: ImportResult }>();
const imports = new Map<string, number[]>();

function rateLimit(owner: string): void {
  const now = Date.now();
  const recent = (imports.get(owner) ?? []).filter(at => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_IMPORTS) throw new PlaylistError('RATE_LIMIT');
  recent.push(now);
  imports.set(owner, recent);
  if (imports.size > 500) {
    for (const [key, stamps] of imports) {
      if (!stamps.some(at => now - at < RATE_WINDOW_MS)) imports.delete(key);
    }
  }
}

function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

/** Test seam: drop caches between scenarios. */
export function resetPlaylistCaches(): void {
  cache.clear();
  imports.clear();
}

/**
 * Fetch, parse and seal an owner-supplied playlist.
 * `owner` is the authenticated account id, used only for rate limiting.
 */
export async function importPlaylist(rawUrl: string, owner: string, binding?:MediaBinding): Promise<ImportResult> {
  let secret: string;
  try {
    secret = playlistSecret();
  } catch {
    throw new PlaylistError('NOT_CONFIGURED');
  }

  let url: URL;
  try {
    url = parsePublicUrl(rawUrl);
  } catch {
    throw new PlaylistError('INVALID_URL');
  }

  rateLimit(owner);

  const key = cacheKey(url.toString());
  const hit = cache.get(key);
  if (!binding && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  let text: string;
  let host: string;
  try {
    const { response, url: finalUrl } = await safeFetch(url.toString(), {
      timeoutMs: IMPORT_TIMEOUT_MS,
      maxBytes: PLAYLIST_MAX_BYTES,
      maxRedirects: 4,
      headers: { Accept: 'application/x-mpegurl, audio/mpegurl, application/vnd.apple.mpegurl, text/plain, */*' },
    });
    text = await readCapped(response, PLAYLIST_MAX_BYTES);
    host = finalUrl.hostname;
  } catch (error) {
    if (error instanceof SafeFetchError) {
      if (error.code === 'TOO_LARGE') throw new PlaylistError('TOO_LARGE');
      if (error.code === 'BAD_URL' || error.code === 'BLOCKED_HOST' || error.code === 'BLOCKED_PORT' || error.code === 'BLOCKED_ADDRESS') {
        throw new PlaylistError('INVALID_URL');
      }
    }
    throw new PlaylistError('UPSTREAM_ERROR');
  }

  // A login page or an HTML error page is not a playlist.
  if (!/#EXTM3U/i.test(text.slice(0, 4096)) && !/^https?:\/\//im.test(text)) {
    throw new PlaylistError('NOT_A_PLAYLIST');
  }

  const entries = parsePlaylist(text);
  if (entries.length === 0) throw new PlaylistError('EMPTY_PLAYLIST');

  const { channels, skipped, total } = buildChannels(entries, secret,binding);
  if (channels.length === 0) throw new PlaylistError('EMPTY_PLAYLIST');

  const result: ImportResult = {
    channels,
    groups: summarise(channels),
    total,
    returned: channels.length,
    truncated: total > channels.length,
    skipped,
    host,
    fetchedAt: Date.now(),
  };

  if(!binding)cache.set(key, { at: Date.now(), result });
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  return result;
}

export const TOKEN_TTL = PLAYLIST_TOKEN_TTL_MS;
