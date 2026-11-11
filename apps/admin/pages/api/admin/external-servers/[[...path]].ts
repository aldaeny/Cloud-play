import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardAdminRequest } from '../../../../lib/backend';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  const segments = Array.isArray(req.query.path) ? req.query.path : [];
  if (segments.some(segment => !/^[a-zA-Z0-9_-]+$/.test(segment))) return res.status(400).json({ error: 'Invalid resource path' });
  const query = new URLSearchParams();
  for (const key of ['cursor', 'platform', 'country']) if (typeof req.query[key] === 'string') query.set(key, req.query[key] as string);
  const suffix = segments.length ? '/' + segments.join('/') : '';
  return forwardAdminRequest(req, res, `/admin/external-servers${suffix}${query.size ? '?' + query : ''}`, true);
}
