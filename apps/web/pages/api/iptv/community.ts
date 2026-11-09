import type { NextApiRequest, NextApiResponse } from 'next';
import {
  COMMUNITY_PROJECT_URL,
  COMMUNITY_SOURCE_URL,
  buildCommunityIndex,
  parseCommunityPlaylist,
  queryCommunity,
  type CommunityIndex,
} from '../../../src/server/community-tv';
import { enforceRateLimit } from '../../../src/server/rate-limit';

/**
 * GET /api/iptv/community
 *
 * Public, no auth, no operator configuration. Serves the iptv-org community
 * directory, filtered to streams a browser can actually play.
 *
 * The upstream playlist is large and rebuilt daily, so it is fetched once,
 * parsed, and held in module memory; responses are CDN-cacheable and paginated
 * so the browser never receives the whole index. On an upstream outage we keep
 * serving the last good index rather than emptying the page.
 */

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BYTES = 24 * 1024 * 1024;

let cache: CommunityIndex | null = null;
let inflight: Promise<CommunityIndex> | null = null;

async function loadIndex(): Promise<CommunityIndex> {
  if (cache && Date.now() - cache.updatedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(COMMUNITY_SOURCE_URL, {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let index: CommunityIndex;
  try {
    index = await loadIndex();
  } catch {
    // Fall back to a stale index if we ever had one; otherwise report clearly.
    if (!cache) return res.status(503).json({ error: 'SOURCE_UNAVAILABLE' });
    index = cache;
  }

  const page = queryCommunity(index, {
    country: first(req.query.country),
    category: first(req.query.category),
    q: first(req.query.q),
    limit: Number(first(req.query.limit)) || 60,
    offset: Number(first(req.query.offset)) || 0,
  });

  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  return res.status(200).json({ ...page, source: COMMUNITY_SOURCE_URL, project: COMMUNITY_PROJECT_URL });
}
