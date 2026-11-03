/**
 * Live import service.
 *
 * Responsibilities
 *  - pick the feeds that are enabled (operator first, then the requested region);
 *  - fetch them concurrently with a bounded timeout;
 *  - parse and merge, operator first, so a curated entry beats a public one;
 *  - keep the previous good snapshot when a refresh fails (last-known-good);
 *  - answer "what should the API serve right now?" without the caller having to
 *    know about caches, TTLs or storage.
 *
 * Concurrency: one in-flight refresh per process. Concurrent requests await the
 * same promise instead of stampeding every provider at once.
 */
import { fetchFeed } from './fetch-feed';
import { parseM3U, mergeFeeds } from './m3u';
import { FEED_STALE_MS, FEED_TTL_MS, LIVE_SOURCES, operatorSource } from './sources';
import { bundledSnapshot, readStoredSnapshot, writeStoredSnapshot } from './store';
import type { LiveSnapshot, LiveSource } from './types';
import { checkManifestUrl } from './url-policy';

export type Region = 'iq' | 'arab' | 'world';

type ServeState = { snapshot: LiveSnapshot; stale: boolean; reason?: string };

/** Process-local cache of the snapshot currently being served. */
let served: ServeState | null = null;
let inflight: Promise<ServeState> | null = null;
/** When the current snapshot was produced (ms epoch). */
let producedAt = 0;

/** Test seam: reset module state between acceptance tests. */
export function resetLiveCache(): void {
  served = null;
  inflight = null;
  producedAt = 0;
}

/** Build the enabled source list for a region. */
export function sourcesFor(region: Region): LiveSource[] {
  const list: LiveSource[] = [];
  const operator = operatorSource();
  if (operator) list.push(operator);
  if (region !== 'world') list.push(LIVE_SOURCES[region]);
  else list.push(LIVE_SOURCES.world);
  return list;
}

function snapshotFromBundled(): LiveSnapshot | null {
  return bundledSnapshot();
}

async function fromInitialState(): Promise<LiveSnapshot | null> {
  const stored = await readStoredSnapshot();
  if (stored) return stored;
  return snapshotFromBundled();
}

/** Convert a source read into the stored shape. */
function toSnapshot(
  origin: string,
  sources: LiveSnapshot['sources'],
  parsed: ReturnType<typeof mergeFeeds>,
  sourceKeys: Map<string, string>,
  bundled = false,
): LiveSnapshot {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    origin,
    bundled,
    channels: parsed.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      group: channel.group,
      epgId: channel.epgId,
      language: channel.language,
      ...(channel.logo ? { logo: channel.logo } : {}),
      playable: channel.playable,
      ...(channel.blockedReason ? { blockedReason: channel.blockedReason } : {}),
      url: channel.playable ? parsed.urls.get(channel.id) : undefined,
      ...(sourceKeys.has(channel.id) ? { sourceKey: sourceKeys.get(channel.id) } : {}),
    })),
    report: parsed.report,
    sources,
  };
}

/**
 * Refresh from the network. Never throws: returns the fresh snapshot on success,
 * or a `null` snapshot plus the failure detail so the caller can fall back.
 */
async function refreshFromNetwork(region: Region): Promise<{ snapshot: LiveSnapshot | null; sources: LiveSnapshot['sources']; error?: string }> {
  const sources = sourcesFor(region);
  const report: LiveSnapshot['sources'] = [];
  const parsedFeeds: Array<{ key: string; parsed: ReturnType<typeof parseM3U> }> = [];
  const sourceKeys = new Map<string, string>();

  await Promise.all(
    sources.map(async (source) => {
      const inline = source.key === 'operator' ? process.env.CLOUDPLAY_LIVE_FEED_INLINE : undefined;
      if (inline) {
        try {
          const inlineParsed = parseM3U(inline, source.category);
          for (const channel of inlineParsed.channels) sourceKeys.set(channel.id, source.key);
          parsedFeeds.push({ key: source.key, parsed: inlineParsed });
          report.push({ key: source.key, url: 'inline', ok: true, bytes: Buffer.byteLength(inline, 'utf8'), ms: 0 });
        } catch (error) {
          report.push({ key: source.key, url: 'inline', ok: false, error: error instanceof Error ? error.message : 'PARSE_ERROR' });
        }
        return;
      }
      if (!source.url) {
        report.push({ key: source.key, url: '', ok: false, error: 'NOT_CONFIGURED' });
        return;
      }
      const candidates = [source.url, ...source.mirrors];
      for (const candidate of candidates) {
        const verdict = checkManifestUrl(candidate);
        if (!verdict.ok) {
          report.push({ key: source.key, url: candidate, ok: false, error: `URL_REJECTED_${verdict.code}` });
          continue;
        }
        const outcome = await fetchFeed(candidate);
        if (!outcome.ok) {
          report.push({ key: source.key, url: candidate, ok: false, error: outcome.error, ms: outcome.ms });
          continue;
        }
        try {
          const parsed = parseM3U(outcome.text, source.category);
          // A playlist that yields zero usable channels is a failure, not a success:
          // publishing an empty catalog would silently blank the Live section.
          if (!parsed.channels.some((channel) => channel.playable)) {
            report.push({ key: source.key, url: candidate, ok: false, error: 'NO_PLAYABLE_CHANNELS', bytes: outcome.bytes, ms: outcome.ms });
            continue;
          }
          for (const channel of parsed.channels) sourceKeys.set(channel.id, source.key);
          parsedFeeds.push({ key: source.key, parsed });
          report.push({ key: source.key, url: candidate, ok: true, bytes: outcome.bytes, ms: outcome.ms });
          return;
        } catch (error) {
          report.push({ key: source.key, url: candidate, ok: false, error: error instanceof Error ? error.message : 'PARSE_ERROR', ms: outcome.ms });
        }
      }
    }),
  );

  if (!parsedFeeds.length) return { snapshot: null, sources: report, error: 'ALL_SOURCES_FAILED' };

  // Operator first, so mergeFeeds() lets curated entries win.
  parsedFeeds.sort((a, b) => (a.key === 'operator' ? -1 : b.key === 'operator' ? 1 : 0));
  const merged = mergeFeeds(parsedFeeds.map((feed) => feed.parsed));
  if (!merged.channels.some((channel) => channel.playable)) return { snapshot: null, sources: report, error: 'NO_PLAYABLE_CHANNELS' };

  return { snapshot: toSnapshot(parsedFeeds.map((feed) => feed.key).join('+'), report, merged, sourceKeys), sources: report };
}

/**
 * The single entry point used by the API.
 *
 * `force` bypasses the TTL, which the health endpoint and the cron warmer use.
 */
export async function getLiveSnapshot(region: Region = 'iq', force = false): Promise<ServeState> {
  const now = Date.now();
  const age = now - producedAt;

  if (!force && served && producedAt > 0 && age < FEED_TTL_MS) return served;
  if (!force && served && producedAt > 0 && age >= FEED_TTL_MS && age < FEED_STALE_MS) {
    // Serve stale immediately and refresh in the background on the next call.
    return { ...served, stale: true };
  }
  if (inflight) return inflight;

  inflight = (async (): Promise<ServeState> => {
    try {
      const { snapshot, sources: report, error } = await refreshFromNetwork(region);
      if (snapshot) {
        // Carry forward channels whose feed failed this round, so a partial
        // outage (one provider down) never shrinks the published catalogue.
        const failed = new Set(report.filter((entry) => !entry.ok).map((entry) => entry.key));
        const previous = served?.snapshot ?? (await fromInitialState());
        // A bundled snapshot written before per-channel attribution existed is
        // by construction the build of the region's primary feed, so attribute
        // its channels to that feed instead of dropping them on the floor.
        const primaryKey = LIVE_SOURCES[region === 'world' ? 'world' : region].key;
        const carried = previous
          ? previous.channels.filter((channel) => {
              const key = channel.sourceKey ?? (previous.bundled ? primaryKey : undefined);
              return key !== undefined && failed.has(key);
            })
          : [];
        let merged = snapshot;
        if (carried.length) {
          const present = new Set(snapshot.channels.map((channel) => channel.id));
          const names = new Set(snapshot.channels.map((channel) => channel.name.toLowerCase()));
          const extra = carried.filter((channel) => !present.has(channel.id) && !names.has(channel.name.toLowerCase()));
          if (extra.length) {
            merged = { ...snapshot, channels: [...snapshot.channels, ...extra] };
            merged.report = { ...snapshot.report, total: merged.channels.length };
          }
        }
        producedAt = Date.now();
        served = { snapshot: merged, stale: false };
        await writeStoredSnapshot(merged);
        return served;
      }
      // Last-known-good: whatever we already had, else the stored/bundled copy.
      const fallback = served?.snapshot ?? (await fromInitialState());
      if (fallback) {
        if (!served) producedAt = Date.parse(fallback.createdAt) || 0;
        // Keep the *attempted* feed report so health can explain the failure
        // instead of pretending nothing was tried.
        served = {
          snapshot: { ...fallback, sources: report.length ? report : fallback.sources },
          stale: true,
          reason: error,
        };
        return served;
      }
      return {
        snapshot: {
          version: 1,
          // A 1970 timestamp would make "age" meaningless; use now and let the
          // health endpoint report an empty catalog instead.
          createdAt: new Date().toISOString(),
          origin: 'none',
          bundled: false,
          channels: [],
          report: { total: 0, duplicates: 0, invalid: 0, playerOptionOnly: 0, unnamed: 0, raw: 0 },
          sources: report,
        },
        stale: true,
        reason: error,
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Fill the cache at boot without blocking the first request path. */
export async function warmLiveCache(region: Region = 'iq'): Promise<void> {
  try {
    await getLiveSnapshot(region, true);
  } catch {
    /* Warming is best effort; the API falls back to the bundled snapshot. */
  }
}

export function cacheAgeMs(): number {
  return producedAt ? Date.now() - producedAt : 0;
}
