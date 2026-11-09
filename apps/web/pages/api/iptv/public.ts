import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicChannels } from '../../../src/server/public-tv';
import { enforceRateLimit } from '../../../src/server/rate-limit';

/**
 * GET /api/iptv/public
 * Public, no auth, no operator configuration. A hand-verified list of
 * free-to-air streams published by the broadcasters themselves.
 * The list is static, so it is CDN-cacheable.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ data: getPublicChannels() });
}
