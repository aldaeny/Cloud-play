import type { NextApiRequest, NextApiResponse } from 'next';
import { CatalogError } from './xtream';
export async function respond(req: NextApiRequest, res: NextApiResponse, work: () => Promise<unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); }
  // No rights gate here. The Xtream adapter keeps its own protections:
  //   * XTREAM_CATALOG_ENABLED must be 'true' (the operator's own switch);
  //   * credentials never reach the response (cleanName redacts them);
  //   * http:// is refused unless XTREAM_ALLOW_HTTP='true';
  //   * 2 MiB response cap, redirects rejected, 120 req/min limit.
  // Those are network and credential protections, not a licensing check, so they
  // stay. See GATE-D notes in docs/live-recovery/.
  try { return res.status(200).json({ data: await work() }); }
  catch (error) {
    const code = error instanceof CatalogError ? error.code : 'UPSTREAM_ERROR';
    const status = code === 'INVALID_CATEGORY' ? 400 : code === 'RATE_LIMIT' ? 429 : 503;
    return res.status(status).json({ error: code });
  }
}
