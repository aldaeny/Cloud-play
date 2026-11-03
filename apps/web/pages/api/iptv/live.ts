/**
 * GET /api/iptv/live — the real Live TV feed.
 *
 * Replaces the rights-gated `/api/iptv/licensed` path for the Live section.
 * There is no rights acknowledgement, no operator approval and no identity
 * check in this path: a public playlist is imported, parsed and published.
 *
 * Query parameters (all optional):
 *   region=iq|arab|world   which fixed feed to publish (default iq)
 *   q=<text>               case-insensitive name filter
 *   group=<text>           exact group filter
 *   playable=1             only channels the player can open
 *   page=<n>               ​1-based page number
 *   pageSize=<n>           default 120, max 240
 *   refresh=1              force an upstream refresh (rate limited)
 *
 * Security notes:
 *  - the response never contains provider hosts or signed URLs; each playable
 *    channel carries an opaque `/api/stream/<token>` path instead;
 *  - the region parameter selects from a fixed registry; it is never a URL.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveSnapshot, sourcesFor, type Region } from '../../../src/server/live/importer';
import { publicChannel } from '../../../src/server/live/publish';
import { checkManifestUrl } from '../../../src/server/live/url-policy';

const REGIONS: Region[] = ['iq', 'arab', 'world'];
const DEFAULT_PAGE_SIZE = 120;
const MAX_PAGE_SIZE = 240;
/** Forced refreshes are cheap for us but not for the provider. */
const FORCE_COOLDOWN_MS = 30_000;
let lastForced = 0;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const regionParam = typeof req.query.region === 'string' ? req.query.region : 'iq';
  const region = REGIONS.includes(regionParam as Region) ? (regionParam as Region) : null;
  if (!region) return res.status(400).json({ error: 'INVALID_REGION' });

  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const group = typeof req.query.group === 'string' ? req.query.group.trim().slice(0, 80) : '';
  const onlyPlayable = req.query.playable === '1';
  const pageRaw = typeof req.query.page === 'string' ? req.query.page : '1';
  const sizeRaw = typeof req.query.pageSize === 'string' ? req.query.pageSize : String(DEFAULT_PAGE_SIZE);
  if (!/^\d{1,5}$/.test(pageRaw) || Number(pageRaw) < 1) return res.status(400).json({ error: 'INVALID_PAGE' });
  if (!/^\d{1,3}$/.test(sizeRaw) || Number(sizeRaw) < 1) return res.status(400).json({ error: 'INVALID_PAGE_SIZE' });
  const page = Number(pageRaw);
  const pageSize = Math.min(Number(sizeRaw), MAX_PAGE_SIZE);

  const wantsRefresh = req.query.refresh === '1';
  const now = Date.now();
  const force = wantsRefresh && now - lastForced > FORCE_COOLDOWN_MS;
  if (force) lastForced = now;

  try {
    const served = await getLiveSnapshot(region, force);
    const snapshot = served.snapshot;
    const all = snapshot.channels.map(publicChannel).filter((channel): channel is NonNullable<typeof channel> => channel !== null);

    const needle = q.toLocaleLowerCase();
    const matches = all.filter((channel) => {
      if (onlyPlayable && !channel.playable) return false;
      if (group && channel.group !== group) return false;
      if (needle && !`${channel.name} ${channel.group}`.toLocaleLowerCase().includes(needle)) return false;
      return true;
    });

    const groups = [...new Set(all.map((channel) => channel.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const ageSeconds = Math.max(0, Math.round((now - Date.parse(snapshot.createdAt)) / 1000));

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.setHeader('X-Live-Source', snapshot.origin);
    res.setHeader('X-Live-Stale', String(served.stale));
    return res.status(200).json({
      data: matches.slice((page - 1) * pageSize, page * pageSize),
      total: matches.length,
      page,
      pageSize,
      groups,
      region,
      source: snapshot.origin,
      stale: served.stale,
      /** Seconds since this channel list was imported. */
      age: ageSeconds,
      counts: {
        total: all.length,
        playable: all.filter((channel) => channel.playable).length,
        blocked: all.filter((channel) => !channel.playable).length,
        duplicates: snapshot.report.duplicates,
        raw: snapshot.report.raw,
      },
      /** Which fixed feeds were attempted, and whether they answered. */
      feeds: snapshot.sources.map((source) => ({
        key: source.key,
        // Only publish hosts that passed the URL policy; never a rejected URL.
        host: (() => {
          try {
            const verdict = checkManifestUrl(source.url);
            return verdict.ok ? verdict.url.host : null;
          } catch {
            return null;
          }
        })(),
        ok: source.ok,
        error: source.error,
        ms: source.ms,
      })),
      configured: sourcesFor(region).length,
    });
  } catch {
    return res.status(503).json({ error: 'LIVE_FEED_UNAVAILABLE' });
  }
}
