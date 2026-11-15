import type { NextApiRequest, NextApiResponse } from 'next';
import { callApi } from '../../../../src/server/api-bridge';
import { enforceRateLimit } from '../../../../src/server/rate-limit';

/** POST /api/hybrid/auth/revoke-all — Revoke all user tokens bridge. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!enforceRateLimit(req, res, { bucket: 'auth' })) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const result = await callApi<{ success: boolean; message: string }>({
    geoRequest: req,
    path: '/hybrid/auth/revoke-all',
    method: 'POST',
    authorization: req.headers.authorization,
    body: { user_id: req.body?.user_id },
    requireAuth: true,
  });

  if (!result.ok) return res.status(result.status).json({ error: result.code });
  return res.status(200).json(result.data);
}