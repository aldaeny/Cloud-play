import type { NextApiRequest, NextApiResponse } from 'next';
import { callApi } from '../../../src/server/api-bridge';
import { enforceRateLimit } from '../../../src/server/rate-limit';

/** Read-only, fixed-target migration surface; never an arbitrary backend proxy. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!enforceRateLimit(req, res, { bucket: 'catalog' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const result = await callApi<{ data: unknown[] }>({
    geoRequest:req, path: '/hybrid/profiles', authorization: req.headers.authorization,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.code });
  return res.status(200).json(result.data);
}
