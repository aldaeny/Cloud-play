import { legacySourcesAllowed } from './legacy-source-policy';
import type { NextApiRequest, NextApiResponse } from 'next';
import { CatalogError } from './xtream';
export async function respond(req: NextApiRequest, res: NextApiResponse, work: () => Promise<unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); }
  if (!legacySourcesAllowed()) return res.status(503).json({ error: 'SOURCE_NOT_APPROVED' });
  try { return res.status(200).json({ data: await work() }); }
  catch (error) {
    const code = error instanceof CatalogError ? error.code : 'UPSTREAM_ERROR';
    const status = code === 'INVALID_CATEGORY' ? 400 : code === 'RATE_LIMIT' ? 429 : 503;
    return res.status(status).json({ error: code });
  }
}
