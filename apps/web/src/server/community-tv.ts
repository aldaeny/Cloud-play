/**
 * COMMUNITY live-TV directory — the iptv-org public playlist.
 *
 * Source: https://iptv-org.github.io/iptv/index.m3u
 *   • Community-maintained, openly licensed (MIT) directory of publicly
 *     reachable streams. It hosts no video itself.
 *   • The main index is already SFW-filtered upstream (`stream.isSFW()`);
 *     adult channels live in a separate `index.nsfw.m3u` we never read.
 *
 * This is a DIFFERENT trust tier from `public-tv.ts`:
 *   • public-tv.ts  — hand-verified, broadcaster-published, curated (31).
 *   • community-tv  — aggregated by a third party, NOT individually verified by
 *     us. Availability and rights vary per entry, so the UI says so plainly and
 *     every card links back to the upstream listing.
 *
 * Browser-playability filters applied here (these matter a lot):
 *   1. HTTPS only, credential-free, HLS (.m3u8) — no mixed content on an HTTPS page.
 *   2. Entries declaring `http-referrer` or `http-user-agent` are SKIPPED: those
 *      are forbidden headers in a browser, so hls.js can never satisfy them.
 *      Keeping them would fill the grid with channels that always fail.
 *   3. Xtream-style credential paths (/live/<user>/<pass>/<id>.ts) are skipped.
 *   4. One entry per channel feed — mirrors are collapsed to the first valid URL.
 */

import { isSafePublicStream } from './public-tv';

export const COMMUNITY_SOURCE_URL = 'https://iptv-org.github.io/iptv/index.m3u';
export const COMMUNITY_PROJECT_URL = 'https://github.com/iptv-org/iptv';
/**
 * Safety bound only. Set above the real usable size so the cap can never
 * silently truncate whole countries (the playlist is ordered by country, so a
 * low cap would drop every nation late in the alphabet).
 */
export const MAX_COMMUNITY_CHANNELS = 20000;

export type CommunityChannel = {
  /** Stable slug, safe to use as a React key and a favorites id. */
  id: string;
  name: string;
  /** Lower-case ISO country code from the tvg-id suffix, or '' when unknown. */
  country: string;
  categories: string[];
  logo: string;
  url: string;
};

export type CommunityFacet = { value: string; count: number };

export type CommunityIndex = {
  channels: CommunityChannel[];
  countries: CommunityFacet[];
  categories: CommunityFacet[];
  updatedAt: number;
};

/** Xtream reseller shape: credentials at the START of the path, numeric id at the end. */
const CREDENTIAL_PATH = /^\/(live|movie|series)\/[^/]+\/[^/]+\/\d+\./i;

/**
 * Defence in depth. The upstream main index is already SFW-filtered, but this
 * site is public and free for all ages, so we refuse adult entries ourselves
 * rather than relying solely on a third party's filter staying correct.
 */
const ADULT = /\b(xxx|adult|porn|pornographic|erotic|erotica|sex|sexy|hentai)\b/i;

function slugify(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** `AlJazeera.qa@Arabic` -> `qa`. Returns '' when the id carries no country. */
function countryFromTvgId(tvgId: string): string {
  const base = tvgId.split('@')[0];
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  const code = base.slice(dot + 1).toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : '';
}

function attribute(line: string, name: string): string {
  const match = line.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : '';
}

/**
 * Parse an #EXTM3U playlist into browser-playable entries.
 * Pure and synchronous so it can be unit-tested without network access.
 */
export function parseCommunityPlaylist(text: string): CommunityChannel[] {
  if (typeof text !== 'string' || !text) return [];

  const channels: CommunityChannel[] = [];
  const seenUrls = new Set<string>();
  const seenFeeds = new Set<string>();

  let pending: Omit<CommunityChannel, 'url'> | null = null;
  // A #EXTVLCOPT header requirement poisons the entry that follows it.
  let requiresHeaders = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTVLCOPT')) {
      if (/http-(referrer|user-agent)/i.test(line)) requiresHeaders = true;
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',');
      const title = comma >= 0 ? line.slice(comma + 1).trim() : '';
      const tvgId = attribute(line, 'tvg-id');
      const logo = attribute(line, 'tvg-logo');
      const group = attribute(line, 'group-title');
      // Inline attribute form is equally unplayable in a browser.
      requiresHeaders = Boolean(attribute(line, 'http-referrer') || attribute(line, 'http-user-agent'));
      pending = {
        id: slugify(tvgId || title) || `ch-${channels.length}`,
        name: title || tvgId || 'Unknown channel',
        country: countryFromTvgId(tvgId),
        categories: group ? group.split(';').map(c => c.trim()).filter(Boolean).slice(0, 6) : [],
        logo: logo.startsWith('https://') ? logo : '',
      };
      continue;
    }

    if (line.startsWith('#')) continue;

    // A bare line is the stream URL for the pending #EXTINF.
    const info = pending;
    pending = null;
    const blocked = requiresHeaders;
    requiresHeaders = false;
    if (!info || blocked) continue;
    if (ADULT.test(info.name) || info.categories.some(c => ADULT.test(c))) continue;
    if (!isSafePublicStream(line)) continue;

    let path: string;
    try { path = new URL(line).pathname; } catch { continue; }
    if (CREDENTIAL_PATH.test(path)) continue;
    if (seenUrls.has(line)) continue;

    // Collapse mirrors: one card per channel feed.
    const feedKey = info.id;
    if (seenFeeds.has(feedKey)) continue;

    seenUrls.add(line);
    seenFeeds.add(feedKey);
    channels.push({ ...info, url: line });
    if (channels.length >= MAX_COMMUNITY_CHANNELS) break;
  }

  return channels;
}

function facet(values: string[]): CommunityFacet[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function buildCommunityIndex(channels: CommunityChannel[]): CommunityIndex {
  return {
    channels,
    countries: facet(channels.map(c => c.country).filter(Boolean)),
    categories: facet(channels.flatMap(c => c.categories)),
    updatedAt: Date.now(),
  };
}

export type CommunityQuery = {
  country?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type CommunityPage = {
  data: CommunityChannel[];
  total: number;
  offset: number;
  limit: number;
  countries: CommunityFacet[];
  categories: CommunityFacet[];
  updatedAt: number;
};

/** Filter + paginate a parsed index. Pure, so the route stays thin and testable. */
export function queryCommunity(index: CommunityIndex, query: CommunityQuery): CommunityPage {
  const country = (query.country ?? '').toLowerCase().trim();
  const category = (query.category ?? '').toLowerCase().trim();
  const needle = (query.q ?? '').toLowerCase().trim().slice(0, 120);
  // Invalid, zero, negative or fractional values fall back to the defaults
  // rather than silently returning a one-item page.
  const rawLimit = Number(query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 60;
  const rawOffset = Number(query.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const matched = index.channels.filter(channel => {
    if (country && channel.country !== country) return false;
    if (category && !channel.categories.some(c => c.toLowerCase() === category)) return false;
    if (needle && !`${channel.name} ${channel.categories.join(' ')} ${channel.country}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  return {
    data: matched.slice(offset, offset + limit),
    total: matched.length,
    offset,
    limit,
    countries: index.countries,
    categories: index.categories,
    updatedAt: index.updatedAt,
  };
}
