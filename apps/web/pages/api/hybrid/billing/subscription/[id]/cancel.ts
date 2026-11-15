import type { NextApiRequest, NextApiResponse } from 'next';
import { callApi } from '../../../../../../src/server/api-bridge';
import { enforceRateLimit } from '../../../../../../src/server/rate-limit';

/** POST /api/hybrid/billing/subscription/[id]/cancel — Cancel subscription bridge. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!enforceRateLimit(req, res, { bucket: 'billing' })) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).json({ error: 'subscription id required' });

  const result = await callApi<{ success: boolean; message: string }>({
    geoRequest: req,
    path: `/billing/subscription/${encodeURIComponent(id)}/cancel`,
    method: 'POST',
    authorization: req.headers.authorization,
    requireAuth: true,
  });

  if (!result.ok) return res.status(result.status).json({ error: result.code });
  return res.status(200).json(result.data);
}