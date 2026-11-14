import type { NextApiRequest, NextApiResponse } from 'next';
import { callApi } from '../../../../src/server/api-bridge';
import { enforceRateLimit } from '../../../../src/server/rate-limit';

/** POST /api/hybrid/billing/checkout — Create checkout session bridge. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!enforceRateLimit(req, res, { bucket: 'billing' })) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const { plan_id } = req.body || {};
  if (!plan_id) return res.status(400).json({ error: 'plan_id is required' });

  const result = await callApi<{ provider: string; transactionId: string; checkoutUrl: string }>({
    geoRequest: req,
    path: '/billing/checkout',
    method: 'POST',
    authorization: req.headers.authorization,
    body: { planId: plan_id },
    requireAuth: true,
  });

  if (!result.ok) return res.status(result.status).json({ error: result.code });
  return res.status(200).json(result.data);
}