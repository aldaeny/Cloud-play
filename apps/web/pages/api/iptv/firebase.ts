import { legacySourcesAllowed } from '../../../src/server/legacy-source-policy';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicChannels } from '../../../src/server/firebase-public';
import { enforceRateLimit } from '../../../src/server/rate-limit';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); }
  if (!legacySourcesAllowed()) return res.status(503).json({ error: 'SOURCE_NOT_APPROVED' });
  try { return res.status(200).json({ data: await getPublicChannels() }); }
  catch (e) { return res.status(e instanceof Error && e.message === 'RATE_LIMIT' ? 429 : 503).json({ error: e instanceof Error && e.message === 'RATE_LIMIT' ? 'RATE_LIMIT' : 'SOURCE_UNAVAILABLE' }); }
}
