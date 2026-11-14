import { publicFetch } from '../../../src/server/public-fetch';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  COMMUNITY_SOURCE_URL,
  buildCommunityIndex,
  parseCommunityPlaylist,
  type CommunityIndex,
} from '../../../src/server/community-tv';
import { enforceRateLimit } from '../../../src/server/rate-limit';

/**
 * GET /api/iptv/check?ids=<id,id,…>
 *
 * Moment-in-time reachability check for community-directory channels.
 *
 * Security: the caller passes channel IDS only. Every probed URL is looked up
 * in the same approved playlist index that /api/iptv/community serves, so a
 * visitor can never turn this endpoint into an SSRF probe of arbitrary hosts.
 * No URL and no credential is ever returned — only {id, status}.
 *
 * The probe reads the response status and cancels the body immediately; it
 * does not download the stream. A channel that is rate-limited upstream comes
 * back as `unknown` so the UI can leave it unchecked and retry it later.
 */

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_IDS = 12;
const PROBE_TIMEOUT_MS = 4_000;
const RESULT_TTL_MS = 5 * 60 * 1000;
const MAX_PROBES_PER_MINUTE = 60;

let cache: CommunityIndex | null = null;
let inflight: Promise<CommunityIndex> | null = null;

async function loadIndex(): Promise<CommunityIndex> {
  if (cache && Date.now() - cache.updatedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await publicFetch(COMMUNITY_SOURCE_URL, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: '*/*' },
      });
      if (!response.ok) throw new Error('upstream status');
      const text = await response.text();
      if (text.length > MAX_BYTES) throw new Error('upstream too large');
      const channels = parseCommunityPlaylist(text);
      if (channels.length === 0) throw new Error('upstream empty');
      cache = buildCommunityIndex(channels);
      return cache;
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();

  return inflight;
}

function first(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

type ProbeStatus = 'available' | 'unavailable' | 'unknown';

const results = new Map<string, { status: ProbeStatus; at: number }>();
let windowStart = 0;
let hits = 0;

function withinProbeBudget(): boolean {
  const now = Date.now();
  if (now - windowStart >= 60_000) { windowStart = now; hits = 0; }
  if (++hits > MAX_PROBES_PER_MINUTE) return false;
  return true;
}

async function probe(url: string): Promise<ProbeStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: '*/*' },
    });
    // Read only the status line; drop the body without downloading the stream.
    try { await response.body?.cancel(); } catch { /* The body may already be gone. */ }
    if (response.status === 429) return 'unknown';
    return response.ok ? 'available' : 'unavailable';
  } catch {
    // DNS failure, TLS failure, timeout — the channel is not reachable now.
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (!withinProbeBudget()) return res.status(429).json({ error: 'RATE_LIMIT' });

  const ids = first(req.query.ids)
    .split(',')
    .map(id => id.trim())
    .filter(id => /^[a-z0-9-]{1,80}$/i.test(id))
    .slice(0, MAX_IDS);
  if (ids.length === 0) return res.status(200).json({ data: [] });

  let index: CommunityIndex;
  try {
    index = await loadIndex();
  } catch {
    if (!cache) return res.status(503).json({ error: 'SOURCE_UNAVAILABLE' });
    index = cache;
  }

  const byId = new Map(index.channels.map(channel => [channel.id, channel]));
  const data = await Promise.all(ids.map(async id => {
    const cached = results.get(id);
    if (cached && Date.now() - cached.at < RESULT_TTL_MS) return { id, status: cached.status };
    const channel = byId.get(id);
    if (!channel) return { id, status: 'unknown' as const };
    const status = await probe(channel.url);
    results.set(id, { status, at: Date.now() });
    return { id, status };
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ data });
}
