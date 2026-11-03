import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardAdminRequest } from '../../../lib/backend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return forwardAdminRequest(req, res, '/auth/admin/login', false);
}
