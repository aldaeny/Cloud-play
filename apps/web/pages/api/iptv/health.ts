/**
 * GET /api/iptv/health — machine-readable Live pipeline health.
 *
 * This is the endpoint the acceptance tests and the operator use to prove that
 * the pipeline actually imported something. It reports measured numbers only:
 * no estimates, no success percentages.
 *
 * `?refresh=1` forces an upstream refresh (coalesced and rate limited by the
 * importer, so it is safe to call from a cron warmer).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveSnapshot, type Region } from '../../../src/server/live/importer';
import { checkManifestUrl } from '../../../src/server/live/url-policy';

const REGIONS: Region[] = ['iq', 'arab', 'world'];
const COOLDOWN_MS = 30_000;
let lastForced = 0;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const regionParam = typeof req.query.region === 'string' ? req.query.region : 'iq';
  if (!REGIONS.includes(regionParam as Region)) return res.status(400).json({ error: 'INVALID_REGION' });
  const region = regionParam as Region;

  const wants = req.query.refresh === '1';
  const force = wants && Date.now() - lastForced > COOLDOWN_MS;
  if (force) lastForced = Date.now();

  const started = Date.now();
  const served = await getLiveSnapshot(region, force);
  const snapshot = served.snapshot;
  const playable = snapshot.channels.filter((channel) => channel.playable && channel.url).length;
  const createdAt = Date.parse(snapshot.createdAt);
  const ageSeconds = Number.isFinite(createdAt) ? Math.max(0, Math.round((Date.now() - createdAt) / 1000)) : null;

  const status = playable === 0 ? 'unconfigured' : served.stale ? 'degraded' : 'ok';

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status,
    region,
    source: snapshot.origin,
    bundled: snapshot.bundled,
    updatedAt: snapshot.createdAt,
    stale: served.stale,
    staleReason: served.reason ?? null,
    ageSeconds,
    elapsedMs: Date.now() - started,
    counts: {
      total: snapshot.channels.length,
      playable,
      blocked: snapshot.channels.length - playable,
      duplicates: snapshot.report.duplicates,
      invalid: snapshot.report.invalid,
      playerOptionOnly: snapshot.report.playerOptionOnly,
      unnamed: snapshot.report.unnamed,
      raw: snapshot.report.raw,
    },
    feeds: snapshot.sources.map((source) => ({
      key: source.key,
      url: (() => {
        const verdict = checkManifestUrl(source.url);
        return verdict.ok ? verdict.url.href : null;
      })(),
      ok: source.ok,
      error: source.error ?? null,
      bytes: source.bytes ?? null,
      ms: source.ms ?? null,
    })),
  });
}
