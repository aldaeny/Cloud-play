import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardAdminRequest } from '../../../lib/backend';

// The API performs authentication, permission checks and tenant isolation.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const state = typeof req.query.state === 'string' ? `?state=${encodeURIComponent(req.query.state)}` : '';
  return forwardAdminRequest(req, res, `/admin/titles${state}`, true);
}
