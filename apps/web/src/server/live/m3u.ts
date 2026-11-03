/**
 * M3U / M3U8 (extended M3U) parser for live channel feeds.
 *
 * Input: the raw text of an M3U playlist (one or more #EXTINF sections).
 * Output: normalised channel records plus a full parse report so callers can
 * publish real numbers (total, duplicates, invalid, playable) instead of
 * guesses.
 *
 * Deliberate behaviour:
 *  - Never throws for a partially malformed list; it reports problems instead.
 *  - Only the first line may be the #EXTM3U header; a missing header is fatal
 *    because it means we did not receive a playlist at all.
 *  - #EXTVLCOPT / #EXTHTTP / #KODIPROP make an entry unplayable in a browser
 *    (they usually carry custom headers or credentials), so they are skipped
 *    rather than silently stripped.
 *  - Remote logos are only kept when they are safe public https URLs, because
 *    the UI renders them with next/image.
 */
import { createHash } from 'node:crypto';
import { checkManifestUrl } from './url-policy';

export type LiveChannel = {
  /** Stable id derived from tvg-id + name + url, so refreshes keep ids stable. */
  id: string;
  name: string;
  /** Slash-delimited category path, e.g. "Iraq/News". Empty when the feed has none. */
  group: string;
  /** XMLTV identifier when present. */
  epgId: string;
  /** Language hint from the feed (tvg-language or the country). */
  language: string;
  logo?: string;
  /** True when the server can proxy this stream (public https + HLS path). */
  playable: boolean;
  /** Why an entry is not playable, for operator diagnostics. Never shown to viewers. */
  blockedReason?: string;
  /** Opaque proxy id used by the player. Provider origin never reaches the client. */
  streamToken?: string;
  /** True when the playlist carries player options that a browser cannot honour. */
  needsPlayerOptions: boolean;
};

export type ParseReport = {
  /** Entries that produced a channel record. */
  total: number;
  /** Entries skipped because they repeated an id or an identical URL. */
  duplicates: number;
  /** Entries with a URL the server will not handle. */
  invalid: number;
  /** Entries with player options the browser cannot honour. */
  playerOptionOnly: number;
  /** Entries missing a display name. */
  unnamed: number;
  /** Total #EXTINF blocks found, before any filtering. */
  raw: number;
};

export type ParseResult = { channels: LiveChannel[]; report: ParseReport };

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CHANNELS = 7500;
const MAX_NAME = 120;
const MAX_GROUP = 80;
const MAX_LOGO = 1024;

/** Strip C0/C1 control characters that would break the DOM or a log line. */
export function cleanText(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Read a `key="value"` attribute out of an #EXTINF attribute blob. */
export function attribute(attributes: string, key: string): string {
  const match = attributes.match(new RegExp(`(?:^|\\s)${key}="([^"\\r\\n]*)"`, 'i'));
  return match?.[1] ?? '';
}

/**
 * Split `#EXTINF:-1 attrs,Display Name` at the first comma outside quotes.
 * Returns the attribute blob and the display name.
 */
export function splitExtInf(line: string): { attributes: string; display: string } {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) return { attributes: line.slice(0, index), display: line.slice(index + 1) };
  }
  return { attributes: line, display: '' };
}

function safeLogo(raw: string): string | undefined {
  if (!raw || raw.length > MAX_LOGO) return undefined;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return undefined;
    if (url.port && url.port !== '443') return undefined;
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.local')) return undefined;
    if (!/^[a-z0-9.-]+$/.test(host)) return undefined;
    if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Remove quality/status suffixes so the same channel is not listed twice. */
function dedupeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(\s*\d{3,4}p\s*\)/g, '')
    .replace(/\[(not 24\/7|geo-blocked|blocked)\]/g, '')
    .replace(/\b(hd|sd|fhd|uhd|4k)\b/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

export function parseM3U(raw: string): ParseResult {
  const report: ParseReport = { total: 0, duplicates: 0, invalid: 0, playerOptionOnly: 0, unnamed: 0, raw: 0 };
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('PLAYLIST_TOO_LARGE');
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  if ((lines[index] ?? '').trim().toUpperCase() !== '#EXTM3U') throw new Error('NOT_A_PLAYLIST');

  const channels: LiveChannel[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  let pending: { attributes: string; display: string } | undefined;
  let playerOptions = false;

  for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      pending = splitExtInf(line.slice('#EXTINF:'.length));
      report.raw += 1;
      playerOptions = false;
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:') || line.startsWith('#EXTHTTP:') || line.startsWith('#KODIPROP:')) {
      playerOptions = true;
      continue;
    }
    if (line.startsWith('#')) continue;
    if (!pending) continue;

    const { attributes, display } = pending;
    pending = undefined;
    if (channels.length >= MAX_CHANNELS) break;

    const name = cleanText(display || attribute(attributes, 'tvg-name'), MAX_NAME);
    if (!name) {
      report.unnamed += 1;
      continue;
    }
    const group = cleanText(attribute(attributes, 'group-title').replace(/\s*;\s*/g, '/'), MAX_GROUP);
    const epgId = cleanText(attribute(attributes, 'tvg-id'), 80);
    const language = cleanText(attribute(attributes, 'tvg-language') || attribute(attributes, 'tvg-country'), 40);
    const logo = safeLogo(attribute(attributes, 'tvg-logo'));
    const verdict = playerOptions ? null : checkManifestUrl(line);

    const identity = createHash('sha256').update(`${epgId}\u0000${line}`).digest('hex').slice(0, 20);
    if (seenIds.has(identity) || seenNames.has(dedupeKey(name))) {
      report.duplicates += 1;
      continue;
    }
    seenIds.add(identity);
    seenNames.add(dedupeKey(name));

    if (!verdict || !verdict.ok) {
      report.invalid += 1;
      if (playerOptions) report.playerOptionOnly += 1;
      channels.push({
        id: identity,
        name,
        group,
        epgId,
        language,
        ...(logo ? { logo } : {}),
        playable: false,
        blockedReason: playerOptions ? 'PLAYER_OPTIONS' : verdict && !verdict.ok ? verdict.code : 'PLAYER_OPTIONS',
        needsPlayerOptions: playerOptions,
      });
      continue;
    }

    channels.push({
      id: identity,
      name,
      group,
      epgId,
      language,
      ...(logo ? { logo } : {}),
      playable: true,
      needsPlayerOptions: false,
    });
  }

  report.total = channels.length;
  return { channels, report };
}

/**
 * Merge several parsed feeds. Earlier feeds win on duplicates, which is how an
 * operator-curated list takes precedence over a public one.
 */
export function mergeFeeds(feeds: ParseResult[]): ParseResult {
  const channels: LiveChannel[] = [];
  const report: ParseReport = { total: 0, duplicates: 0, invalid: 0, playerOptionOnly: 0, unnamed: 0, raw: 0 };
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const feed of feeds) {
    report.raw += feed.report.raw;
    report.unnamed += feed.report.unnamed;
    for (const channel of feed.channels) {
      const key = dedupeKey(channel.name);
      if (seenIds.has(channel.id) || seenNames.has(key)) {
        report.duplicates += 1;
        continue;
      }
      seenIds.add(channel.id);
      seenNames.add(key);
      channels.push(channel);
      if (channel.playable) report.total += 1;
      else {
        report.invalid += 1;
        if (channel.needsPlayerOptions) report.playerOptionOnly += 1;
      }
    }
  }
  return { channels, report };
}

export const PARSER_LIMITS = { MAX_BYTES, MAX_CHANNELS, MAX_NAME, MAX_GROUP, MAX_LOGO } as const;
