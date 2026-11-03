import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardAdminRequest } from '../../../../lib/backend';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const allowed = ['GET', 'POST', 'PATCH', 'DELETE'];
  if (!req.method || !allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [];
  if (segments.some(segment => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
    return res.status(400).json({ error: 'Invalid resource path' });
  }
  const suffix = segments.length ? '/' + segments.map(encodeURIComponent).join('/') : '';
  return forwardAdminRequest(req, res, `/admin/xtream-servers${suffix}`, true);
}
